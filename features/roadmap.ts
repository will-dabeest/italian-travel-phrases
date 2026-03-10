import type { CategoryManifest, DifficultyMode, Phrase } from '../types';
import { getPhraseIndex } from '../utils/roadmap';

export type RoadmapNextTarget = { mode: DifficultyMode; categoryId: string; phraseId: string } | null;

interface NextRoadmapTargetParams {
  mode: DifficultyMode;
  currentCategoryId: string;
  currentPhraseId: string;
  orderedCategories: CategoryManifest[];
  loadedPhrases: Phrase[];
  isCategoryUnlocked: (index: number, ordered: CategoryManifest[], mode: DifficultyMode) => boolean;
  isModeUnlocked: (mode: DifficultyMode) => boolean;
  getFirstUnlockedCategory: (mode: DifficultyMode) => CategoryManifest | undefined;
}

interface FirstRoadmapPhraseIdParams {
  categoryId: string;
  mode: DifficultyMode;
  loadedPhrases: Phrase[];
  isPhraseCompletedInMode: (phraseId: string, mode: DifficultyMode) => boolean;
}

export function getRoadmapPhraseIdsForCategory(phrases: Phrase[], categoryId: string): string[] {
  return phrases
    .filter((phrase) => phrase.categoryId === categoryId)
    .sort((a, b) => getPhraseIndex(a.id) - getPhraseIndex(b.id))
    .map((phrase) => phrase.id);
}

export function getFirstRoadmapPhraseIdForCategory(params: FirstRoadmapPhraseIdParams): string {
  const { categoryId, mode, loadedPhrases, isPhraseCompletedInMode } = params;
  const phraseIds = getRoadmapPhraseIdsForCategory(loadedPhrases, categoryId);
  return phraseIds.find((phraseId) => !isPhraseCompletedInMode(phraseId, mode)) ?? phraseIds[0] ?? '';
}

export function getNextRoadmapTarget(params: NextRoadmapTargetParams): RoadmapNextTarget {
  const {
    mode,
    currentCategoryId,
    currentPhraseId,
    orderedCategories,
    loadedPhrases,
    isCategoryUnlocked,
    isModeUnlocked,
    getFirstUnlockedCategory
  } = params;

  const phraseIds = getRoadmapPhraseIdsForCategory(loadedPhrases, currentCategoryId);
  const currentIndex = phraseIds.indexOf(currentPhraseId);
  if (currentIndex >= 0 && currentIndex < phraseIds.length - 1) {
    return { mode, categoryId: currentCategoryId, phraseId: phraseIds[currentIndex + 1] };
  }

  const currentCategoryIndex = orderedCategories.findIndex((category) => category.id === currentCategoryId);
  if (currentCategoryIndex >= 0) {
    for (let index = currentCategoryIndex + 1; index < orderedCategories.length; index += 1) {
      const category = orderedCategories[index];
      if (!isCategoryUnlocked(index, orderedCategories, mode)) continue;
      return { mode, categoryId: category.id, phraseId: `${category.id}-0` };
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