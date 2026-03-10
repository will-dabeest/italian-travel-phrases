import './style.css';
import type {
  AppState,
  CategoryPhase,
  CategoryManifest,
  ConvoCategory,
  ConvoDerivedData,
  ConvoLibraryRaw,
  DifficultyMode,
  PhrasesStage,
  Phrase,
  PhraseCategoryData,
  PhraseLibraryManifest,
  PromptCategory,
  ResponseCategory
} from './types';
import convoData from './convo.json';
import { loadFixedAudioManifest, speakItalian } from './utils/audio';
import { classifyAccuracy, getPronunciationHint, getSimilarity, toIpaHint, tokenDiff } from './utils/scoring';
import { createInitialCard, isDue, overdueDays, updateSrsCard } from './utils/srs';
import { addPassiveListener, debounce } from './utils/performance';
import { buildConvoDerivedData } from './utils/convo';
import { progressLabel } from './utils/format';
import {
  getFirstUnlockedPhrasesCategoryId as phrasesGetFirstUnlockedCategoryId,
  getNextUnlockedPhrasesCategoryId,
  getPhrasesCategoryProgress as phrasesGetCategoryProgress,
  isPhrasesCategoryUnlockedAtIndex,
  isPhrasesStageFullyCompleted
} from './utils/phrases';
import {
  getCategoryCompletion as roadmapGetCategoryCompletion,
  getFirstUnlockedCategory as roadmapGetFirstUnlockedCategory,
  getPhraseIndex as roadmapGetPhraseIndex,
  isCategoryComplete as roadmapIsCategoryComplete,
  isCategoryUnlocked as roadmapIsCategoryUnlocked,
  isModeFullyCompleted as roadmapIsModeFullyCompleted,
  isModeUnlocked as roadmapIsModeUnlocked,
  isPhraseCompletedInMode as roadmapIsPhraseCompletedInMode,
  isRoadmapPhraseUnlocked as roadmapIsRoadmapPhraseUnlocked
} from './utils/roadmap';
import { ensureCard, ensureProgress, loadState, resetState, saveState, updateStreak } from './state/store';
import { escapeHtml, mustQuery } from './ui/dom';
import {
  renderLandingSection,
  renderPhraseItemButton,
  renderPhrasesCategoryPathPanel,
  renderPhrasesCurrentStateCard,
  renderRoadmapCategoryButton,
  renderTopbar
} from './ui/markup';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type FilterMode = 'all' | 'needs' | 'mastered' | 'difficult';
type SortMode = 'relevance' | 'least-progress' | 'most-progress';
type ViewMode = 'landing' | 'roadmap' | 'detailed' | 'phrases-home' | 'phrases-prompt' | 'phrases-response' | 'phrases-convo';
type RoadmapNextTarget = { mode: DifficultyMode; categoryId: string; phraseId: string } | null;

const CATEGORY_ORDER = [
  'greetings',
  'navigation',
  'transportation',
  'food',
  'hotels',
  'shopping',
  'social',
  'emergencies',
  'coffee',
  'trains',
  'restaurants_extra',
  'hotels_extra',
  'daily_extra'
];

const FEEDBACK_PLACEHOLDER_HTML = '<p>Practice feedback appears here for the selected phrase.</p>';
const ERROR_PLAYBACK_UNAVAILABLE = 'Could not play pronunciation in this browser.';
const ERROR_RECORDING_UNEXPECTED = 'Unexpected recording error.';
const ERROR_RUNTIME_UNEXPECTED = 'An unexpected error occurred. Please refresh and try again.';
const ERROR_RUNTIME_BACKGROUND = 'A background operation failed. Please retry the action.';
const CONVO_MESSAGE_AUTOCLEAR_MS = 1800;
const unlockAllParam = new URLSearchParams(location.search).get('unlockAll');
const LOCAL_UNLOCK_OVERRIDE = unlockAllParam === '1' || unlockAllParam === 'true';
let convoMessageToken = 0;

const appRoot = mustQuery<HTMLElement>(document, '#app');
const convoDerived = buildConvoDerivedData(convoData as ConvoLibraryRaw);

const runtime = {
  state: loadState(),
  categories: [] as CategoryManifest[],
  loadedCategories: new Set<string>(),
  phraseMap: new Map<string, Phrase>(),
  selectedCategory: 'all',
  selectedPhraseId: '',
  activeRoadmapCategoryId: '',
  filter: 'all' as FilterMode,
  sortMode: 'relevance' as SortMode,
  viewMode: 'landing' as ViewMode,
  activeDifficulty: 'easy' as DifficultyMode,
  search: '',
  keepSearchFocus: false,
  searchSelectionStart: 0,
  searchSelectionEnd: 0,
  feedbackPhraseId: '',
  feedbackHtml: '',
  recording: false,
  message: '',
  celebration: '',
  promptCategoryId: '',
  promptPhase: 'learn' as CategoryPhase,
  promptLearnIndex: 0,
  promptMatchAudioSelected: '',
  promptMatchEnglishSelected: '',
  promptMatchedIds: new Set<string>(),
  promptAudioOrder: [] as string[],
  promptEnglishOrder: [] as string[],
  responseCategoryId: '',
  responsePhase: 'learn' as CategoryPhase,
  responseLearnIndex: 0,
  responseMatchAudioSelected: '',
  responseMatchEnglishSelected: '',
  responseMatchedIds: new Set<string>(),
  responseAudioOrder: [] as string[],
  responseEnglishOrder: [] as string[],
  responseSpeakIndex: 0,
  responseSpeakPasses: 0,
  convoCategoryId: '',
  convoSpeakIndex: 0,
  installPrompt: null as BeforeInstallPromptEvent | null,
  listenersBound: false
};

function applySettings(state: AppState): void {
  document.documentElement.dataset.theme = state.settings.theme;
  document.documentElement.dataset.contrast = state.settings.highContrast ? 'high' : 'normal';
  document.documentElement.style.setProperty('--font-scale', String(state.settings.fontScale));
}

