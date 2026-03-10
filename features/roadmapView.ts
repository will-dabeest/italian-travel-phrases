import type { CategoryManifest, DifficultyMode, Phrase } from '../types';
import { toIpaHint } from '../utils/scoring';
import { renderRoadmapCategoryButton, renderTopbar } from '../ui/markup';
import { getNextRoadmapTarget, type RoadmapNextTarget } from './roadmap';

interface RenderRoadmapParams {
  mode: DifficultyMode;
  orderedCategories: CategoryManifest[];
  activeRoadmapCategoryId: string;
  selectedPhraseId: string;
  loadedPhrases: Phrase[];
  recording: boolean;
  isPhrasesModeUnlocked: () => boolean;
  isModeUnlocked: (mode: DifficultyMode) => boolean;
  getCategoryCompletion: (category: CategoryManifest, mode: DifficultyMode) => { complete: number; total: number; percent: number };
  isCategoryUnlocked: (index: number, ordered: CategoryManifest[], mode: DifficultyMode) => boolean;
  getPhrasePasses: (phraseId: string) => number;
  getPhraseIndex: (phraseId: string) => number;
  isRoadmapPhraseUnlocked: (categoryId: string, phraseIndex: number, mode: DifficultyMode) => boolean;
  getSelectedFeedback: (phraseId?: string) => string;
  feedbackPlaceholderHtml: string;
  escapeHtml: (value: string) => string;
  isModeUnlockedForProgression: (mode: DifficultyMode) => boolean;
  getFirstUnlockedCategory: (mode: DifficultyMode) => CategoryManifest | undefined;
}

interface RenderRoadmapResult {
  html: string;
  activeRoadmapCategoryId: string;
  selectedPhraseId: string;
}

interface HandleRoadmapSelectionClickParams {
  target: HTMLElement;
  activeDifficulty: DifficultyMode;
  chooseRoadmapCategory: (categoryId: string, mode: DifficultyMode) => Promise<void>;
  runAndRender: (task?: Promise<unknown>) => void;
  setSelectedPhraseId: (phraseId: string) => void;
  clearPracticeFeedback: (options?: { clearMessage?: boolean }) => void;
  render: () => void;
}

interface HandleRoadmapNextClickParams {
  target: HTMLElement;
  goToRoadmapTarget: (target: Exclude<RoadmapNextTarget, null>) => Promise<void>;
  runAndRender: (task?: Promise<unknown>) => void;
}

interface HandleRoadmapModeClickParams {
  target: HTMLElement;
  isModeUnlocked: (mode: DifficultyMode) => boolean;
  getModeUnlockMessage: (mode: DifficultyMode) => string;
  setMessage: (message: string) => void;
  render: () => void;
  setActiveDifficulty: (mode: DifficultyMode) => void;
  clearPracticeFeedback: () => void;
  getFirstUnlockedCategory: (mode: DifficultyMode) => CategoryManifest | undefined;
  chooseRoadmapCategory: (categoryId: string, mode: DifficultyMode) => Promise<void>;
  runAndRender: (task?: Promise<unknown>) => void;
}

interface HandleGoRoadmapClickParams {
  target: HTMLElement;
  activeDifficulty: DifficultyMode;
  setViewModeRoadmap: () => void;
  getFirstUnlockedCategory: (mode: DifficultyMode) => CategoryManifest | undefined;
  chooseRoadmapCategory: (categoryId: string, mode: DifficultyMode) => Promise<void>;
  runAndRender: (task?: Promise<unknown>) => void;
}

function renderRoadmapCategoryMarkup(params: {
  category: CategoryManifest;
  index: number;
  orderedCategories: CategoryManifest[];
  mode: DifficultyMode;
  activeRoadmapCategoryId: string;
  getCategoryCompletion: (category: CategoryManifest, mode: DifficultyMode) => { complete: number; total: number; percent: number };
  isCategoryUnlocked: (index: number, ordered: CategoryManifest[], mode: DifficultyMode) => boolean;
}): string {
  const { category, index, orderedCategories, mode, activeRoadmapCategoryId, getCategoryCompletion, isCategoryUnlocked } = params;
  const completion = getCategoryCompletion(category, mode);
  const unlocked = isCategoryUnlocked(index, orderedCategories, mode);

  return renderRoadmapCategoryButton({
    category,
    completion,
    isActive: activeRoadmapCategoryId === category.id,
    isUnlocked: unlocked
  });
}

