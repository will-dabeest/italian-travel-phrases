import type { SrsCard } from '../types';

const DAY_MS = 1000 * 60 * 60 * 24;

/**
 * Creates default SRS metadata for a phrase.
 */
export function createInitialCard(): SrsCard {
  return {
    interval: 0,
    repetitions: 0,
    easinessFactor: 2.5,
    lastReviewed: null,
    nextReview: null
  };
}

const daysBetween = (from: Date, to: Date) => Math.max(0, Math.floor((to.getTime() - from.getTime()) / DAY_MS));

/**
 * Updates an SRS card using SM-2 inspired logic with phrase complexity and decay.
 */
export function updateSrsCard(card: SrsCard, quality: number, phraseWordCount: number, now = new Date()): SrsCard {
  const nextCard = { ...card };

  if (nextCard.lastReviewed) {
    const daysAway = daysBetween(new Date(nextCard.lastReviewed), now);
    if (daysAway > 21) {
      nextCard.repetitions = Math.max(0, nextCard.repetitions - 1);
      nextCard.easinessFactor = Math.max(1.3, nextCard.easinessFactor - 0.08);
    }
  }

  const q = Math.max(0, Math.min(5, quality));
  nextCard.easinessFactor = Math.max(
    1.3,
    nextCard.easinessFactor + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
  );

  if (q < 3) {
    nextCard.repetitions = 0;
    nextCard.interval = 1;
  } else {
    nextCard.repetitions += 1;
    if (nextCard.repetitions === 1) {
      nextCard.interval = 1;
    } else if (nextCard.repetitions === 2) {
      nextCard.interval = 6;
    } else {
      const lengthModifier = Math.max(0.75, 1 - Math.max(0, phraseWordCount - 3) * 0.035);
      nextCard.interval = Math.round(nextCard.interval * nextCard.easinessFactor * lengthModifier);
    }
  }

  nextCard.lastReviewed = now.toISOString();
  nextCard.nextReview = new Date(now.getTime() + nextCard.interval * DAY_MS).toISOString();
  return nextCard;
}

/**
 * Returns whether a card is due for review.
 */
export function isDue(card: SrsCard, now = new Date()): boolean {
  if (!card.nextReview) return true;
  return new Date(card.nextReview).getTime() <= now.getTime();
}

/**
 * Returns overdue days count.
 */
export function overdueDays(card: SrsCard, now = new Date()): number {
  if (!card.nextReview) return 0;
  const diff = daysBetween(new Date(card.nextReview), now);
  return diff > 0 ? diff : 0;
}

/**
 * Builds a daily queue with 70% review and 30% new cards.
 */
export function buildDailyQueue(params: {
  dueIds: string[];
  newIds: string[];
  maxItems?: number;
}): string[] {
  const maxItems = Math.min(20, Math.max(12, params.maxItems ?? 16));
  const reviewTarget = Math.round(maxItems * 0.7);

  const due = params.dueIds.slice(0, reviewTarget);
  const remaining = maxItems - due.length;
  const newer = params.newIds.slice(0, remaining);

  if (due.length < reviewTarget) {
    const fillFromNew = params.newIds.slice(newer.length, newer.length + (reviewTarget - due.length));
    newer.push(...fillFromNew);
  }

  return [...due, ...newer].slice(0, maxItems);
}