function getOrderedCategories(): CategoryManifest[] {
  const rank = new Map(CATEGORY_ORDER.map((id, index) => [id, index]));
  return [...runtime.categories].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

function getLoadedPhrases(): Phrase[] {
  return [...runtime.phraseMap.values()];
}

function averageAccuracy(phraseId: string): number {
  const progress = runtime.state.progress[phraseId];
  if (!progress || progress.attempts === 0) return 0.7;
  return progress.totalAccuracy / progress.attempts;
}

function isMastered(phraseId: string): boolean {
  return Boolean(runtime.state.progress[phraseId]?.mastered);
}

function isDifficult(phraseId: string): boolean {
  return Boolean(runtime.state.progress[phraseId]?.difficult);
}

function isNeedsPractice(phraseId: string): boolean {
  const progress = runtime.state.progress[phraseId];
  if (!progress || progress.attempts === 0) return true;
  if (progress.mastered) return false;

  const average = progress.totalAccuracy / Math.max(1, progress.attempts);
  const card = runtime.state.srs[phraseId] ?? createInitialCard();
  return progress.difficult || average < 0.85 || isDue(card);
}

function getPhraseProgress(phraseId: string): { percent: number; attempts: number; label: string } {
  const progress = runtime.state.progress[phraseId];
  if (!progress || progress.attempts === 0) return { percent: 0, attempts: 0, label: 'New' };

  const average = progress.totalAccuracy / Math.max(1, progress.attempts);
  const card = runtime.state.srs[phraseId] ?? createInitialCard();
  const intervalScore = Math.min(1, card.interval / 30);
  const masteryScore = Math.min(1, average * 0.75 + intervalScore * 0.25);
  const percent = Math.round(masteryScore * 100);

  let label = 'Learning';
  if (progress.mastered || percent >= 85) label = 'Strong';
  else if (progress.difficult || percent < 45) label = 'Needs Focus';

  return { percent, attempts: progress.attempts, label };
}

function getPhrasePasses(phraseId: string): number {
  return runtime.state.roadmapProgress[runtime.activeDifficulty][phraseId] ?? 0;
}

function isPhraseCompletedInMode(phraseId: string, mode: DifficultyMode): boolean {
  return roadmapIsPhraseCompletedInMode(runtime.state, phraseId, mode);
}

function isModeFullyCompleted(mode: DifficultyMode): boolean {
  return roadmapIsModeFullyCompleted(runtime.state, getOrderedCategories(), mode);
}

function isModeUnlocked(mode: DifficultyMode): boolean {
  if (LOCAL_UNLOCK_OVERRIDE) return true;
  return roadmapIsModeUnlocked(runtime.state, getOrderedCategories(), mode);
}

function isRoadmapPhraseUnlocked(categoryId: string, phraseIndex: number, mode: DifficultyMode): boolean {
  if (LOCAL_UNLOCK_OVERRIDE) return true;
  return roadmapIsRoadmapPhraseUnlocked(runtime.state, categoryId, phraseIndex, mode);
}

function getPhraseIndex(phraseId: string): number {
  return roadmapGetPhraseIndex(phraseId);
}

function getCategoryCompletion(category: CategoryManifest, mode: DifficultyMode): { complete: number; total: number; percent: number } {
  return roadmapGetCategoryCompletion(runtime.state, category, mode);
}

function isCategoryComplete(category: CategoryManifest, mode: DifficultyMode): boolean {
  return roadmapIsCategoryComplete(runtime.state, category, mode);
}

function isCategoryUnlocked(index: number, ordered: CategoryManifest[], mode: DifficultyMode): boolean {
  if (LOCAL_UNLOCK_OVERRIDE) return true;
  return roadmapIsCategoryUnlocked(runtime.state, index, ordered, mode);
}

function getFirstUnlockedCategory(mode: DifficultyMode): CategoryManifest | undefined {
  return roadmapGetFirstUnlockedCategory(runtime.state, getOrderedCategories(), mode);
}

function getRoadmapPhraseIdsForCategory(categoryId: string): string[] {
  return getLoadedPhrases()
    .filter((phrase) => phrase.categoryId === categoryId)
    .sort((a, b) => getPhraseIndex(a.id) - getPhraseIndex(b.id))
    .map((phrase) => phrase.id);
}

function getNextRoadmapTarget(mode: DifficultyMode, currentCategoryId: string, currentPhraseId: string): RoadmapNextTarget {
  const phraseIds = getRoadmapPhraseIdsForCategory(currentCategoryId);
  const currentIndex = phraseIds.indexOf(currentPhraseId);
  if (currentIndex >= 0 && currentIndex < phraseIds.length - 1) {
    return { mode, categoryId: currentCategoryId, phraseId: phraseIds[currentIndex + 1] };
  }

  const ordered = getOrderedCategories();
  const currentCategoryIndex = ordered.findIndex((category) => category.id === currentCategoryId);
  if (currentCategoryIndex >= 0) {
    for (let index = currentCategoryIndex + 1; index < ordered.length; index += 1) {
      const category = ordered[index];
      if (!isCategoryUnlocked(index, ordered, mode)) continue;
      const nextPhraseId = `${category.id}-0`;
      return { mode, categoryId: category.id, phraseId: nextPhraseId };
    }
  }

  if (mode === 'easy' && isModeUnlocked('intermediate')) {
    const nextCategory = getFirstUnlockedCategory('intermediate');
    if (nextCategory) return { mode: 'intermediate', categoryId: nextCategory.id, phraseId: `${nextCategory.id}-0` };
  }

  if (mode === 'intermediate' && isModeUnlocked('hard')) {
    const nextCategory = getFirstUnlockedCategory('hard');
    if (nextCategory) return { mode: 'hard', categoryId: nextCategory.id, phraseId: `${nextCategory.id}-0` };
  }

  return null;
}

async function goToRoadmapTarget(target: Exclude<RoadmapNextTarget, null>): Promise<void> {
  runtime.activeDifficulty = target.mode;
  clearPracticeFeedback({ clearMessage: true });
  await chooseRoadmapCategory(target.categoryId, target.mode);
  runtime.selectedPhraseId = target.phraseId;
}

function getSelectedFeedback(phraseId?: string): string {
  return phraseId && runtime.feedbackPhraseId === phraseId ? runtime.feedbackHtml : '';
}

function clearPracticeFeedback(options?: { clearMessage?: boolean }): void {
  runtime.feedbackPhraseId = '';
  runtime.feedbackHtml = '';
  if (options?.clearMessage) runtime.message = '';
}

function getModeUnlockMessage(mode: DifficultyMode): string {
  return mode === 'intermediate'
    ? 'Complete all Easy phrases to unlock Intermediate.'
    : 'Complete all Intermediate phrases to unlock Hard.';
}

function runAndRender(task?: Promise<unknown>): void {
  if (!task) {
    render();
    return;
  }

  task.then(() => render()).catch(() => render());
}

const shuffledIds = (ids: string[]): string[] => {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
};

function getPromptCategories(): PromptCategory[] {
  return convoDerived.promptCategories;
}

function getResponseCategories(): ResponseCategory[] {
  return convoDerived.responseCategories;
}

function getConvoCategories(): ConvoCategory[] {
  return convoDerived.convoCategories;
}

function getStageCategories(stage: PhrasesStage): (PromptCategory | ResponseCategory | ConvoCategory)[] {
  if (stage === 'prompt') return getPromptCategories();
  if (stage === 'response') return getResponseCategories();
  return getConvoCategories();
}

function getPromptCategoryById(categoryId: string): PromptCategory | undefined {
  return getPromptCategories().find((item) => item.id === categoryId);
}

function getResponseCategoryById(categoryId: string): ResponseCategory | undefined {
  return getResponseCategories().find((item) => item.id === categoryId);
}

function getConvoCategoryById(categoryId: string): ConvoCategory | undefined {
  return getConvoCategories().find((item) => item.id === categoryId);
}

function getCategoryDataAttribute(stage: PhrasesStage): string {
  if (stage === 'prompt') return 'data-prompt-category';
  if (stage === 'response') return 'data-response-category';
  return 'data-convo-category';
}

function setPhrasesViewForStage(stage: PhrasesStage): void {
  if (stage === 'prompt') runtime.viewMode = 'phrases-prompt';
  else if (stage === 'response') runtime.viewMode = 'phrases-response';
  else runtime.viewMode = 'phrases-convo';
}

function getStageCompletedCategories(stage: PhrasesStage): string[] {
  if (stage === 'prompt') return runtime.state.phrasesProgress.promptCompletedCategories;
  if (stage === 'response') return runtime.state.phrasesProgress.responseCompletedCategories;
  return runtime.state.phrasesProgress.convoCompletedCategories;
}

function isStageFullyCompleted(stage: PhrasesStage): boolean {
  const categories = getStageCategories(stage);
  return isPhrasesStageFullyCompleted(categories, getStageCompletedCategories(stage));
}

function isPhrasesModeUnlocked(): boolean {
  if (LOCAL_UNLOCK_OVERRIDE) return true;
  return isModeFullyCompleted('hard');
}

function isPhrasesSubModeUnlocked(stage: PhrasesStage): boolean {
  if (LOCAL_UNLOCK_OVERRIDE) return true;
  if (!isPhrasesModeUnlocked()) return false;
  if (stage === 'prompt') return true;
  if (stage === 'response') return isStageFullyCompleted('prompt');
  return isStageFullyCompleted('response');
}

function isPhrasesCategoryUnlocked(stage: PhrasesStage, categoryIndex: number): boolean {
  const categories = getStageCategories(stage);
  return isPhrasesCategoryUnlockedAtIndex(categoryIndex, categories, getStageCompletedCategories(stage), LOCAL_UNLOCK_OVERRIDE);
}

function getFirstUnlockedPhrasesCategoryId(stage: PhrasesStage): string {
  const categories = getStageCategories(stage);
  return phrasesGetFirstUnlockedCategoryId(categories, getStageCompletedCategories(stage), LOCAL_UNLOCK_OVERRIDE);
}

function getPhrasesCategoryProgress(
  stage: PhrasesStage,
  categoryId: string,
  unitsCount: number,
  isCurrentCategory: boolean,
  isCompletedCategory: boolean
): { complete: number; total: number; percent: number } {
  return phrasesGetCategoryProgress(stage, unitsCount, isCurrentCategory, isCompletedCategory, {
    promptPhase: runtime.promptPhase,
    promptLearnIndex: runtime.promptLearnIndex,
    promptMatchedCount: runtime.promptMatchedIds.size,
    responsePhase: runtime.responsePhase,
    responseLearnIndex: runtime.responseLearnIndex,
    responseMatchedCount: runtime.responseMatchedIds.size,
    responseSpeakIndex: runtime.responseSpeakIndex,
    convoSpeakIndex: runtime.convoSpeakIndex
  });
}

function renderPhrasesCategoryPath(stage: PhrasesStage, currentCategoryId: string): string {
  const categories = getStageCategories(stage);
  const completed = new Set(getStageCompletedCategories(stage));
  const dataAttr = getCategoryDataAttribute(stage);

  return renderPhrasesCategoryPathPanel({
    dataAttribute: dataAttr,
    categories: categories.map((category, index) => {
      const isUnlocked = isPhrasesCategoryUnlocked(stage, index);
      const isCompleted = completed.has(category.id);
      return {
        id: category.id,
        name: category.name,
        isActive: currentCategoryId === category.id,
        isUnlocked,
        progress: getPhrasesCategoryProgress(stage, category.id, category.units.length, currentCategoryId === category.id, isCompleted)
      };
    })
  });
}

type NextExerciseTarget = { stage: PhrasesStage; categoryId: string } | null;

function getNextUnlockedCategoryId(stage: PhrasesStage, currentCategoryId: string): string {
  const categories = getStageCategories(stage);
  return getNextUnlockedPhrasesCategoryId(categories, getStageCompletedCategories(stage), LOCAL_UNLOCK_OVERRIDE, currentCategoryId);
}

function getNextExerciseTarget(stage: PhrasesStage, currentCategoryId: string): NextExerciseTarget {
  const nextCategoryId = getNextUnlockedCategoryId(stage, currentCategoryId);
  if (nextCategoryId) return { stage, categoryId: nextCategoryId };

  if (stage === 'prompt' && isStageFullyCompleted('prompt') && isPhrasesSubModeUnlocked('response')) {
    const firstResponseCategoryId = getFirstUnlockedPhrasesCategoryId('response');
    return firstResponseCategoryId ? { stage: 'response', categoryId: firstResponseCategoryId } : null;
  }

  if (stage === 'response' && isStageFullyCompleted('response') && isPhrasesSubModeUnlocked('convo')) {
    const firstConvoCategoryId = getFirstUnlockedPhrasesCategoryId('convo');
    return firstConvoCategoryId ? { stage: 'convo', categoryId: firstConvoCategoryId } : null;
  }

  return null;
}

function goToPhrasesExerciseTarget(target: NextExerciseTarget): void {
  if (!target) return;

  if (target.stage === 'prompt') {
    initializePromptCategory(target.categoryId);
  } else if (target.stage === 'response') {
    initializeResponseCategory(target.categoryId);
  } else {
    initializeConvoCategory(target.categoryId);
  }

  setPhrasesViewForStage(target.stage);

  runtime.message = '';
}

function markStageCategoryCompleted(stage: PhrasesStage, categoryId: string): void {
  const list = getStageCompletedCategories(stage);
  if (!list.includes(categoryId)) {
    list.push(categoryId);
    saveState(runtime.state);
  }
}

function initializePromptCategory(categoryId: string): void {
  const category = getPromptCategoryById(categoryId);
  if (!category) return;

  runtime.promptCategoryId = category.id;
  runtime.promptPhase = 'learn';
  runtime.promptLearnIndex = 0;
  runtime.promptMatchAudioSelected = '';
  runtime.promptMatchEnglishSelected = '';
  runtime.promptMatchedIds = new Set<string>();
  const unitIds = category.units.map((unit) => unit.id);
  runtime.promptAudioOrder = shuffledIds(unitIds);
  runtime.promptEnglishOrder = shuffledIds(unitIds);
  runtime.message = '';
}

function initializeResponseCategory(categoryId: string): void {
  const category = getResponseCategoryById(categoryId);
  if (!category) return;

  runtime.responseCategoryId = category.id;
  runtime.responsePhase = 'learn';
  runtime.responseLearnIndex = 0;
  runtime.responseMatchAudioSelected = '';
  runtime.responseMatchEnglishSelected = '';
  runtime.responseMatchedIds = new Set<string>();
  const unitIds = category.units.map((unit) => unit.id);
  runtime.responseAudioOrder = shuffledIds(unitIds);
  runtime.responseEnglishOrder = shuffledIds(unitIds);
  runtime.responseSpeakIndex = 0;
  runtime.responseSpeakPasses = 0;
  runtime.message = '';
}

function initializeConvoCategory(categoryId: string): void {
  const category = getConvoCategoryById(categoryId);
  if (!category) return;
  runtime.convoCategoryId = category.id;
  runtime.convoSpeakIndex = 0;
  runtime.message = '';
}

async function recognizeAndScore(expectedItalian: string): Promise<{ transcript: string; similarity: number }> {
  const { isRecognitionSupported, recognizeItalian } = await import('./utils/recognition');
  if (!isRecognitionSupported()) {
    throw new Error('Speech recognition is unavailable in this browser. Chrome recommended.');
  }

  const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
  const heard = await recognizeItalian({
    timeoutMs: isIOS ? 12000 : 7000,
    retries: isIOS ? 3 : 1,
    retryDelayMs: isIOS ? 700 : 300,
    startDelayMs: isIOS ? 120 : 0
  });
  return {
    transcript: heard.transcript,
    similarity: getSimilarity(expectedItalian, heard.transcript)
  };
}

function handlePromptMatchSelection(): void {
  if (!runtime.promptMatchAudioSelected || !runtime.promptMatchEnglishSelected) return;

  if (runtime.promptMatchAudioSelected === runtime.promptMatchEnglishSelected) {
    runtime.promptMatchedIds.add(runtime.promptMatchAudioSelected);
    runtime.promptMatchAudioSelected = '';
    runtime.promptMatchEnglishSelected = '';

    const category = getPromptCategoryById(runtime.promptCategoryId);
    if (category && runtime.promptMatchedIds.size === category.units.length) {
      markStageCategoryCompleted('prompt', category.id);
      showCelebration('🎉 Prompt category complete!');
      runtime.message = '';
    }
    return;
  }

  runtime.promptMatchedIds = new Set<string>();
  runtime.promptMatchAudioSelected = '';
  runtime.promptMatchEnglishSelected = '';
  runtime.message = 'Incorrect match. The exercise has been reset — try again.';
}

function handleResponseMatchSelection(): void {
  if (!runtime.responseMatchAudioSelected || !runtime.responseMatchEnglishSelected) return;

  if (runtime.responseMatchAudioSelected === runtime.responseMatchEnglishSelected) {
    runtime.responseMatchedIds.add(runtime.responseMatchAudioSelected);
    runtime.responseMatchAudioSelected = '';
    runtime.responseMatchEnglishSelected = '';

    const category = getResponseCategoryById(runtime.responseCategoryId);
    if (category && runtime.responseMatchedIds.size === category.units.length) {
      runtime.responsePhase = 'speak';
      runtime.responseSpeakIndex = 0;
      runtime.responseSpeakPasses = 0;
      runtime.message = '';
    }
    return;
  }

  runtime.responseMatchedIds = new Set<string>();
  runtime.responseMatchAudioSelected = '';
  runtime.responseMatchEnglishSelected = '';
  runtime.message = 'Incorrect match. The exercise has been reset — try again.';
}

async function handleResponseSpeakingChallenge(): Promise<void> {
  const category = getResponseCategoryById(runtime.responseCategoryId);
  if (!category) return;
  const currentUnit = category.units[runtime.responseSpeakIndex];
  if (!currentUnit || runtime.recording) return;

  runtime.recording = true;
  render();
  try {
    const result = await recognizeAndScore(currentUnit.it);
    if (result.similarity >= 0.7) {
      runtime.responseSpeakPasses += 1;
      runtime.message = `Correct (${Math.round(result.similarity * 100)}%). Pass ${runtime.responseSpeakPasses}/3.`;
    } else {
      runtime.responseSpeakPasses = 0;
      runtime.message = `Below threshold (${Math.round(result.similarity * 100)}%). Passes reset.`;
    }

    if (runtime.responseSpeakPasses >= 3) {
      runtime.responseSpeakIndex += 1;
      runtime.responseSpeakPasses = 0;
      if (runtime.responseSpeakIndex >= category.units.length) {
        markStageCategoryCompleted('response', category.id);
        showCelebration('🎉 Response category complete!');
      }
    }
  } catch (error) {
    runtime.message = error instanceof Error ? error.message : ERROR_RECORDING_UNEXPECTED;
  } finally {
    runtime.recording = false;
    render();
  }
}

async function handleConvoSpeakingChallenge(): Promise<void> {
  const category = getConvoCategoryById(runtime.convoCategoryId);
  if (!category) return;
  const currentUnit = category.units[runtime.convoSpeakIndex];
  if (!currentUnit || runtime.recording) return;

  runtime.recording = true;
  render();
  try {
    convoMessageToken += 1;
    const result = await recognizeAndScore(currentUnit.responseIt);
    if (result.similarity >= 0.7) {
      runtime.message = `Passed ${Math.round(result.similarity * 100)}% for “${currentUnit.promptIt}” → “${currentUnit.responseIt}”.`;
      runtime.convoSpeakIndex += 1;
      const messageToken = convoMessageToken;
      setTimeout(() => {
        if (messageToken !== convoMessageToken) return;
        if (runtime.viewMode !== 'phrases-convo') return;
        if (!runtime.message.startsWith('Passed ')) return;
        runtime.message = '';
        render();
      }, CONVO_MESSAGE_AUTOCLEAR_MS);
      if (runtime.convoSpeakIndex >= category.units.length) {
        markStageCategoryCompleted('convo', category.id);
        showCelebration('🎉 Convo category complete!');
      }
    } else {
      runtime.message = `Below threshold (${Math.round(result.similarity * 100)}%) for “${currentUnit.promptIt}” → “${currentUnit.responseIt}”. Try again.`;
    }
  } catch (error) {
    runtime.message = error instanceof Error ? error.message : ERROR_RECORDING_UNEXPECTED;
  } finally {
    runtime.recording = false;
    render();
  }
}

function searchScore(phrase: Phrase, query: string): number {
  if (!query) return 1;
  const normalizedQuery = query.toLowerCase();
  if (phrase.it.toLowerCase().includes(normalizedQuery) || phrase.en.toLowerCase().includes(normalizedQuery)) return 1;
  return Math.max(getSimilarity(phrase.it, query), getSimilarity(phrase.en, query));
}

function getVisiblePhrases(): Phrase[] {
  const q = runtime.search.trim();
  const filtered = getLoadedPhrases()
    .filter((phrase) => (runtime.selectedCategory === 'all' ? true : phrase.categoryId === runtime.selectedCategory))
    .filter((phrase) => (q ? searchScore(phrase, q) >= 0.42 : true))
    .filter((phrase) => {
      if (runtime.filter === 'all') return true;
      if (runtime.filter === 'mastered') return isMastered(phrase.id);
      if (runtime.filter === 'difficult') return isDifficult(phrase.id);
      return isNeedsPractice(phrase.id);
    });

  if (runtime.sortMode === 'least-progress') return filtered.sort((a, b) => getPhraseProgress(a.id).percent - getPhraseProgress(b.id).percent);
  if (runtime.sortMode === 'most-progress') return filtered.sort((a, b) => getPhraseProgress(b.id).percent - getPhraseProgress(a.id).percent);
  return filtered.sort((a, b) => searchScore(b, q) - searchScore(a, q));
}

function phraseItemMarkup(phrase: Phrase): string {
  const card = runtime.state.srs[phrase.id] ?? createInitialCard();
  const overdue = overdueDays(card);
  const phraseProgress = getPhraseProgress(phrase.id);
  const badges = [
    isNeedsPractice(phrase.id) && !isMastered(phrase.id) ? '<span class="badge badge--needs">Needs Practice</span>' : '',
    isMastered(phrase.id) ? '<span class="badge badge--mastered">Mastered</span>' : '',
    isDifficult(phrase.id) ? '<span class="badge badge--difficult">Difficult</span>' : '',
    overdue > 0 ? `<span class="badge badge--overdue">Overdue ${overdue}d</span>` : ''
  ]
    .filter(Boolean)
    .join('');

  return renderPhraseItemButton({
    phrase,
    isActive: runtime.selectedPhraseId === phrase.id,
    badgesHtml: badges,
    progress: phraseProgress
  });
}

function roadmapCategoryMarkup(category: CategoryManifest, index: number, ordered: CategoryManifest[], mode: DifficultyMode): string {
  const completion = getCategoryCompletion(category, mode);
  const unlocked = isCategoryUnlocked(index, ordered, mode);

  return renderRoadmapCategoryButton({
    category,
    completion,
    isActive: runtime.activeRoadmapCategoryId === category.id,
    isUnlocked: unlocked
  });
}

function playFeedbackSound(kind: 'correct' | 'phrase-complete' | 'category-complete'): void {
  const Ctx = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return;
  const ctx = new Ctx();

  const notes = kind === 'correct' ? [660, 880] : kind === 'phrase-complete' ? [523, 659, 784] : [392, 523, 659, 784, 1046];

  let t = ctx.currentTime + 0.01;
  notes.forEach((freq, index) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.14 + index * 0.01);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.16 + index * 0.01);
    t += 0.07;
  });

  void ctx.close();
}

