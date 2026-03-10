import type { CategoryPhase, ConvoCategory, PhrasesStage, PromptCategory, ResponseCategory } from '../types';

type PhrasesCategory = PromptCategory | ResponseCategory | ConvoCategory;

interface PhrasesProgressSnapshot {
  promptPhase: CategoryPhase;
  promptLearnIndex: number;
  promptMatchedCount: number;
  responsePhase: CategoryPhase;
  responseLearnIndex: number;
  responseMatchedCount: number;
  responseSpeakIndex: number;
  convoSpeakIndex: number;
}

export function isPhrasesStageFullyCompleted(categories: PhrasesCategory[], completedCategoryIds: string[]): boolean {
  if (!categories.length) return false;
  const completed = new Set(completedCategoryIds);
  return categories.every((category) => completed.has(category.id));
}

export function isPhrasesCategoryUnlockedAtIndex(
  categoryIndex: number,
  categories: PhrasesCategory[],
  completedCategoryIds: string[],
  localUnlockOverride: boolean
): boolean {
  if (localUnlockOverride) return true;
  if (categoryIndex === 0) return true;
  const completed = new Set(completedCategoryIds);
  return completed.has(categories[categoryIndex - 1]?.id ?? '');
}

export function getFirstUnlockedPhrasesCategoryId(
  categories: PhrasesCategory[],
  completedCategoryIds: string[],
  localUnlockOverride: boolean
): string {
  const first =
    categories.find((_category, index) =>
      isPhrasesCategoryUnlockedAtIndex(index, categories, completedCategoryIds, localUnlockOverride)
    ) ?? categories[0];
  return first?.id ?? '';
}

export function getNextUnlockedPhrasesCategoryId(
  categories: PhrasesCategory[],
  completedCategoryIds: string[],
  localUnlockOverride: boolean,
  currentCategoryId: string
): string {
  const currentIndex = categories.findIndex((category) => category.id === currentCategoryId);
  if (currentIndex < 0) return '';

  for (let index = currentIndex + 1; index < categories.length; index += 1) {
    if (isPhrasesCategoryUnlockedAtIndex(index, categories, completedCategoryIds, localUnlockOverride)) return categories[index].id;
  }

  return '';
}

export function getPhrasesCategoryProgress(
  stage: PhrasesStage,
  unitsCount: number,
  isCurrentCategory: boolean,
  isCompletedCategory: boolean,
  snapshot: PhrasesProgressSnapshot
): { complete: number; total: number; percent: number } {
  const safeUnits = Math.max(0, unitsCount);

  const total = stage === 'prompt' ? safeUnits * 2 : stage === 'response' ? safeUnits * 3 : safeUnits;
  if (!total) return { complete: 0, total: 0, percent: 0 };

  if (isCompletedCategory) return { complete: total, total, percent: 100 };
  if (!isCurrentCategory) return { complete: 0, total, percent: 0 };

  let complete = 0;
  if (stage === 'prompt') {
    if (snapshot.promptPhase === 'learn') complete = Math.min(snapshot.promptLearnIndex, safeUnits);
    else complete = safeUnits + Math.min(snapshot.promptMatchedCount, safeUnits);
  } else if (stage === 'response') {
    if (snapshot.responsePhase === 'learn') complete = Math.min(snapshot.responseLearnIndex, safeUnits);
    else if (snapshot.responsePhase === 'match') complete = safeUnits + Math.min(snapshot.responseMatchedCount, safeUnits);
    else complete = safeUnits * 2 + Math.min(snapshot.responseSpeakIndex, safeUnits);
  } else {
    complete = Math.min(snapshot.convoSpeakIndex, safeUnits);
  }

  const percent = Math.round((complete / total) * 100);
  return { complete, total, percent };
}
