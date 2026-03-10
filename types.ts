export interface Phrase {
  id: string;
  categoryId: string;
  categoryName: string;
  it: string;
  en: string;
}

export type DifficultyMode = 'easy' | 'intermediate' | 'hard';
export type PhrasesStage = 'prompt' | 'response' | 'convo';
export type CategoryPhase = 'learn' | 'match' | 'speak';

export interface Category {
  id: string;
  name: string;
  phrases: Array<Pick<Phrase, 'it' | 'en'>>;
}

export interface PhraseLibrary {
  categories: Category[];
}

export interface CategoryManifest {
  id: string;
  name: string;
  file: string;
  count: number;
}

export interface PhraseLibraryManifest {
  categories: CategoryManifest[];
}

export interface PhraseCategoryData {
  id: string;
  name: string;
  phrases: Array<Pick<Phrase, 'it' | 'en'>>;
}

export interface AudioClipManifestEntry {
  text: string;
  src: string;
  source?: string;
  license?: string;
  attribution?: string;
}

export interface AudioManifest {
  clips: AudioClipManifestEntry[];
}

export interface SrsCard {
  interval: number;
  repetitions: number;
  easinessFactor: number;
  lastReviewed: string | null;
  nextReview: string | null;
}

export interface PhraseProgress {
  attempts: number;
  totalAccuracy: number;
  lastAccuracy: number;
  difficult: boolean;
  mastered: boolean;
}

export interface Settings {
  theme: 'dark' | 'light';
  highContrast: boolean;
  fontScale: number;
}

export interface AppState {
  settings: Settings;
  streak: number;
  lastActiveDate: string | null;
  progress: Record<string, PhraseProgress>;
  srs: Record<string, SrsCard>;
  roadmapProgress: {
    easy: Record<string, number>;
    intermediate: Record<string, number>;
    hard: Record<string, number>;
  };
  phrasesProgress: {
    promptCompletedCategories: string[];
    responseCompletedCategories: string[];
    convoCompletedCategories: string[];
  };
}

export interface TokenResult {
  token: string;
  status: 'exact' | 'close' | 'miss' | 'extra';
}

export interface ConvoPhraseRaw {
  it: string;
  en: string;
  responses: string[];
  responses_en: string[];
}

export interface ConvoCategoryRaw {
  id: string;
  name: string;
  phrases: ConvoPhraseRaw[];
}

export interface ConvoLibraryRaw {
  categories: ConvoCategoryRaw[];
}

export interface PromptUnit {
  id: string;
  it: string;
  en: string;
}

export interface PromptCategory {
  id: string;
  name: string;
  units: PromptUnit[];
}

export interface ResponseUnit {
  id: string;
  it: string;
  en: string;
}

export interface ResponseCategory {
  id: string;
  name: string;
  units: ResponseUnit[];
}

export interface ConvoUnit {
  id: string;
  promptIt: string;
  promptEn: string;
  responseIt: string;
  responseEn: string;
}

export interface ConvoCategory {
  id: string;
  name: string;
  units: ConvoUnit[];
}

export interface ConvoDerivedData {
  promptCategories: PromptCategory[];
  responseCategories: ResponseCategory[];
  convoCategories: ConvoCategory[];
}