function showCelebration(message: string): void {
  runtime.celebration = message;
  render();
  window.setTimeout(() => {
    runtime.celebration = '';
    render();
  }, 2100);
}

async function ensureCategoryLoaded(categoryId: string): Promise<void> {
  if (runtime.loadedCategories.has(categoryId)) return;
  const category = runtime.categories.find((item) => item.id === categoryId);
  if (!category) return;

  const response = await fetch(category.file, { cache: 'force-cache' });
  const data = (await response.json()) as PhraseCategoryData;

  data.phrases.forEach((phrase, index) => {
    const id = `${category.id}-${index}`;
    if (!runtime.phraseMap.has(id)) {
      runtime.phraseMap.set(id, { id, categoryId: category.id, categoryName: category.name, it: phrase.it, en: phrase.en });
    }
  });

  runtime.loadedCategories.add(categoryId);
}

async function ensureAllCategoriesLoaded(): Promise<void> {
  for (const category of runtime.categories) {
    if (!runtime.loadedCategories.has(category.id)) await ensureCategoryLoaded(category.id);
  }
}

async function chooseRoadmapCategory(categoryId: string, mode: DifficultyMode): Promise<void> {
  runtime.activeRoadmapCategoryId = categoryId;
  await ensureCategoryLoaded(categoryId);

  const categoryPhrases = getLoadedPhrases().filter((phrase) => phrase.categoryId === categoryId).sort((a, b) => getPhraseIndex(a.id) - getPhraseIndex(b.id));
  const firstIncomplete = categoryPhrases.find((phrase) => !isPhraseCompletedInMode(phrase.id, mode));
  runtime.selectedPhraseId = (firstIncomplete ?? categoryPhrases[0])?.id ?? runtime.selectedPhraseId;
}

