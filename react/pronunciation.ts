import { ensureCard, ensureProgress, saveState, updateStreak } from '../state/store';
import type { AppState, DifficultyMode, Phrase } from '../types';
import { classifyAccuracy, getPronunciationHint, getSimilarity, tokenDiff } from '../utils/scoring';
import { updateSrsCard } from '../utils/srs';

const ERROR_RECORDING_UNEXPECTED = 'Recognition failed. Please try again.';

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function recognizeAndScore(expectedItalian: string): Promise<{ transcript: string; similarity: number }> {
  const { isRecognitionSupported, recognizeItalian } = await import('../utils/recognition');
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

export function applyDetailedPracticeRecognition(params: {
  state: AppState;
  phrase: Phrase;
}): (result: { transcript: string; similarity: number }) => { nextState: AppState; feedbackHtml: string } {
  const { state, phrase } = params;

  return (result) => {
    const nextState: AppState = structuredClone(state);
    const progress = ensureProgress(nextState, phrase.id);
    const historicalAccuracy = progress.attempts === 0 ? 0.7 : progress.totalAccuracy / Math.max(1, progress.attempts);
    const { label, quality } = classifyAccuracy(result.similarity, historicalAccuracy);

    progress.attempts += 1;
    progress.totalAccuracy += result.similarity;
    progress.lastAccuracy = result.similarity;

    const updated = updateSrsCard(ensureCard(nextState, phrase.id), quality, phrase.it.split(/\s+/).length);
    nextState.srs[phrase.id] = updated;
    progress.difficult = result.similarity < 0.7 || updated.easinessFactor < 2.0;
    progress.mastered = updated.interval >= 21 && updated.easinessFactor >= 2.4;

    updateStreak(nextState);
    saveState(nextState);

    const diff = tokenDiff(phrase.it, result.transcript)
      .map((token) => `<span class="token token--${token.status}">${escapeHtml(token.token)}</span>`)
      .join(' ');

    const feedbackHtml = `<p><strong>Recognition:</strong> ${escapeHtml(result.transcript || '—')}</p><p><strong>Match:</strong> ${Math.round(
      result.similarity * 100
    )}% · ${label}</p><div><strong>Token diff:</strong> ${diff}</div><p><strong>Hint:</strong> ${escapeHtml(
      getPronunciationHint(phrase.it, result.transcript)
    )}</p>`;

    return { nextState, feedbackHtml };
  };
}

export function applyRoadmapRecognition(params: {
  state: AppState;
  phrase: Phrase;
  mode: DifficultyMode;
}): (result: { transcript: string; similarity: number }) => { nextState: AppState; feedbackHtml: string } {
  const { state, phrase, mode } = params;

  return (result) => {
    const nextState: AppState = structuredClone(state);
    const progress = ensureProgress(nextState, phrase.id);
    const historicalAccuracy = progress.attempts === 0 ? 0.7 : progress.totalAccuracy / Math.max(1, progress.attempts);
    const { label, quality } = classifyAccuracy(result.similarity, historicalAccuracy);

    progress.attempts += 1;
    progress.totalAccuracy += result.similarity;
    progress.lastAccuracy = result.similarity;

    const updated = updateSrsCard(ensureCard(nextState, phrase.id), quality, phrase.it.split(/\s+/).length);
    nextState.srs[phrase.id] = updated;
    progress.difficult = result.similarity < 0.7 || updated.easinessFactor < 2.0;
    progress.mastered = updated.interval >= 21 && updated.easinessFactor >= 2.4;

    const oldPasses = nextState.roadmapProgress[mode][phrase.id] ?? 0;
    if (result.similarity >= 0.9) {
      nextState.roadmapProgress[mode][phrase.id] = Math.min(3, oldPasses + 1);
    }

    updateStreak(nextState);
    saveState(nextState);

    const diff = tokenDiff(phrase.it, result.transcript)
      .map((token) => `<span class="token token--${token.status}">${escapeHtml(token.token)}</span>`)
      .join(' ');

    const feedbackHtml = `<p><strong>Recognition:</strong> ${escapeHtml(result.transcript || '—')}</p><p><strong>Match:</strong> ${Math.round(
      result.similarity * 100
    )}% · ${label}</p><div><strong>Token diff:</strong> ${diff}</div><p><strong>Roadmap progress:</strong> ${Math.min(
      3,
      nextState.roadmapProgress[mode][phrase.id] ?? 0
    )}/3 successful runs at least 90% (${mode})</p><p><strong>Hint:</strong> ${escapeHtml(
      getPronunciationHint(phrase.it, result.transcript)
    )}</p>`;

    return { nextState, feedbackHtml };
  };
}

export function toRecognitionErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : ERROR_RECORDING_UNEXPECTED;
}
