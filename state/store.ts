import type { AppState, PhraseProgress, Settings, SrsCard } from '../types';
import { createInitialCard } from '../utils/srs';

const STORAGE_KEY = 'italian-trainer-state-v1';

const defaultSettings: Settings = {
  theme: 'dark',
  highContrast: false,
  fontScale: 1
};

const createDefaultState = (): AppState => ({
  settings: defaultSettings,
  streak: 0,
  lastActiveDate: null,
  progress: {},
  srs: {},
  roadmapProgress: {
    easy: {},
    intermediate: {},
    hard: {}
  },
  phrasesProgress: {
    promptCompletedCategories: [],
    responseCompletedCategories: [],
    convoCompletedCategories: []
  }
});

/**
 * Loads app state from localStorage.
 */
export function loadState(): AppState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState> & { roadmapPasses?: Record<string, number> };
    const defaults = createDefaultState();
    const migratedEasy = parsed.roadmapProgress?.easy ?? parsed.roadmapPasses ?? {};
    return {
      ...defaults,
      ...parsed,
      settings: { ...defaultSettings, ...(parsed.settings ?? {}) },
      roadmapProgress: {
        easy: migratedEasy,
        intermediate: parsed.roadmapProgress?.intermediate ?? {},
        hard: parsed.roadmapProgress?.hard ?? {}
      },
      phrasesProgress: {
        promptCompletedCategories: parsed.phrasesProgress?.promptCompletedCategories ?? [],
        responseCompletedCategories: parsed.phrasesProgress?.responseCompletedCategories ?? [],
        convoCompletedCategories: parsed.phrasesProgress?.convoCompletedCategories ?? []
      }
    };
  } catch {
    return createDefaultState();
  }
}

/**
 * Persists app state to localStorage.
 */
export function saveState(state: AppState): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

/**
 * Clears persisted app state.
 */
export function resetState(): AppState {
  const next = createDefaultState();
  saveState(next);
  return next;
}

/**
 * Returns phrase progress, creating it when missing.
 */
export function ensureProgress(state: AppState, phraseId: string): PhraseProgress {
  if (!state.progress[phraseId]) {
    state.progress[phraseId] = {
      attempts: 0,
      totalAccuracy: 0,
      lastAccuracy: 0,
      difficult: false,
      mastered: false
    };
  }
  return state.progress[phraseId];
}

/**
 * Returns SRS card, creating it when missing.
 */
export function ensureCard(state: AppState, phraseId: string): SrsCard {
  if (!state.srs[phraseId]) {
    state.srs[phraseId] = createInitialCard();
  }
  return state.srs[phraseId];
}

/**
 * Updates streak by checking consecutive active days.
 */
export function updateStreak(state: AppState, now = new Date()): void {
  const today = now.toISOString().slice(0, 10);
  if (!state.lastActiveDate) {
    state.lastActiveDate = today;
    state.streak = 1;
    return;
  }

  if (state.lastActiveDate === today) return;

  const last = new Date(state.lastActiveDate);
  const current = new Date(today);
  const diff = Math.round((current.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

  state.streak = diff === 1 ? state.streak + 1 : 1;
  state.lastActiveDate = today;
}