function applySrsScore(phrase: Phrase, similarity: number, quality: number): void {
  const progress = ensureProgress(runtime.state, phrase.id);
  progress.attempts += 1;
  progress.totalAccuracy += similarity;
  progress.lastAccuracy = similarity;

  const updated = updateSrsCard(ensureCard(runtime.state, phrase.id), quality, phrase.it.split(/\s+/).length);
  runtime.state.srs[phrase.id] = updated;
  progress.difficult = similarity < 0.7 || updated.easinessFactor < 2.0;
  progress.mastered = updated.interval >= 21 && updated.easinessFactor >= 2.4;
}

async function handlePronunciationPractice(): Promise<void> {
  const selected = runtime.phraseMap.get(runtime.selectedPhraseId);
  if (!selected || runtime.recording) return;
  const mode = runtime.activeDifficulty;

  runtime.recording = true;
  runtime.message = '';
  render();

  try {
    const { isRecognitionSupported, recognizeItalian } = await import('./utils/recognition');
    if (!isRecognitionSupported()) {
      runtime.message = 'Speech recognition is unavailable in this browser. Chrome recommended.';
      return;
    }

    const ordered = getOrderedCategories();
    const activeCategory = ordered.find((cat) => cat.id === selected.categoryId);
    const categoryWasComplete = activeCategory ? isCategoryComplete(activeCategory, mode) : false;

    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    const heard = await recognizeItalian({
      timeoutMs: isIOS ? 12000 : 7000,
      retries: isIOS ? 3 : 1,
      retryDelayMs: isIOS ? 700 : 300,
      startDelayMs: isIOS ? 120 : 0
    });
    const similarity = getSimilarity(selected.it, heard.transcript);
    const { label, quality } = classifyAccuracy(similarity, averageAccuracy(selected.id));
    const diff = tokenDiff(selected.it, heard.transcript)
      .map((token) => `<span class="token token--${token.status}">${escapeHtml(token.token)}</span>`)
      .join(' ');

    applySrsScore(selected, similarity, quality);

    const oldPasses = getPhrasePasses(selected.id);
    if (similarity >= 0.9) {
      runtime.state.roadmapProgress[mode][selected.id] = Math.min(3, oldPasses + 1);
      playFeedbackSound('correct');
      if (oldPasses < 3 && runtime.state.roadmapProgress[mode][selected.id] >= 3) {
        playFeedbackSound('phrase-complete');
        showCelebration('✅ Phrase mastered!');
      }
    }

    if (activeCategory && !categoryWasComplete && isCategoryComplete(activeCategory, mode)) {
      playFeedbackSound('category-complete');
      showCelebration('🎉 Category complete! Next category unlocked.');
    }

    runtime.feedbackPhraseId = selected.id;
    runtime.feedbackHtml = `<p><strong>Recognition:</strong> ${escapeHtml(heard.transcript || '—')}</p><p><strong>Match:</strong> ${Math.round(
      similarity * 100
    )}% · ${label}</p><div><strong>Token diff:</strong> ${diff}</div><p><strong>Roadmap progress:</strong> ${Math.min(
      3,
      getPhrasePasses(selected.id)
    )}/3 successful runs at least 90% (${mode})</p><p><strong>Hint:</strong> ${escapeHtml(getPronunciationHint(selected.it, heard.transcript))}</p>`;

    updateStreak(runtime.state);
    saveState(runtime.state);
  } catch (error) {
    runtime.message = error instanceof Error ? error.message : 'Recognition failed. Please try again.';
  } finally {
    runtime.recording = false;
    render();
  }
}

function renderLanding(): string {
  return renderLandingSection({ isPhrasesUnlocked: isPhrasesModeUnlocked(), showInstall: Boolean(runtime.installPrompt) });
}

function getPhrasesSubmodeTopbarActions() {
  return [
    { id: 'go-home', label: 'Home' },
    { id: 'go-roadmap', label: 'Roadmap' },
    { id: 'go-phrases', label: 'Phrases' },
    { id: 'go-detailed', label: 'Practice' }
  ];
}

function renderPhrasesHome(): string {
  const promptUnlocked = isPhrasesSubModeUnlocked('prompt');
  const responseUnlocked = isPhrasesSubModeUnlocked('response');
  const convoUnlocked = isPhrasesSubModeUnlocked('convo');

  return `${renderTopbar({
    title: 'Phrases Mode',
    subtitleHtml: 'Unlock Prompt → Response → Convo by completing each stage in order.',
    actions: [
      { id: 'go-home', label: 'Home' },
      { id: 'go-roadmap', label: 'Roadmap' },
      { id: 'go-detailed', label: 'Practice' }
    ]
  })}<section class="card"><h2>Conversation Practice</h2><div class="landing-actions"><button id="phr-open-prompt" class="btn btn--accent" ${
    promptUnlocked ? '' : 'disabled'
  }>Prompt ${promptUnlocked ? '' : '🔒'}</button><button id="phr-open-response" class="btn btn--ghost" ${
    responseUnlocked ? '' : 'disabled'
  }>Response ${responseUnlocked ? '' : '🔒'}</button><button id="phr-open-convo" class="btn btn--ghost" ${
    convoUnlocked ? '' : 'disabled'
  }>Convo ${convoUnlocked ? '' : '🔒'}</button></div><p class="section-note">Roadmap must be fully completed before this mode unlocks.</p></section>`;
}

function renderPromptMode(): string {
  const categories = getPromptCategories();
  const activeCategory = categories.find((category) => category.id === runtime.promptCategoryId) ?? categories[0];
  if (activeCategory && runtime.promptCategoryId !== activeCategory.id) initializePromptCategory(activeCategory.id);
  if (!activeCategory) return '<section class="card"><p>No prompt content available.</p></section>';

  const currentCategory = activeCategory;
  const completed = new Set(runtime.state.phrasesProgress.promptCompletedCategories);
  const currentUnit = currentCategory.units[runtime.promptLearnIndex];
  const unitsById = new Map(currentCategory.units.map((unit) => [unit.id, unit]));

  const promptLearnProgressLabel = progressLabel(runtime.promptLearnIndex, currentCategory.units.length);
  const matchComplete = runtime.promptMatchedIds.size === currentCategory.units.length;
  const promptNextTarget = completed.has(currentCategory.id) ? getNextExerciseTarget('prompt', currentCategory.id) : null;
  const promptItemLabel =
    runtime.promptPhase === 'learn' ? promptLearnProgressLabel : `${runtime.promptMatchedIds.size}/${currentCategory.units.length}`;
  const promptStatusLabel =
    runtime.promptPhase === 'learn'
      ? 'Learning'
      : matchComplete
      ? 'Complete'
      : 'Matching';

  return `${renderTopbar({
    title: 'Prompt',
    subtitleHtml: 'Learn each phrase, then complete the audio-to-English matching challenge.',
    actions: getPhrasesSubmodeTopbarActions()
  })}${renderPhrasesCategoryPath(
    'prompt',
    currentCategory.id
  )}${renderPhrasesCurrentStateCard({
    categoryName: currentCategory.name,
    itemLabel: promptItemLabel,
    statusLabel: promptStatusLabel
  })}<section class="card"><h2>${escapeHtml(
    currentCategory.name
  )}</h2>${
    runtime.promptPhase === 'learn'
      ? currentUnit
        ? `<p class="section-note">Phrase ${promptLearnProgressLabel}</p><p class="practice-it">${escapeHtml(currentUnit.it)}</p><p class="practice-en">${escapeHtml(
            currentUnit.en
          )}</p><div class="practice-actions"><button id="prompt-listen" class="btn">Play Audio</button><button id="prompt-next" class="btn btn--accent">${
            runtime.promptLearnIndex >= currentCategory.units.length - 1 ? 'Start Match Game' : 'Next'
          }</button></div>`
        : '<p>No phrase found.</p>'
      : `<p class="section-note">Match each audio clip to its English translation. Any mistake resets the round.</p><div class="match-grid"><div><h3>Audio</h3><div class="match-list">${runtime.promptAudioOrder
          .map((unitId) => {
            const unit = unitsById.get(unitId);
            if (!unit) return '';
            const matched = runtime.promptMatchedIds.has(unitId);
            const selected = runtime.promptMatchAudioSelected === unitId;
            return `<button class="roadmap-phrase ${matched ? 'is-matched' : ''} ${selected ? 'is-active' : ''}" data-prompt-match-audio="${unitId}" ${
              matched ? 'disabled' : ''
            }>🔊 Audio ${matched ? '✅' : ''}</button>`;
          })
          .join('')}</div></div><div><h3>English</h3><div class="match-list">${runtime.promptEnglishOrder
          .map((unitId) => {
            const unit = unitsById.get(unitId);
            if (!unit) return '';
            const matched = runtime.promptMatchedIds.has(unitId);
            const selected = runtime.promptMatchEnglishSelected === unitId;
            return `<button class="roadmap-phrase ${matched ? 'is-matched' : ''} ${selected ? 'is-active' : ''}" data-prompt-match-english="${unitId}" ${
              matched ? 'disabled' : ''
            }>${escapeHtml(unit.en)}</button>`;
          })
          .join('')}</div></div></div>${
          matchComplete
            ? `<p class="message">Category complete.</p>${
                promptNextTarget
                  ? `<div class="practice-actions"><button class="btn btn--accent" data-next-stage="${promptNextTarget.stage}" data-next-category="${promptNextTarget.categoryId}">Next</button></div>`
                  : ''
              }`
            : ''
        }`
  }${runtime.message ? `<p class="message">${escapeHtml(runtime.message)}</p>` : ''}</section>`;
}

