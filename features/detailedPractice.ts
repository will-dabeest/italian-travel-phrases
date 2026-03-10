import type { Phrase } from '../types';

interface HandleDetailedPracticeClickParams {
  target: HTMLElement;
  selectedPhrase: Phrase | undefined;
  speakItalian: (text: string) => Promise<void>;
  onPlaybackError: (error: unknown) => void;
  handlePronunciationPractice: () => Promise<void>;
  onRecordingError: () => void;
}

export function handleDetailedPracticeClick(params: HandleDetailedPracticeClickParams): boolean {
  const { target, selectedPhrase, speakItalian, onPlaybackError, handlePronunciationPractice, onRecordingError } = params;

  if (target.closest('#speak-btn')) {
    if (selectedPhrase) {
      speakItalian(selectedPhrase.it).catch(onPlaybackError);
    }
    return true;
  }

  if (target.closest('#record-btn')) {
    handlePronunciationPractice().catch(() => {
      onRecordingError();
    });
    return true;
  }

  return false;
}