export function renderRoadmapView(params: RenderRoadmapParams): RenderRoadmapResult {
  const {
    mode,
    orderedCategories,
    activeRoadmapCategoryId,
    selectedPhraseId,
    loadedPhrases,
    recording,
    isPhrasesModeUnlocked,
    isModeUnlocked,
    getCategoryCompletion,
    isCategoryUnlocked,
    getPhrasePasses,
    getPhraseIndex,
    isRoadmapPhraseUnlocked,
    getSelectedFeedback,
    feedbackPlaceholderHtml,
    escapeHtml,
    isModeUnlockedForProgression,
    getFirstUnlockedCategory
  } = params;

  const firstUnlocked = getFirstUnlockedCategory(mode);
  const activeCategory = orderedCategories.find((cat) => cat.id === activeRoadmapCategoryId) ?? firstUnlocked;
  const nextActiveRoadmapCategoryId = activeCategory?.id ?? activeRoadmapCategoryId;

  const activePhrases = loadedPhrases
    .filter((phrase) => phrase.categoryId === nextActiveRoadmapCategoryId)
    .sort((a, b) => getPhraseIndex(a.id) - getPhraseIndex(b.id));

  const selected = activePhrases.find((phrase) => phrase.id === selectedPhraseId) ?? activePhrases[0];
  const nextSelectedPhraseId = selected?.id ?? selectedPhraseId;
  const selectedFeedback = getSelectedFeedback(selected?.id);
  const completion = activeCategory ? getCategoryCompletion(activeCategory, mode) : { complete: 0, total: 0, percent: 0 };
  const selectedPasses = selected ? getPhrasePasses(selected.id) : 0;
  const selectedStep = selected ? getPhraseIndex(selected.id) + 1 : 0;
  const roadmapNextTarget =
    selected && selectedPasses >= 3
      ? getNextRoadmapTarget({
          mode,
          currentCategoryId: selected.categoryId,
          currentPhraseId: selected.id,
          orderedCategories,
          loadedPhrases,
          isCategoryUnlocked,
          isModeUnlocked: isModeUnlockedForProgression,
          getFirstUnlockedCategory
        })
      : null;

  const html = `${renderTopbar({
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
    <details class="card roadmap-panel"><summary>Category Path</summary><div class="roadmap-list">${orderedCategories
      .map((cat, index) =>
        renderRoadmapCategoryMarkup({
          category: cat,
          index,
          orderedCategories,
          mode,
          activeRoadmapCategoryId: nextActiveRoadmapCategoryId,
          getCategoryCompletion,
          isCategoryUnlocked
        })
      )
      .join('')}</div></details>

    <details class="card roadmap-panel"><summary>Category Phrases</summary><div class="roadmap-phrases">${activePhrases
      .map((phrase) => {
        const passes = getPhrasePasses(phrase.id);
        const done = passes >= 3;
        const phraseIndex = getPhraseIndex(phrase.id);
        const unlocked = done || isRoadmapPhraseUnlocked(phrase.categoryId, phraseIndex, mode);
        return `<button class="roadmap-phrase ${nextSelectedPhraseId === phrase.id ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}" data-roadmap-phrase="${phrase.id}" ${
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
          }<button id="record-btn" class="btn btn--accent ${recording ? 'is-recording' : ''}" aria-label="Record pronunciation">${
            recording ? 'Listening…' : 'Speak Now'
          }</button>${
            roadmapNextTarget
              ? `<button class="btn btn--ghost" data-roadmap-next-mode="${roadmapNextTarget.mode}" data-roadmap-next-category="${roadmapNextTarget.categoryId}" data-roadmap-next-phrase="${roadmapNextTarget.phraseId}">Next</button>`
              : ''
          }</div><div class="feedback" id="feedback">${selectedFeedback || feedbackPlaceholderHtml}</div></div>`
        : '<p>No phrase loaded yet.</p>'
    }</details>
  </section>`;

  return {
    html,
    activeRoadmapCategoryId: nextActiveRoadmapCategoryId,
    selectedPhraseId: nextSelectedPhraseId
  };
}

export function handleRoadmapSelectionClick(params: HandleRoadmapSelectionClickParams): boolean {
  const { target, activeDifficulty, chooseRoadmapCategory, runAndRender, setSelectedPhraseId, clearPracticeFeedback, render } = params;

  const roadmapCategoryBtn = target.closest<HTMLElement>('[data-roadmap-category]');
  if (roadmapCategoryBtn?.dataset.roadmapCategory) {
    runAndRender(chooseRoadmapCategory(roadmapCategoryBtn.dataset.roadmapCategory, activeDifficulty));
    return true;
  }

  const roadmapPhraseBtn = target.closest<HTMLElement>('[data-roadmap-phrase]');
  if (roadmapPhraseBtn?.dataset.roadmapPhrase) {
    setSelectedPhraseId(roadmapPhraseBtn.dataset.roadmapPhrase);
    clearPracticeFeedback();
    render();
    return true;
  }

  return false;
}

export function handleRoadmapNextClick(params: HandleRoadmapNextClickParams): boolean {
  const { target, goToRoadmapTarget, runAndRender } = params;

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

  return false;
}

export function handleRoadmapModeClick(params: HandleRoadmapModeClickParams): boolean {
  const {
    target,
    isModeUnlocked,
    getModeUnlockMessage,
    setMessage,
    render,
    setActiveDifficulty,
    clearPracticeFeedback,
    getFirstUnlockedCategory,
    chooseRoadmapCategory,
    runAndRender
  } = params;

  const modeBtn = target.closest<HTMLElement>('[data-mode]');
  if (!modeBtn?.dataset.mode) return false;

  const nextMode = modeBtn.dataset.mode;
  if (nextMode !== 'easy' && nextMode !== 'intermediate' && nextMode !== 'hard') return false;

  if (!isModeUnlocked(nextMode)) {
    setMessage(getModeUnlockMessage(nextMode));
    render();
    return true;
  }

  setActiveDifficulty(nextMode);
  clearPracticeFeedback();

  const nextCategory = getFirstUnlockedCategory(nextMode);
  runAndRender(nextCategory ? chooseRoadmapCategory(nextCategory.id, nextMode) : undefined);
  return true;
}

export function handleGoRoadmapClick(params: HandleGoRoadmapClickParams): boolean {
  const { target, activeDifficulty, setViewModeRoadmap, getFirstUnlockedCategory, chooseRoadmapCategory, runAndRender } = params;
  if (!target.closest('#go-roadmap')) return false;

  setViewModeRoadmap();
  const nextCategory = getFirstUnlockedCategory(activeDifficulty);
  runAndRender(nextCategory ? chooseRoadmapCategory(nextCategory.id, activeDifficulty) : undefined);
  return true;
}