function renderResponseMode(): string {
  const categories = getResponseCategories();
  const activeCategory = categories.find((category) => category.id === runtime.responseCategoryId) ?? categories[0];
  if (activeCategory && runtime.responseCategoryId !== activeCategory.id) initializeResponseCategory(activeCategory.id);
  if (!activeCategory) return '<section class="card"><p>No response content available.</p></section>';

  const currentCategory = activeCategory;
  const completed = new Set(runtime.state.phrasesProgress.responseCompletedCategories);
  const learnUnit = currentCategory.units[runtime.responseLearnIndex];
  const speakUnit = currentCategory.units[runtime.responseSpeakIndex];
  const unitsById = new Map(currentCategory.units.map((unit) => [unit.id, unit]));
  const responseNextTarget = completed.has(currentCategory.id) ? getNextExerciseTarget('response', currentCategory.id) : null;
  const responsePhaseLabel =
    runtime.responsePhase === 'learn' ? 'Learn' : runtime.responsePhase === 'match' ? 'Match' : 'Speak';
  const responseLearnProgressLabel = progressLabel(runtime.responseLearnIndex, currentCategory.units.length);
  const responseSpeakProgressLabel = progressLabel(runtime.responseSpeakIndex, currentCategory.units.length);
  const responseItemLabel =
    runtime.responsePhase === 'learn'
      ? responseLearnProgressLabel
      : runtime.responsePhase === 'match'
      ? `${runtime.responseMatchedIds.size}/${currentCategory.units.length}`
      : responseSpeakProgressLabel;
  const responseStatusLabel =
    runtime.responsePhase === 'learn'
      ? 'Learning'
      : runtime.responsePhase === 'match'
      ? runtime.responseMatchedIds.size >= currentCategory.units.length
        ? 'Complete'
        : 'Matching'
      : !speakUnit
      ? 'Complete'
      : runtime.recording
      ? 'Listening'
      : 'Ready';

  return `${renderTopbar({
    title: 'Response',
    subtitleHtml: 'Learn responses, pass matching, then complete speaking challenges.',
    actions: getPhrasesSubmodeTopbarActions()
  })}${renderPhrasesCategoryPath(
    'response',
    currentCategory.id
  )}${renderPhrasesCurrentStateCard({
    categoryName: currentCategory.name,
    phaseLabel: responsePhaseLabel,
    itemLabel: responseItemLabel,
    statusLabel: responseStatusLabel
  })}<section class="card"><h2>${escapeHtml(currentCategory.name)}</h2>${
    runtime.responsePhase === 'learn'
      ? learnUnit
        ? `<p class="section-note">Response ${responseLearnProgressLabel}</p><p class="practice-it">${escapeHtml(
            learnUnit.it
          )}</p><p class="practice-en">${escapeHtml(learnUnit.en)}</p><div class="practice-actions"><button id="response-listen" class="btn">Play Audio</button><button id="response-next" class="btn btn--accent">${
            runtime.responseLearnIndex >= currentCategory.units.length - 1 ? 'Start Match Game' : 'Next'
          }</button></div>`
        : '<p>No response found.</p>'
      : runtime.responsePhase === 'match'
      ? `<p class="section-note">Match each response audio to English. Any mistake resets the round.</p><div class="match-grid"><div><h3>Audio</h3><div class="match-list">${runtime.responseAudioOrder
          .map((unitId) => {
            const unit = unitsById.get(unitId);
            if (!unit) return '';
            const matched = runtime.responseMatchedIds.has(unitId);
            const selected = runtime.responseMatchAudioSelected === unitId;
            return `<button class="roadmap-phrase ${matched ? 'is-matched' : ''} ${selected ? 'is-active' : ''}" data-response-match-audio="${unitId}" ${
              matched ? 'disabled' : ''
            }>🔊 Audio ${matched ? '✅' : ''}</button>`;
          })
          .join('')}</div></div><div><h3>English</h3><div class="match-list">${runtime.responseEnglishOrder
          .map((unitId) => {
            const unit = unitsById.get(unitId);
            if (!unit) return '';
            const matched = runtime.responseMatchedIds.has(unitId);
            const selected = runtime.responseMatchEnglishSelected === unitId;
            return `<button class="roadmap-phrase ${matched ? 'is-matched' : ''} ${selected ? 'is-active' : ''}" data-response-match-english="${unitId}" ${
              matched ? 'disabled' : ''
            }>${escapeHtml(unit.en)}</button>`;
          })
          .join('')}</div></div></div>`
      : speakUnit
      ? `<p class="section-note">Speaking challenge ${responseSpeakProgressLabel}</p><p class="practice-en">${escapeHtml(
          speakUnit.en
        )}</p><p class="section-note">Say the Italian response 3 times with at least 70% accuracy to pass this item.</p><p><strong>Passes:</strong> ${runtime.responseSpeakPasses}/3</p><div class="practice-actions"><button id="response-speak" class="btn btn--accent ${
          runtime.recording ? 'is-recording' : ''
        }">${runtime.recording ? 'Listening…' : 'Speak Now'}</button></div>`
      : `<p>Category complete.</p>${
          responseNextTarget
            ? `<div class="practice-actions"><button class="btn btn--accent" data-next-stage="${responseNextTarget.stage}" data-next-category="${responseNextTarget.categoryId}">Next</button></div>`
            : ''
        }`
  }${runtime.message ? `<p class="message">${escapeHtml(runtime.message)}</p>` : ''}</section>`;
}

function renderConvoMode(): string {
  const categories = getConvoCategories();
  const activeCategory = categories.find((category) => category.id === runtime.convoCategoryId) ?? categories[0];
  if (activeCategory && runtime.convoCategoryId !== activeCategory.id) initializeConvoCategory(activeCategory.id);
  if (!activeCategory) return '<section class="card"><p>No convo content available.</p></section>';

  const currentCategory = activeCategory;
  const completed = new Set(runtime.state.phrasesProgress.convoCompletedCategories);
  const currentUnit = currentCategory.units[runtime.convoSpeakIndex];
  const convoNextTarget = completed.has(currentCategory.id) ? getNextExerciseTarget('convo', currentCategory.id) : null;
  const convoItemLabel = progressLabel(runtime.convoSpeakIndex, currentCategory.units.length);
  const convoStatusLabel = runtime.recording ? 'Listening' : currentUnit ? 'Ready' : 'Complete';

  return `${renderTopbar({
    title: 'Convo',
    subtitleHtml: 'Listen to the prompt audio and respond in Italian with at least 70% accuracy.',
    actions: getPhrasesSubmodeTopbarActions()
  })}${renderPhrasesCategoryPath(
    'convo',
    currentCategory.id
  )}${renderPhrasesCurrentStateCard({
    categoryName: currentCategory.name,
    phaseLabel: 'Speak',
    itemLabel: convoItemLabel,
    statusLabel: convoStatusLabel
  })}<section class="card"><h2>${escapeHtml(
    currentCategory.name
  )}</h2>${
    currentUnit
      ? `<p class="section-note"><strong>Current prompt:</strong> ${escapeHtml(
          currentUnit.promptIt
        )}</p><div class="practice-actions"><button id="convo-listen-prompt" class="btn" ${
          runtime.recording ? 'disabled' : ''
        }>Play Audio</button></div><p class="practice-en"><strong>Expected intent (English):</strong> ${escapeHtml(
          currentUnit.responseEn
        )}</p><div class="practice-actions"><button id="convo-speak" class="btn btn--accent ${
          runtime.recording ? 'is-recording' : ''
        }">${runtime.recording ? 'Listening…' : 'Speak Now'}</button></div>`
      : `<p>Category complete.</p>${
          convoNextTarget
            ? `<div class="practice-actions"><button class="btn btn--accent" data-next-stage="${convoNextTarget.stage}" data-next-category="${convoNextTarget.categoryId}">Next</button></div>`
            : ''
        }`
  }${runtime.message ? `<p class="message">${escapeHtml(runtime.message)}</p>` : ''}</section>`;
}

function renderRoadmap(): string {
  const mode = runtime.activeDifficulty;
  const ordered = getOrderedCategories();
  const firstUnlocked = getFirstUnlockedCategory(mode);
  const activeCategory = ordered.find((cat) => cat.id === runtime.activeRoadmapCategoryId) ?? firstUnlocked;

  if (activeCategory && runtime.activeRoadmapCategoryId !== activeCategory.id) runtime.activeRoadmapCategoryId = activeCategory.id;

  const activePhrases = getLoadedPhrases().filter((phrase) => phrase.categoryId === runtime.activeRoadmapCategoryId).sort((a, b) => getPhraseIndex(a.id) - getPhraseIndex(b.id));
  const selected = activePhrases.find((phrase) => phrase.id === runtime.selectedPhraseId) ?? activePhrases[0];
  if (selected) runtime.selectedPhraseId = selected.id;
  const selectedFeedback = getSelectedFeedback(selected?.id);
  const completion = activeCategory ? getCategoryCompletion(activeCategory, mode) : { complete: 0, total: 0, percent: 0 };
  const selectedPasses = selected ? getPhrasePasses(selected.id) : 0;
  const selectedStep = selected ? getPhraseIndex(selected.id) + 1 : 0;
  const roadmapNextTarget = selected && selectedPasses >= 3 ? getNextRoadmapTarget(mode, selected.categoryId, selected.id) : null;

  return `${renderTopbar({
    title: `Roadmap Learning (${mode[0].toUpperCase() + mode.slice(1)})`,
    subtitleHtml: 'Progress through categories in order. Each phrase needs 3 successful runs at least 90%.',
    actions: [
      { id: 'go-home', label: 'Home' },
      { id: 'go-phrases', label: `Phrases ${isPhrasesModeUnlocked() ? '' : '🔒'}`, disabled: !isPhrasesModeUnlocked() },
      { id: 'go-detailed', label: 'Practice' }
    ]
  })}<section class="mode-switch card"><h2>Difficulty</h2><div class="chips"><button class="chip ${
    mode === 'easy' ? 'is-active' : ''
  }" data-mode="easy">Easy ${isModeUnlocked('easy') ? '' : '🔒'}</button><button class="chip ${mode === 'intermediate' ? 'is-active' : ''}" data-mode="intermediate" ${
    isModeUnlocked('intermediate') ? '' : 'disabled'
  }>Intermediate ${isModeUnlocked('intermediate') ? '' : '🔒'}</button><button class="chip ${mode === 'hard' ? 'is-active' : ''}" data-mode="hard" ${
    isModeUnlocked('hard') ? '' : 'disabled'
  }>Hard ${isModeUnlocked('hard') ? '' : '🔒'}</button></div><p class="section-note">Unlock Intermediate by completing all Easy phrases. Unlock Hard by completing all Intermediate phrases.</p></section>

  <section class="card roadmap-state"><h2>Current State</h2><p><strong>Category:</strong> ${escapeHtml(activeCategory?.name ?? '—')} · <strong>Progress:</strong> ${completion.complete}/${completion.total} (${completion.percent}%)</p><p><strong>Current Phrase:</strong> ${selectedStep}/${activePhrases.length} · <strong>Passes:</strong> ${selectedPasses}/3</p></section>

  <section class="roadmap-panels">
    <details class="card roadmap-panel"><summary>Category Path</summary><div class="roadmap-list">${ordered
      .map((cat, index) => roadmapCategoryMarkup(cat, index, ordered, mode))
      .join('')}</div></details>

    <details class="card roadmap-panel"><summary>Category Phrases</summary><div class="roadmap-phrases">${activePhrases
      .map((phrase) => {
        const passes = getPhrasePasses(phrase.id);
        const done = passes >= 3;
        const phraseIndex = getPhraseIndex(phrase.id);
        const unlocked = done || isRoadmapPhraseUnlocked(phrase.categoryId, phraseIndex, mode);
        return `<button class="roadmap-phrase ${runtime.selectedPhraseId === phrase.id ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}" data-roadmap-phrase="${phrase.id}" ${
          unlocked ? '' : 'disabled'
        }><span>${escapeHtml(mode === 'hard' ? phrase.en : phrase.it)}</span><span>${done ? '✅' : unlocked ? `${passes}/3` : '🔒'}</span></button>`;
      })
      .join('')}</div></details>

    <details class="card roadmap-panel" open><summary>Practice</summary>${
      selected
        ? `<div class="practice-compact">${mode === 'hard' ? '' : `<p class="practice-it">${escapeHtml(selected.it)}</p>`}<p class="practice-en">${escapeHtml(
            selected.en
          )}</p>${mode === 'hard' ? '' : `<p class="practice-ipa">/ ${escapeHtml(toIpaHint(selected.it))} /</p>`}<div class="practice-actions">${
            mode === 'easy' ? '<button id="speak-btn" class="btn" aria-label="Play audio pronunciation">Play Audio</button>' : ''
          }<button id="record-btn" class="btn btn--accent ${runtime.recording ? 'is-recording' : ''}" aria-label="Record pronunciation">${
            runtime.recording ? 'Listening…' : 'Speak Now'
          }</button>${
            roadmapNextTarget
              ? `<button class="btn btn--ghost" data-roadmap-next-mode="${roadmapNextTarget.mode}" data-roadmap-next-category="${roadmapNextTarget.categoryId}" data-roadmap-next-phrase="${roadmapNextTarget.phraseId}">Next</button>`
              : ''
          }</div><div class="feedback" id="feedback">${selectedFeedback || FEEDBACK_PLACEHOLDER_HTML}</div></div>`
        : '<p>No phrase loaded yet.</p>'
    }</details>
  </section>`;
}

function renderDetailed(): string {
  const due = getLoadedPhrases().filter((phrase) => isDue(runtime.state.srs[phrase.id] ?? createInitialCard()));
  const overdueCount = due.filter((phrase) => overdueDays(runtime.state.srs[phrase.id] ?? createInitialCard()) > 0).length;

  const visible = getVisiblePhrases();
  const loadedPhrases = getLoadedPhrases();
  const selected = loadedPhrases.find((item) => item.id === runtime.selectedPhraseId) ?? visible[0] ?? loadedPhrases[0];
  const selectedFeedback = getSelectedFeedback(selected?.id);
  if (selected) runtime.selectedPhraseId = selected.id;

  return `${renderTopbar({
    title: 'Detailed Practice',
    subtitleHtml: `Streak: <strong>${runtime.state.streak}</strong> · Due: <strong>${due.length}</strong> · Overdue: <strong>${overdueCount}</strong>`,
    role: 'banner',
    actions: [
      { id: 'go-home', label: 'Home' },
      { id: 'go-roadmap', label: 'Roadmap' },
      { id: 'go-phrases', label: `Phrases ${isPhrasesModeUnlocked() ? '' : '🔒'}`, disabled: !isPhrasesModeUnlocked() },
      {
        id: 'settings-toggle',
        variant: 'icon',
        ariaLabel: 'Settings',
        ariaExpanded: 'false',
        ariaControls: 'settings-panel',
        iconUseHref: '/assets/icons.svg#settings'
      }
    ]
  })}<section class="controls" aria-label="Phrase controls"><input id="search" type="search" value="${escapeHtml(
    runtime.search
  )}" placeholder="Search Italian or English" aria-label="Search phrases" /><label class="sort-control">Sort phrases<select id="sort-select" aria-label="Sort phrases"><option value="relevance" ${
    runtime.sortMode === 'relevance' ? 'selected' : ''
  }>Best match</option><option value="least-progress" ${runtime.sortMode === 'least-progress' ? 'selected' : ''}>Least progress first</option><option value="most-progress" ${
    runtime.sortMode === 'most-progress' ? 'selected' : ''
  }>Most progress first</option></select></label><div class="chips" role="tablist" aria-label="Filter phrases">${['all', 'needs', 'mastered', 'difficult']
    .map(
      (key) =>
        `<button class="chip ${runtime.filter === key ? 'is-active' : ''}" data-filter="${key}" role="tab" aria-selected="${runtime.filter === key}">${
          key === 'all' ? 'All' : key === 'needs' ? 'Needs Practice' : key[0].toUpperCase() + key.slice(1)
        }</button>`
    )
    .join('')}</div><div class="categories" role="tablist" aria-label="Categories"><button class="chip ${
    runtime.selectedCategory === 'all' ? 'is-active' : ''
  }" data-category="all">All</button>${runtime.categories
    .map((cat) => `<button class="chip ${runtime.selectedCategory === cat.id ? 'is-active' : ''}" data-category="${cat.id}">${escapeHtml(cat.name)}</button>`)
    .join('')}</div></section><main class="content" role="main"><section class="library card" aria-label="Phrase library"><h2>Phrase Library</h2><div class="phrase-list" id="phrase-list">${visible
    .map(phraseItemMarkup)
    .join('')}</div></section><section class="practice card" aria-label="Pronunciation practice"><h2>Pronunciation Practice</h2>${
    selected
      ? `<p class="practice-it">${escapeHtml(selected.it)}</p><p class="practice-en">${escapeHtml(selected.en)}</p><p class="practice-ipa">/ ${escapeHtml(
          toIpaHint(selected.it)
        )} /</p><div class="practice-actions"><button id="speak-btn" class="btn">Play Audio</button><button id="record-btn" class="btn btn--accent ${
          runtime.recording ? 'is-recording' : ''
        }">${runtime.recording ? 'Listening…' : 'Speak Now'}</button></div>`
      : '<p>No phrase available with current filters.</p>'
  }<div class="record-wave ${runtime.recording ? 'is-active' : ''}" aria-hidden="true"><span></span><span></span><span></span></div><div class="feedback" id="feedback">${
    selectedFeedback || FEEDBACK_PLACEHOLDER_HTML
  }</div>${runtime.message ? `<p class="message">${escapeHtml(runtime.message)}</p>` : ''}</section></main><aside id="settings-panel" class="settings card" hidden aria-label="Settings panel"><h2>Settings</h2><label><span>Theme</span><select id="theme-select" aria-label="Theme"><option value="dark" ${
    runtime.state.settings.theme === 'dark' ? 'selected' : ''
  }>Dark</option><option value="light" ${runtime.state.settings.theme === 'light' ? 'selected' : ''}>Light</option></select></label><label class="switch"><input id="contrast-toggle" type="checkbox" ${
    runtime.state.settings.highContrast ? 'checked' : ''
  } /> High contrast</label><label><span>Font size</span><input id="font-range" type="range" min="0.9" max="1.25" step="0.05" value="${
    runtime.state.settings.fontScale
  }" aria-label="Font size" /></label><button id="reset-btn" class="btn btn--danger" aria-label="Reset local data">Reset all progress</button></aside>`;
}

