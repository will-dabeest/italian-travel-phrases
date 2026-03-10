import type { PhrasesStage } from '../types';

interface HandlePhrasesNavigationClickParams {
  target: HTMLElement;
  isPhrasesModeUnlocked: () => boolean;
  isPhrasesSubModeUnlocked: (stage: PhrasesStage) => boolean;
  getFirstUnlockedPhrasesCategoryId: (stage: PhrasesStage) => string;
  initializePromptCategory: (categoryId: string) => void;
  initializeResponseCategory: (categoryId: string) => void;
  initializeConvoCategory: (categoryId: string) => void;
  setPhrasesViewForStage: (stage: PhrasesStage) => void;
  setViewModePhrasesHome: () => void;
  setMessage: (message: string) => void;
  render: () => void;
}

interface HandlePhrasesCategorySelectionClickParams {
  target: HTMLElement;
  getPromptCategoryIds: () => string[];
  getResponseCategoryIds: () => string[];
  getConvoCategoryIds: () => string[];
  isPhrasesCategoryUnlocked: (stage: PhrasesStage, categoryIndex: number) => boolean;
  initializePromptCategory: (categoryId: string) => void;
  initializeResponseCategory: (categoryId: string) => void;
  initializeConvoCategory: (categoryId: string) => void;
  render: () => void;
}

function openPhrasesSubMode(params: {
  stage: PhrasesStage;
  lockedMessage: string;
  isPhrasesSubModeUnlocked: (stage: PhrasesStage) => boolean;
  getFirstUnlockedPhrasesCategoryId: (stage: PhrasesStage) => string;
  initializePromptCategory: (categoryId: string) => void;
  initializeResponseCategory: (categoryId: string) => void;
  initializeConvoCategory: (categoryId: string) => void;
  setPhrasesViewForStage: (stage: PhrasesStage) => void;
  setMessage: (message: string) => void;
  render: () => void;
}): boolean {
  const {
    stage,
    lockedMessage,
    isPhrasesSubModeUnlocked,
    getFirstUnlockedPhrasesCategoryId,
    initializePromptCategory,
    initializeResponseCategory,
    initializeConvoCategory,
    setPhrasesViewForStage,
    setMessage,
    render
  } = params;

  if (!isPhrasesSubModeUnlocked(stage)) {
    setMessage(lockedMessage);
    render();
    return true;
  }

  const categoryId = getFirstUnlockedPhrasesCategoryId(stage);
  if (categoryId) {
    if (stage === 'prompt') initializePromptCategory(categoryId);
    else if (stage === 'response') initializeResponseCategory(categoryId);
    else initializeConvoCategory(categoryId);
  }

  setPhrasesViewForStage(stage);
  render();
  return true;
}

export function handlePhrasesNavigationClick(params: HandlePhrasesNavigationClickParams): boolean {
  const {
    target,
    isPhrasesModeUnlocked,
    isPhrasesSubModeUnlocked,
    getFirstUnlockedPhrasesCategoryId,
    initializePromptCategory,
    initializeResponseCategory,
    initializeConvoCategory,
    setPhrasesViewForStage,
    setViewModePhrasesHome,
    setMessage,
    render
  } = params;

  if (target.closest('#go-phrases')) {
    if (!isPhrasesModeUnlocked()) {
      setMessage('Complete all Roadmap phrases through Hard mode to unlock Phrases mode.');
      render();
      return true;
    }

    setViewModePhrasesHome();
    setMessage('');
    render();
    return true;
  }

  if (target.closest('#phr-home')) {
    setViewModePhrasesHome();
    setMessage('');
    render();
    return true;
  }

  if (target.closest('#phr-open-prompt')) {
    return openPhrasesSubMode({
      stage: 'prompt',
      lockedMessage: 'Prompt is locked.',
      isPhrasesSubModeUnlocked,
      getFirstUnlockedPhrasesCategoryId,
      initializePromptCategory,
      initializeResponseCategory,
      initializeConvoCategory,
      setPhrasesViewForStage,
      setMessage,
      render
    });
  }

  if (target.closest('#phr-open-response')) {
    return openPhrasesSubMode({
      stage: 'response',
      lockedMessage: 'Complete all Prompt categories to unlock Response.',
      isPhrasesSubModeUnlocked,
      getFirstUnlockedPhrasesCategoryId,
      initializePromptCategory,
      initializeResponseCategory,
      initializeConvoCategory,
      setPhrasesViewForStage,
      setMessage,
      render
    });
  }

  if (target.closest('#phr-open-convo')) {
    return openPhrasesSubMode({
      stage: 'convo',
      lockedMessage: 'Complete all Response categories to unlock Convo.',
      isPhrasesSubModeUnlocked,
      getFirstUnlockedPhrasesCategoryId,
      initializePromptCategory,
      initializeResponseCategory,
      initializeConvoCategory,
      setPhrasesViewForStage,
      setMessage,
      render
    });
  }

  return false;
}

export function handlePhrasesCategorySelectionClick(params: HandlePhrasesCategorySelectionClickParams): boolean {
  const {
    target,
    getPromptCategoryIds,
    getResponseCategoryIds,
    getConvoCategoryIds,
    isPhrasesCategoryUnlocked,
    initializePromptCategory,
    initializeResponseCategory,
    initializeConvoCategory,
    render
  } = params;

  const promptCategoryBtn = target.closest<HTMLElement>('[data-prompt-category]');
  if (promptCategoryBtn?.dataset.promptCategory) {
    const categoryId = promptCategoryBtn.dataset.promptCategory;
    const index = getPromptCategoryIds().findIndex((id) => id === categoryId);
    if (index >= 0 && isPhrasesCategoryUnlocked('prompt', index)) {
      initializePromptCategory(categoryId);
      render();
    }
    return true;
  }

  const responseCategoryBtn = target.closest<HTMLElement>('[data-response-category]');
  if (responseCategoryBtn?.dataset.responseCategory) {
    const categoryId = responseCategoryBtn.dataset.responseCategory;
    const index = getResponseCategoryIds().findIndex((id) => id === categoryId);
    if (index >= 0 && isPhrasesCategoryUnlocked('response', index)) {
      initializeResponseCategory(categoryId);
      render();
    }
    return true;
  }

  const convoCategoryBtn = target.closest<HTMLElement>('[data-convo-category]');
  if (convoCategoryBtn?.dataset.convoCategory) {
    const categoryId = convoCategoryBtn.dataset.convoCategory;
    const index = getConvoCategoryIds().findIndex((id) => id === categoryId);
    if (index >= 0 && isPhrasesCategoryUnlocked('convo', index)) {
      initializeConvoCategory(categoryId);
      render();
    }
    return true;
  }

  return false;
}