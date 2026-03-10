import type { AppState, CategoryManifest, DifficultyMode } from '../types';

export function getPhraseIndex(phraseId: string): number {
  const lastDash = phraseId.lastIndexOf('-');
  if (lastDash === -1) return 0;
  const parsed = Number(phraseId.slice(lastDash + 1));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function isPhraseCompletedInMode(state: AppState, phraseId: string, mode: DifficultyMode): boolean {
  return (state.roadmapProgress[mode][phraseId] ?? 0) >= 3;
}

export function isModeFullyCompleted(state: AppState, ordered: CategoryManifest[], mode: DifficultyMode): boolean {
  if (!ordered.length) return false;

  for (const category of ordered) {
    for (let index = 0; index < category.count; index += 1) {
      if (!isPhraseCompletedInMode(state, `${category.id}-${index}`, mode)) return false;
    }
  }

  return true;
}

export function isModeUnlocked(state: AppState, ordered: CategoryManifest[], mode: DifficultyMode): boolean {
  if (mode === 'easy') return true;
  if (mode === 'intermediate') return isModeFullyCompleted(state, ordered, 'easy');
  return isModeFullyCompleted(state, ordered, 'intermediate');
}

export function isRoadmapPhraseUnlocked(state: AppState, categoryId: string, phraseIndex: number, mode: DifficultyMode): boolean {
  if (phraseIndex === 0) return true;
  const previousPhraseId = `${categoryId}-${phraseIndex - 1}`;
  return isPhraseCompletedInMode(state, previousPhraseId, mode);
}

export function getCategoryCompletion(
  state: AppState,
  category: CategoryManifest,
  mode: DifficultyMode
): { complete: number; total: number; percent: number } {
  let complete = 0;
  for (let index = 0; index < category.count; index += 1) {
    if (isPhraseCompletedInMode(state, `${category.id}-${index}`, mode)) complete += 1;
  }
  const total = category.count;
  const percent = total ? Math.round((complete / total) * 100) : 0;
  return { complete, total, percent };
}

export function isCategoryComplete(state: AppState, category: CategoryManifest, mode: DifficultyMode): boolean {
  const progress = getCategoryCompletion(state, category, mode);
  return progress.total > 0 && progress.complete === progress.total;
}

export function isCategoryUnlocked(state: AppState, index: number, ordered: CategoryManifest[], mode: DifficultyMode): boolean {
  if (index === 0) return true;
  return isCategoryComplete(state, ordered[index - 1], mode);
}

export function getFirstUnlockedCategory(
  state: AppState,
  ordered: CategoryManifest[],
  mode: DifficultyMode
): CategoryManifest | undefined {
  return ordered.find((category, index) => isCategoryUnlocked(state, index, ordered, mode)) ?? ordered[0];
}