function render(): void {
  const content =
    runtime.viewMode === 'roadmap'
      ? renderRoadmap()
      : runtime.viewMode === 'detailed'
      ? renderDetailed()
      : runtime.viewMode === 'phrases-home'
      ? renderPhrasesHome()
      : runtime.viewMode === 'phrases-prompt'
      ? renderPromptMode()
      : runtime.viewMode === 'phrases-response'
      ? renderResponseMode()
      : runtime.viewMode === 'phrases-convo'
      ? renderConvoMode()
      : renderLanding();
  appRoot.innerHTML = `<div class="app-shell">${content}${runtime.celebration ? `<div class="celebration">${escapeHtml(runtime.celebration)} ✨</div>` : ''}</div>`;

  const searchInput = appRoot.querySelector<HTMLInputElement>('#search');
  if (runtime.keepSearchFocus && searchInput) {
    searchInput.focus();
    searchInput.setSelectionRange(runtime.searchSelectionStart, runtime.searchSelectionEnd);
    runtime.keepSearchFocus = false;
  }
}

function saveAndRender(): void {
  saveState(runtime.state);
  render();
}

function handleNavigationClick(target: HTMLElement): boolean {
  if (target.closest('#go-home')) {
    runtime.viewMode = 'landing';
    render();
    return true;
  }

  if (target.closest('#go-roadmap')) {
    runtime.viewMode = 'roadmap';
    const next = getFirstUnlockedCategory(runtime.activeDifficulty);
    runAndRender(next ? chooseRoadmapCategory(next.id, runtime.activeDifficulty) : undefined);
    return true;
  }

  if (target.closest('#go-phrases')) {
    if (!isPhrasesModeUnlocked()) {
      runtime.message = 'Complete all Roadmap phrases through Hard mode to unlock Phrases mode.';
      render();
      return true;
    }

    runtime.viewMode = 'phrases-home';
    runtime.message = '';
    render();
    return true;
  }

  if (target.closest('#phr-home')) {
    runtime.viewMode = 'phrases-home';
    runtime.message = '';
    render();
    return true;
  }

  if (target.closest('#phr-open-prompt')) {
    if (!isPhrasesSubModeUnlocked('prompt')) {
      runtime.message = 'Prompt is locked.';
      render();
      return true;
    }
    const categoryId = getFirstUnlockedPhrasesCategoryId('prompt');
    if (categoryId) initializePromptCategory(categoryId);
    runtime.viewMode = 'phrases-prompt';
    render();
    return true;
  }

  if (target.closest('#phr-open-response')) {
    if (!isPhrasesSubModeUnlocked('response')) {
      runtime.message = 'Complete all Prompt categories to unlock Response.';
      render();
      return true;
    }
    const categoryId = getFirstUnlockedPhrasesCategoryId('response');
    if (categoryId) initializeResponseCategory(categoryId);
    runtime.viewMode = 'phrases-response';
    render();
    return true;
  }

  if (target.closest('#phr-open-convo')) {
    if (!isPhrasesSubModeUnlocked('convo')) {
      runtime.message = 'Complete all Response categories to unlock Convo.';
      render();
      return true;
    }
    const categoryId = getFirstUnlockedPhrasesCategoryId('convo');
    if (categoryId) initializeConvoCategory(categoryId);
    runtime.viewMode = 'phrases-convo';
    render();
    return true;
  }

  const modeBtn = target.closest<HTMLElement>('[data-mode]');
  if (modeBtn?.dataset.mode) {
    const nextMode = modeBtn.dataset.mode as DifficultyMode;
    if (!isModeUnlocked(nextMode)) {
      runtime.message = getModeUnlockMessage(nextMode);
      render();
      return true;
    }

    runtime.activeDifficulty = nextMode;
    clearPracticeFeedback();

    const nextCategory = getFirstUnlockedCategory(nextMode);
    runAndRender(nextCategory ? chooseRoadmapCategory(nextCategory.id, nextMode) : undefined);
    return true;
  }

  if (target.closest('#go-detailed')) {
    runtime.viewMode = 'detailed';
    runAndRender(ensureAllCategoriesLoaded());
    return true;
  }

  return false;
}

