import type { Phrase } from '../types';
import { classifyAccuracy, getSimilarity } from '../utils/scoring';

interface QuickReviewParams {
  phrases: Phrase[];
  maxItems: number;
  onScore: (phrase: Phrase, similarity: number, quality: number, label: string) => void;
}

/**
 * Runs a quick review session of rapid speech checks.
 */
export async function runQuickReview(params: QuickReviewParams): Promise<{ attempts: number; averageAccuracy: number; streak: number }> {
  if (!params.phrases.length) {
    throw new Error('No phrases available for quick review.');
  }

  const chosen = params.phrases.slice(0, Math.min(params.maxItems, 10));
  let streak = 0;
  let bestStreak = 0;
  let total = 0;

  const { recognizeItalian } = await import('../utils/recognition');

  for (const phrase of chosen) {
    const confirmed = window.confirm(`Quick Review\n\nSay aloud:\n${phrase.it}\n\nPress OK to start listening or Cancel to skip.`);
    if (!confirmed) {
      streak = 0;
      continue;
    }

    try {
      const heard = await recognizeItalian({ timeoutMs: 6500, retries: 0 });
      const similarity = getSimilarity(phrase.it, heard.transcript);
      const { label, quality } = classifyAccuracy(similarity, 0.75);
      params.onScore(phrase, similarity, quality, label);
      total += similarity;
      if (similarity >= 0.7) {
        streak += 1;
        bestStreak = Math.max(bestStreak, streak);
      } else {
        streak = 0;
      }
    } catch {
      streak = 0;
    }
  }

  const attempts = chosen.length;
  return {
    attempts,
    averageAccuracy: attempts ? total / attempts : 0,
    streak: bestStreak
  };
}
