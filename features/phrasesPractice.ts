import type { ConvoCategory, PromptCategory, PhrasesStage, ResponseCategory } from '../types';

interface HandlePhrasesMatchSelectionClickParams {
  target: HTMLElement;
  promptCategoryId: string;
  responseCategoryId: string;
  promptMatchedIds: Set<string>;
  responseMatchedIds: Set<string>;
  getPromptCategories: () => PromptCategory[];
  getResponseCategories: () => ResponseCategory[];
  speakItalian: (text: string) => Promise<void>;
  onPlaybackError: (error: unknown) => void;
  setPromptMatchAudioSelected: (unitId: string) => void;
  setPromptMatchEnglishSelected: (unitId: string) => void;
  setResponseMatchAudioSelected: (unitId: string) => void;
  setResponseMatchEnglishSelected: (unitId: string) => void;
  onPromptMatchSelection: () => void;
  onResponseMatchSelection: () => void;
  render: () => void;
}

interface HandlePhrasesPracticeClickParams {
  target: HTMLElement;
  goToPhrasesExerciseTarget: (target: { stage: PhrasesStage; categoryId: string }) => void;
  getPromptCategories: () => PromptCategory[];
  getResponseCategories: () => ResponseCategory[];
  getConvoCategories: () => ConvoCategory[];
  promptCategoryId: string;
  promptLearnIndex: number;
  setPromptLearnIndex: (index: number) => void;
  setPromptPhaseMatch: () => void;
  responseCategoryId: string;
  responseLearnIndex: number;
  setResponseLearnIndex: (index: number) => void;
  setResponsePhaseMatch: () => void;
  convoCategoryId: string;
  convoSpeakIndex: number;
  speakItalian: (text: string) => Promise<void>;
  onPlaybackError: (error: unknown) => void;
  runResponseSpeakingChallenge: () => void;
  runConvoSpeakingChallenge: () => void;
  setMessage: (message: string) => void;
  render: () => void;
}

export function handlePhrasesMatchSelectionClick(params: HandlePhrasesMatchSelectionClickParams): boolean {
  const {
    target,
    promptCategoryId,
    responseCategoryId,
    promptMatchedIds,
    responseMatchedIds,
    getPromptCategories,
    getResponseCategories,
    speakItalian,
    onPlaybackError,
    setPromptMatchAudioSelected,
    setPromptMatchEnglishSelected,
    setResponseMatchAudioSelected,
    setResponseMatchEnglishSelected,
    onPromptMatchSelection,
    onResponseMatchSelection,
    render
  } = params;

  const promptAudioBtn = target.closest<HTMLElement>('[data-prompt-match-audio]');
  if (promptAudioBtn?.dataset.promptMatchAudio) {
    const unitId = promptAudioBtn.dataset.promptMatchAudio;
    if (!promptMatchedIds.has(unitId)) {
      const category = getPromptCategories().find((item) => item.id === promptCategoryId);
      const unit = category?.units.find((item) => item.id === unitId);
      if (unit) {
        speakItalian(unit.it).catch(onPlaybackError);
      }
      setPromptMatchAudioSelected(unitId);
      onPromptMatchSelection();
      render();
    }
    return true;
  }

  const promptEnglishBtn = target.closest<HTMLElement>('[data-prompt-match-english]');
  if (promptEnglishBtn?.dataset.promptMatchEnglish) {
    const unitId = promptEnglishBtn.dataset.promptMatchEnglish;
    if (!promptMatchedIds.has(unitId)) {
      setPromptMatchEnglishSelected(unitId);
      onPromptMatchSelection();
      render();
    }
    return true;
  }

  const responseAudioBtn = target.closest<HTMLElement>('[data-response-match-audio]');
  if (responseAudioBtn?.dataset.responseMatchAudio) {
    const unitId = responseAudioBtn.dataset.responseMatchAudio;
    if (!responseMatchedIds.has(unitId)) {
      const category = getResponseCategories().find((item) => item.id === responseCategoryId);
      const unit = category?.units.find((item) => item.id === unitId);
      if (unit) {
        speakItalian(unit.it).catch(onPlaybackError);
      }
      setResponseMatchAudioSelected(unitId);
      onResponseMatchSelection();
      render();
    }
    return true;
  }

  const responseEnglishBtn = target.closest<HTMLElement>('[data-response-match-english]');
  if (responseEnglishBtn?.dataset.responseMatchEnglish) {
    const unitId = responseEnglishBtn.dataset.responseMatchEnglish;
    if (!responseMatchedIds.has(unitId)) {
      setResponseMatchEnglishSelected(unitId);
      onResponseMatchSelection();
      render();
    }
    return true;
  }

  return false;
}

export function handlePhrasesPracticeClick(params: HandlePhrasesPracticeClickParams): boolean {
  const {
    target,
    goToPhrasesExerciseTarget,
    getPromptCategories,
    getResponseCategories,
    getConvoCategories,
    promptCategoryId,
    promptLearnIndex,
    setPromptLearnIndex,
    setPromptPhaseMatch,
    responseCategoryId,
    responseLearnIndex,
    setResponseLearnIndex,
    setResponsePhaseMatch,
    convoCategoryId,
    convoSpeakIndex,
    speakItalian,
    onPlaybackError,
    runResponseSpeakingChallenge,
    runConvoSpeakingChallenge,
    setMessage,
    render
  } = params;

  const nextExerciseBtn = target.closest<HTMLElement>('[data-next-stage][data-next-category]');
  if (nextExerciseBtn?.dataset.nextStage && nextExerciseBtn.dataset.nextCategory) {
    const nextStage = nextExerciseBtn.dataset.nextStage;
    if (nextStage === 'prompt' || nextStage === 'response' || nextStage === 'convo') {
      goToPhrasesExerciseTarget({ stage: nextStage, categoryId: nextExerciseBtn.dataset.nextCategory });
      render();
      return true;
    }
  }

  if (target.closest('#prompt-listen')) {
    const category = getPromptCategories().find((item) => item.id === promptCategoryId);
    const unit = category?.units[promptLearnIndex];
    if (unit) {
      speakItalian(unit.it).catch(onPlaybackError);
    }
    return true;
  }

  if (target.closest('#prompt-next')) {
    const category = getPromptCategories().find((item) => item.id === promptCategoryId);
    if (category) {
      if (promptLearnIndex < category.units.length - 1) setPromptLearnIndex(promptLearnIndex + 1);
      else setPromptPhaseMatch();
      setMessage('');
      render();
    }
    return true;
  }

  if (target.closest('#response-listen')) {
    const category = getResponseCategories().find((item) => item.id === responseCategoryId);
    const unit = category?.units[responseLearnIndex];
    if (unit) {
      speakItalian(unit.it).catch(onPlaybackError);
    }
    return true;
  }

  if (target.closest('#response-next')) {
    const category = getResponseCategories().find((item) => item.id === responseCategoryId);
    if (category) {
      if (responseLearnIndex < category.units.length - 1) setResponseLearnIndex(responseLearnIndex + 1);
      else setResponsePhaseMatch();
      setMessage('');
      render();
    }
    return true;
  }

  if (target.closest('#response-speak')) {
    runResponseSpeakingChallenge();
    return true;
  }

  if (target.closest('#convo-listen-prompt')) {
    const category = getConvoCategories().find((item) => item.id === convoCategoryId);
    const unit = category?.units[convoSpeakIndex];
    if (unit) {
      speakItalian(unit.promptIt).catch(onPlaybackError);
    }
    return true;
  }

  if (target.closest('#convo-speak')) {
    runConvoSpeakingChallenge();
    return true;
  }

  return false;
}