function handleSelectionClick(target: HTMLElement): boolean {
  const roadmapCategoryBtn = target.closest<HTMLElement>('[data-roadmap-category]');
  if (roadmapCategoryBtn?.dataset.roadmapCategory) {
    runAndRender(chooseRoadmapCategory(roadmapCategoryBtn.dataset.roadmapCategory, runtime.activeDifficulty));
    return true;
  }

  const roadmapPhraseBtn = target.closest<HTMLElement>('[data-roadmap-phrase]');
  if (roadmapPhraseBtn?.dataset.roadmapPhrase) {
    runtime.selectedPhraseId = roadmapPhraseBtn.dataset.roadmapPhrase;
    clearPracticeFeedback();
    render();
    return true;
  }

  const phraseBtn = target.closest<HTMLElement>('[data-phrase-id]');
  if (phraseBtn?.dataset.phraseId) {
    if (runtime.selectedPhraseId !== phraseBtn.dataset.phraseId) {
      clearPracticeFeedback({ clearMessage: true });
    }
    runtime.selectedPhraseId = phraseBtn.dataset.phraseId;
    render();
    return true;
  }

  const filterBtn = target.closest<HTMLElement>('[data-filter]');
  if (filterBtn?.dataset.filter) {
    runtime.filter = filterBtn.dataset.filter as FilterMode;
    render();
    return true;
  }

  const categoryBtn = target.closest<HTMLElement>('[data-category]');
  if (categoryBtn?.dataset.category) {
    clearPracticeFeedback({ clearMessage: true });
    runtime.selectedCategory = categoryBtn.dataset.category;
    if (runtime.selectedCategory !== 'all' && !runtime.loadedCategories.has(runtime.selectedCategory)) {
      runAndRender(ensureCategoryLoaded(runtime.selectedCategory));
    } else {
      render();
    }
    return true;
  }

  const promptCategoryBtn = target.closest<HTMLElement>('[data-prompt-category]');
  if (promptCategoryBtn?.dataset.promptCategory) {
    const categories = getPromptCategories();
    const index = categories.findIndex((category) => category.id === promptCategoryBtn.dataset.promptCategory);
    if (index >= 0 && isPhrasesCategoryUnlocked('prompt', index)) {
      initializePromptCategory(promptCategoryBtn.dataset.promptCategory);
      render();
    }
    return true;
  }

  const responseCategoryBtn = target.closest<HTMLElement>('[data-response-category]');
  if (responseCategoryBtn?.dataset.responseCategory) {
    const categories = getResponseCategories();
    const index = categories.findIndex((category) => category.id === responseCategoryBtn.dataset.responseCategory);
    if (index >= 0 && isPhrasesCategoryUnlocked('response', index)) {
      initializeResponseCategory(responseCategoryBtn.dataset.responseCategory);
      render();
    }
    return true;
  }

  const convoCategoryBtn = target.closest<HTMLElement>('[data-convo-category]');
  if (convoCategoryBtn?.dataset.convoCategory) {
    const categories = getConvoCategories();
    const index = categories.findIndex((category) => category.id === convoCategoryBtn.dataset.convoCategory);
    if (index >= 0 && isPhrasesCategoryUnlocked('convo', index)) {
      initializeConvoCategory(convoCategoryBtn.dataset.convoCategory);
      render();
    }
    return true;
  }

  const promptAudioBtn = target.closest<HTMLElement>('[data-prompt-match-audio]');
  if (promptAudioBtn?.dataset.promptMatchAudio) {
    const unitId = promptAudioBtn.dataset.promptMatchAudio;
    if (!runtime.promptMatchedIds.has(unitId)) {
      const category = getPromptCategories().find((item) => item.id === runtime.promptCategoryId);
      const unit = category?.units.find((item) => item.id === unitId);
      if (unit) {
        speakItalian(unit.it).catch((error) => {
          runtime.message = error instanceof Error ? error.message : ERROR_PLAYBACK_UNAVAILABLE;
          render();
        });
      }
      runtime.promptMatchAudioSelected = unitId;
      handlePromptMatchSelection();
      render();
    }
    return true;
  }

  const promptEnglishBtn = target.closest<HTMLElement>('[data-prompt-match-english]');
  if (promptEnglishBtn?.dataset.promptMatchEnglish) {
    const unitId = promptEnglishBtn.dataset.promptMatchEnglish;
    if (!runtime.promptMatchedIds.has(unitId)) {
      runtime.promptMatchEnglishSelected = unitId;
      handlePromptMatchSelection();
      render();
    }
    return true;
  }

  const responseAudioBtn = target.closest<HTMLElement>('[data-response-match-audio]');
  if (responseAudioBtn?.dataset.responseMatchAudio) {
    const unitId = responseAudioBtn.dataset.responseMatchAudio;
    if (!runtime.responseMatchedIds.has(unitId)) {
      const category = getResponseCategories().find((item) => item.id === runtime.responseCategoryId);
      const unit = category?.units.find((item) => item.id === unitId);
      if (unit) {
        speakItalian(unit.it).catch((error) => {
          runtime.message = error instanceof Error ? error.message : ERROR_PLAYBACK_UNAVAILABLE;
          render();
        });
      }
      runtime.responseMatchAudioSelected = unitId;
      handleResponseMatchSelection();
      render();
    }
    return true;
  }

  const responseEnglishBtn = target.closest<HTMLElement>('[data-response-match-english]');
  if (responseEnglishBtn?.dataset.responseMatchEnglish) {
    const unitId = responseEnglishBtn.dataset.responseMatchEnglish;
    if (!runtime.responseMatchedIds.has(unitId)) {
      runtime.responseMatchEnglishSelected = unitId;
      handleResponseMatchSelection();
      render();
    }
    return true;
  }

  return false;
}

function handlePracticeClick(target: HTMLElement): boolean {
  const roadmapNextBtn = target.closest<HTMLElement>('[data-roadmap-next-mode][data-roadmap-next-category][data-roadmap-next-phrase]');
  if (roadmapNextBtn?.dataset.roadmapNextMode && roadmapNextBtn.dataset.roadmapNextCategory && roadmapNextBtn.dataset.roadmapNextPhrase) {
    const nextMode = roadmapNextBtn.dataset.roadmapNextMode;
    if (nextMode === 'easy' || nextMode === 'intermediate' || nextMode === 'hard') {
      runAndRender(
        goToRoadmapTarget({
          mode: nextMode,
          categoryId: roadmapNextBtn.dataset.roadmapNextCategory,
          phraseId: roadmapNextBtn.dataset.roadmapNextPhrase
        })
      );
      return true;
    }
  }

  const nextExerciseBtn = target.closest<HTMLElement>('[data-next-stage][data-next-category]');
  if (nextExerciseBtn?.dataset.nextStage && nextExerciseBtn.dataset.nextCategory) {
    const nextStage = nextExerciseBtn.dataset.nextStage;
    if (nextStage === 'prompt' || nextStage === 'response' || nextStage === 'convo') {
      goToPhrasesExerciseTarget({ stage: nextStage, categoryId: nextExerciseBtn.dataset.nextCategory });
      render();
      return true;
    }
  }

  if (target.closest('#speak-btn')) {
    const selected = runtime.phraseMap.get(runtime.selectedPhraseId);
    if (selected) {
      speakItalian(selected.it).catch((error) => {
        runtime.message = error instanceof Error ? error.message : ERROR_PLAYBACK_UNAVAILABLE;
        render();
      });
    }
    return true;
  }

  if (target.closest('#record-btn')) {
    handlePronunciationPractice().catch(() => {
      runtime.message = ERROR_RECORDING_UNEXPECTED;
      runtime.recording = false;
      render();
    });
    return true;
  }

  if (target.closest('#prompt-listen')) {
    const category = getPromptCategories().find((item) => item.id === runtime.promptCategoryId);
    const unit = category?.units[runtime.promptLearnIndex];
    if (unit) {
      speakItalian(unit.it).catch((error) => {
        runtime.message = error instanceof Error ? error.message : ERROR_PLAYBACK_UNAVAILABLE;
        render();
      });
    }
    return true;
  }

  if (target.closest('#prompt-next')) {
    const category = getPromptCategories().find((item) => item.id === runtime.promptCategoryId);
    if (category) {
      if (runtime.promptLearnIndex < category.units.length - 1) runtime.promptLearnIndex += 1;
      else runtime.promptPhase = 'match';
      runtime.message = '';
      render();
    }
    return true;
  }

  if (target.closest('#response-listen')) {
    const category = getResponseCategories().find((item) => item.id === runtime.responseCategoryId);
    const unit = category?.units[runtime.responseLearnIndex];
    if (unit) {
      speakItalian(unit.it).catch((error) => {
        runtime.message = error instanceof Error ? error.message : ERROR_PLAYBACK_UNAVAILABLE;
        render();
      });
    }
    return true;
  }

  if (target.closest('#response-next')) {
    const category = getResponseCategories().find((item) => item.id === runtime.responseCategoryId);
    if (category) {
      if (runtime.responseLearnIndex < category.units.length - 1) runtime.responseLearnIndex += 1;
      else runtime.responsePhase = 'match';
      runtime.message = '';
      render();
    }
    return true;
  }

  if (target.closest('#response-speak')) {
    void handleResponseSpeakingChallenge();
    return true;
  }

  if (target.closest('#convo-listen-prompt')) {
    const category = getConvoCategories().find((item) => item.id === runtime.convoCategoryId);
    const unit = category?.units[runtime.convoSpeakIndex];
    if (unit) {
      speakItalian(unit.promptIt).catch((error) => {
        runtime.message = error instanceof Error ? error.message : ERROR_PLAYBACK_UNAVAILABLE;
        render();
      });
    }
    return true;
  }

  if (target.closest('#convo-speak')) {
    void handleConvoSpeakingChallenge();
    return true;
  }

  return false;
}

function handleSystemClick(target: HTMLElement): boolean {
  if (target.closest('#settings-toggle')) {
    const panel = appRoot.querySelector<HTMLElement>('#settings-panel');
    if (panel) panel.hidden = !panel.hidden;
    return true;
  }

  if (target.closest('#reset-btn')) {
    if (window.confirm('Reset all saved progress and preferences?')) {
      runtime.state = resetState();
      updateStreak(runtime.state);
      clearPracticeFeedback({ clearMessage: true });
      applySettings(runtime.state);
      render();
    }
    return true;
  }

  if (target.closest('#install-btn') && runtime.installPrompt) {
    runtime.installPrompt.prompt().catch(() => undefined);
    return true;
  }

  return false;
}

function handleInputEvent(target: HTMLElement, onSearch: (value: string) => void): boolean {
  if (target instanceof HTMLInputElement && target.id === 'search') {
    runtime.keepSearchFocus = true;
    runtime.searchSelectionStart = target.selectionStart ?? target.value.length;
    runtime.searchSelectionEnd = target.selectionEnd ?? target.value.length;
    onSearch(target.value);
    return true;
  }

  if (target instanceof HTMLInputElement && target.id === 'font-range') {
    runtime.state.settings.fontScale = Number(target.value);
    applySettings(runtime.state);
    saveAndRender();
    return true;
  }

  return false;
}

function handleChangeEvent(target: HTMLElement): boolean {
  if (target instanceof HTMLSelectElement && target.id === 'sort-select') {
    runtime.sortMode = target.value as SortMode;
    render();
    return true;
  }

  if (target instanceof HTMLSelectElement && target.id === 'theme-select') {
    runtime.state.settings.theme = target.value === 'light' ? 'light' : 'dark';
    applySettings(runtime.state);
    saveAndRender();
    return true;
  }

  if (target instanceof HTMLInputElement && target.id === 'contrast-toggle') {
    runtime.state.settings.highContrast = target.checked;
    applySettings(runtime.state);
    saveAndRender();
    return true;
  }

  return false;
}

function bindEventsOnce(): void {
  if (runtime.listenersBound) return;
  runtime.listenersBound = true;

  const onSearch = debounce((value: string) => {
    runtime.search = value;
    render();
  }, 180);

  appRoot.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;

    if (handleNavigationClick(target)) return;
    if (handleSelectionClick(target)) return;
    if (handlePracticeClick(target)) return;
    handleSystemClick(target);
  });

  addPassiveListener(appRoot, 'input', (event: Event) => {
    const target = event.target as HTMLElement;
    handleInputEvent(target, onSearch);
  });

  addPassiveListener(appRoot, 'change', (event: Event) => {
    const target = event.target as HTMLElement;
    handleChangeEvent(target);
  });
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  const registration = await navigator.serviceWorker.register('/sw.js');
  await registration.update();

  let didReloadOnControllerChange = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (didReloadOnControllerChange) return;
    didReloadOnControllerChange = true;
    location.reload();
  });

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        installing.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });
}

async function loadManifest(): Promise<void> {
  const response = await fetch('/phrases.json', { cache: 'force-cache' });
  const manifest = (await response.json()) as PhraseLibraryManifest;
  runtime.categories = manifest.categories;

  const ordered = getOrderedCategories();
  if (ordered.length) {
    await ensureCategoryLoaded(ordered[0].id);
    runtime.activeRoadmapCategoryId = ordered[0].id;
    const firstPhrase = getLoadedPhrases().find((phrase) => phrase.categoryId === ordered[0].id);
    if (firstPhrase) runtime.selectedPhraseId = firstPhrase.id;
  }

  const idleLoad = () => {
    void ensureAllCategoriesLoaded();
  };

  const win = window as Window & { requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number };
  if (typeof win.requestIdleCallback === 'function') win.requestIdleCallback(idleLoad, { timeout: 2000 });
  else window.setTimeout(idleLoad, 600);
}

function installGlobalGuards(): void {
  window.addEventListener('error', () => {
    runtime.message = ERROR_RUNTIME_UNEXPECTED;
    render();
  });

  window.addEventListener('unhandledrejection', () => {
    runtime.message = ERROR_RUNTIME_BACKGROUND;
    render();
  });
}

async function init(): Promise<void> {
  applySettings(runtime.state);
  updateStreak(runtime.state);
  bindEventsOnce();
  installGlobalGuards();

  await loadManifest();
  await loadFixedAudioManifest();
  saveState(runtime.state);

  window.addEventListener('beforeinstallprompt', (event: Event) => {
    event.preventDefault();
    runtime.installPrompt = event as BeforeInstallPromptEvent;
    render();
  });

  render();
  registerServiceWorker().catch(() => undefined);
}

init().catch((error) => {
  appRoot.innerHTML = `<div class="boot">Startup failed: ${escapeHtml(error instanceof Error ? error.message : 'Unknown error')}</div>`;
});
