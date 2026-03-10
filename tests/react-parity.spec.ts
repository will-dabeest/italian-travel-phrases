import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';
import type { AppState, Phrase } from '../types';
import { applyRoadmapRecognition } from '../react/pronunciation';

const STORAGE_KEY = 'italian-trainer-state-v1';

const freshState = {
  settings: { theme: 'dark', highContrast: false, fontScale: 1 },
  streak: 0,
  lastActiveDate: null,
  progress: {},
  srs: {},
  roadmapProgress: { easy: {}, intermediate: {}, hard: {} },
  phrasesProgress: {
    promptCompletedCategories: [],
    responseCompletedCategories: [],
    convoCompletedCategories: []
  }
};

const step4Fixture = {
  ...freshState,
  roadmapProgress: {
    easy: {
      'greetings-0': 3,
      'greetings-1': 2
    },
    intermediate: {},
    hard: {}
  }
};

const step5Fixture = {
  ...freshState,
  progress: {
    'greetings-0': {
      attempts: 6,
      totalAccuracy: 5.1,
      lastAccuracy: 0.9,
      difficult: false,
      mastered: true
    },
    'greetings-1': {
      attempts: 5,
      totalAccuracy: 2.1,
      lastAccuracy: 0.4,
      difficult: true,
      mastered: false
    }
  },
  srs: {
    'greetings-0': {
      interval: 28,
      repetitions: 5,
      easinessFactor: 2.5,
      lastReviewed: '2026-03-01T00:00:00.000Z',
      nextReview: '2026-03-20T00:00:00.000Z'
    },
    'greetings-1': {
      interval: 2,
      repetitions: 1,
      easinessFactor: 1.9,
      lastReviewed: '2026-02-20T00:00:00.000Z',
      nextReview: '2026-02-24T00:00:00.000Z'
    }
  }
};

async function seedState(pagePath: '/' | '/react.html', page: import('@playwright/test').Page): Promise<void> {
  await seedCustomState(pagePath, page, freshState);
}

async function seedCustomState(
  pagePath: '/' | '/react.html',
  page: import('@playwright/test').Page,
  stateValue: typeof freshState
): Promise<void> {
  await page.goto(pagePath);
  await page.evaluate(
    ({ key, value }) => {
      window.localStorage.setItem(key, JSON.stringify(value));
    },
    { key: STORAGE_KEY, value: stateValue }
  );
  await page.reload();
}

async function withParityPages(
  browser: Browser,
  run: (pages: { vanillaPage: Page; reactPage: Page }) => Promise<void>
): Promise<void> {
  const vanilla = await browser.newContext();
  const react = await browser.newContext();

  try {
    const vanillaPage = await vanilla.newPage();
    const reactPage = await react.newPage();

    await seedState('/', vanillaPage);
    await seedState('/react.html', reactPage);

    await run({ vanillaPage, reactPage });
  } finally {
    await vanilla.close();
    await react.close();
  }
}

async function installRecognitionMock(page: Page, transcript: string): Promise<void> {
  await page.addInitScript((value) => {
    class MockSpeechRecognition {
      lang = 'it-IT';
      interimResults = false;
      maxAlternatives = 1;
      onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> }) => void) | null = null;
      onerror: ((event: { error: string }) => void) | null = null;
      onend: (() => void) | null = null;

      start(): void {
        window.setTimeout(() => {
          this.onresult?.({
            results: [[{ transcript: value, confidence: 0.99 }]]
          });
        }, 0);
      }

      stop(): void {
        this.onend?.();
      }
    }

    // @ts-expect-error test shim
    window.SpeechRecognition = MockSpeechRecognition;
    // @ts-expect-error test shim
    window.webkitSpeechRecognition = MockSpeechRecognition;
  }, transcript);
}

async function unlockPhrasesMode(page: Page): Promise<void> {
  await page.evaluate(async (key) => {
    const response = await fetch('/phrases.json', { cache: 'no-store' });
    const manifest = (await response.json()) as { categories?: Array<{ id: string; count: number }> };
    const state = JSON.parse(window.localStorage.getItem(key) || '{}');

    const easy: Record<string, number> = {};
    const intermediate: Record<string, number> = {};
    const hard: Record<string, number> = {};

    for (const category of manifest.categories ?? []) {
      for (let index = 0; index < (category.count ?? 0); index += 1) {
        const phraseId = `${category.id}-${index}`;
        easy[phraseId] = 3;
        intermediate[phraseId] = 3;
        hard[phraseId] = 3;
      }
    }

    state.roadmapProgress = { easy, intermediate, hard };
    window.localStorage.setItem(key, JSON.stringify(state));
  }, STORAGE_KEY);

  await page.reload();
}

async function getManifestCategoryCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const response = await fetch('/phrases.json', { cache: 'no-store' });
    const data = (await response.json()) as { categories?: unknown[] };
    return Array.isArray(data.categories) ? data.categories.length : 0;
  });
}

async function advancePromptToMatch(page: Page): Promise<void> {
  const matchAudio = page.locator('[data-prompt-match-audio]').first();
  const nextButton = page.locator('#prompt-next');

  for (let attempt = 0; attempt < 30; attempt += 1) {
    if (await matchAudio.isVisible().catch(() => false)) return;
    await nextButton.click();
  }

  throw new Error('Timed out advancing Prompt learn phase to match phase.');
}

async function triggerPromptMismatch(page: Page): Promise<void> {
  const audioButtons = page.locator('[data-prompt-match-audio]');
  const englishButtons = page.locator('[data-prompt-match-english]');
  const audioCount = await audioButtons.count();
  const englishCount = await englishButtons.count();

  if (audioCount < 1 || englishCount < 2) {
    throw new Error('Prompt match UI does not have enough items to verify mismatch reset.');
  }

  const selectedAudio = audioButtons.first();
  const audioId = await selectedAudio.getAttribute('data-prompt-match-audio');
  if (!audioId) throw new Error('Selected prompt audio item has no data id.');

  let mismatchEnglishIndex = -1;
  for (let index = 0; index < englishCount; index += 1) {
    const englishId = await englishButtons.nth(index).getAttribute('data-prompt-match-english');
    if (englishId && englishId !== audioId) {
      mismatchEnglishIndex = index;
      break;
    }
  }

  if (mismatchEnglishIndex < 0) {
    throw new Error('Could not find a non-matching English option for prompt mismatch test.');
  }

  await selectedAudio.click();
  await englishButtons.nth(mismatchEnglishIndex).click();
}

test.describe('React parity executable checks (REACT_MIGRATION.md + REACT_PARITY_CHECKLIST.md)', () => {
  test('Step 2 — Landing parity: CTA behavior @step2', async ({ browser }) => {
    await withParityPages(browser, async ({ vanillaPage, reactPage }) => {
      const vanillaRoadmap = vanillaPage.getByRole('button', { name: 'Roadmap' });
      const reactRoadmap = reactPage.getByRole('button', { name: 'Roadmap' });
      const vanillaPractice = vanillaPage.getByRole('button', { name: 'Practice' });
      const reactPractice = reactPage.getByRole('button', { name: 'Practice' });

      await expect(vanillaRoadmap).toBeVisible();
      await expect(reactRoadmap).toBeVisible();
      await expect(vanillaPractice).toBeVisible();
      await expect(reactPractice).toBeVisible();

      const vanillaPhrases = vanillaPage.getByRole('button', { name: /Phrases/ });
      const reactPhrases = reactPage.getByRole('button', { name: /Phrases/ });

      await expect(vanillaPhrases).toBeDisabled();
      await expect(reactPhrases).toBeDisabled();
    });
  });

  test('Step 3 — Roadmap data skeleton parity: categories and difficulty chips @step3', async ({ browser }) => {
    await withParityPages(browser, async ({ vanillaPage, reactPage }) => {
      await vanillaPage.getByRole('button', { name: 'Roadmap' }).click();
      await reactPage.getByRole('button', { name: 'Roadmap' }).click();

      const expectedCategoryCount = await getManifestCategoryCount(vanillaPage);

      const vanillaChips = vanillaPage.locator('[data-mode]');
      const reactChips = reactPage.locator('.chips .chip');
      await expect(vanillaChips).toHaveCount(3);
      await expect(reactChips).toHaveCount(3);

      const vanillaCategories = vanillaPage.locator('[data-roadmap-category]');
      const reactCategories = reactPage.locator('.roadmap-list .roadmap-cat');

      await expect(vanillaCategories).toHaveCount(expectedCategoryCount);
      await expect(reactCategories).toHaveCount(expectedCategoryCount);
    });
  });

  test('Step 4 — Roadmap behavioral parity: unlock chains and pass state @step4', async ({ browser }) => {
    await withParityPages(browser, async ({ vanillaPage, reactPage }) => {
      await seedCustomState('/', vanillaPage, step4Fixture);
      await seedCustomState('/react.html', reactPage, step4Fixture);

      await vanillaPage.getByRole('button', { name: 'Roadmap' }).click();
      await reactPage.getByRole('button', { name: 'Roadmap' }).click();

      await expect(vanillaPage.locator('[data-mode="intermediate"]')).toBeDisabled();
      await expect(vanillaPage.locator('[data-mode="hard"]')).toBeDisabled();
      await expect(reactPage.locator('[data-mode="intermediate"]')).toBeDisabled();
      await expect(reactPage.locator('[data-mode="hard"]')).toBeDisabled();

      await expect(vanillaPage.locator('[data-roadmap-category="greetings"]')).toBeEnabled();
      await expect(vanillaPage.locator('[data-roadmap-category="navigation"]')).toBeDisabled();
      await expect(reactPage.locator('[data-roadmap-category="greetings"]')).toBeEnabled();
      await expect(reactPage.locator('[data-roadmap-category="navigation"]')).toBeDisabled();

      await expect(vanillaPage.locator('[data-roadmap-phrase="greetings-0"]')).toBeEnabled();
      await expect(vanillaPage.locator('[data-roadmap-phrase="greetings-1"]')).toBeEnabled();
      await expect(vanillaPage.locator('[data-roadmap-phrase="greetings-2"]')).toBeDisabled();

      await expect(reactPage.locator('[data-roadmap-phrase="greetings-0"]')).toBeEnabled();
      await expect(reactPage.locator('[data-roadmap-phrase="greetings-1"]')).toBeEnabled();
      await expect(reactPage.locator('[data-roadmap-phrase="greetings-2"]')).toBeDisabled();
    });
  });

  test('Step 5 — Detailed practice parity: filters, badges, and selection @step5', async ({ browser }) => {
    await withParityPages(browser, async ({ vanillaPage, reactPage }) => {
      await seedCustomState('/', vanillaPage, step5Fixture);
      await seedCustomState('/react.html', reactPage, step5Fixture);

      await vanillaPage.getByRole('button', { name: 'Practice' }).click();
      await reactPage.getByRole('button', { name: 'Practice' }).click();

      await expect(vanillaPage.locator('#search')).toBeVisible();
      await expect(reactPage.locator('#search')).toBeVisible();

      await vanillaPage.locator('[data-filter="difficult"]').click();
      await reactPage.locator('[data-filter="difficult"]').click();
      await expect(vanillaPage.locator('[data-phrase-id]')).toHaveCount(1);
      await expect(reactPage.locator('[data-phrase-id]')).toHaveCount(1);

      await vanillaPage.locator('[data-filter="all"]').click();
      await reactPage.locator('[data-filter="all"]').click();
      await expect(vanillaPage.locator('.badge--overdue')).toHaveCount(1);
      await expect(reactPage.locator('.badge--overdue')).toHaveCount(1);

      await vanillaPage.locator('#sort-select').selectOption('least-progress');
      await reactPage.locator('#sort-select').selectOption('least-progress');
      const vanillaFirstPhrase = vanillaPage.locator('[data-phrase-id]').first().locator('.phrase-it');
      const reactFirstPhrase = reactPage.locator('[data-phrase-id]').first().locator('.phrase-it');
      await expect(reactFirstPhrase).toHaveText(await vanillaFirstPhrase.innerText());

      await vanillaPage.locator('[data-phrase-id="greetings-1"]').click();
      await reactPage.locator('[data-phrase-id="greetings-1"]').click();

      const vanillaSelectedPhraseText = await vanillaPage.locator('.practice-it').innerText();
      await expect(reactPage.locator('.practice-it')).toHaveText(vanillaSelectedPhraseText);
    });
  });

  test('Step 6 — Pronunciation flow parity: detailed practice feedback @step6', async ({ browser }) => {
    await withParityPages(browser, async ({ vanillaPage, reactPage }) => {
      await installRecognitionMock(vanillaPage, 'Buongiorno');
      await installRecognitionMock(reactPage, 'Buongiorno');

      await seedCustomState('/', vanillaPage, freshState);
      await seedCustomState('/react.html', reactPage, freshState);

      await vanillaPage.getByRole('button', { name: 'Practice' }).click();
      await reactPage.getByRole('button', { name: 'Practice' }).click();

      await vanillaPage.locator('#record-btn').click();
      await reactPage.locator('#record-btn').click();

      const vanillaDetailedFeedback = vanillaPage.locator('#feedback');
      const reactDetailedFeedback = reactPage.locator('#feedback');
      const vanillaDetailedText = await vanillaDetailedFeedback.innerText();
      await expect(vanillaDetailedFeedback).toContainText('Match:');
      await expect(reactDetailedFeedback).toContainText('Match:');
      await expect(reactDetailedFeedback).toContainText('Recognition: Buongiorno');
      await expect(reactDetailedFeedback).toContainText('Match: 100% · Perfect');
      await expect(reactDetailedFeedback).toContainText('Token diff:');
      await expect(reactDetailedFeedback).toContainText('Hint:');
      expect(vanillaDetailedText).toContain('Recognition: Buongiorno');
      expect(vanillaDetailedText).toContain('Match: 100% · Perfect');
    });
  });

  test('Step 6 — Pronunciation flow parity: roadmap pass threshold logic @step6', async () => {
    const originalWindow = (globalThis as { window?: Window }).window;
    (globalThis as { window?: Pick<Window, 'localStorage'> }).window = {
      localStorage: {
        getItem: () => null,
        setItem: () => undefined,
        removeItem: () => undefined,
        clear: () => undefined,
        key: () => null,
        length: 0
      }
    };

    try {
      const phrase: Phrase = {
        id: 'greetings-0',
        categoryId: 'greetings',
        categoryName: 'Greetings & Politeness',
        it: 'Buongiorno',
        en: 'Good morning'
      };

      const apply = applyRoadmapRecognition({
        state: structuredClone(freshState) as AppState,
        phrase,
        mode: 'easy'
      });

      const passing = apply({ transcript: 'Buongiorno', similarity: 1 });
      expect(passing.nextState.roadmapProgress.easy['greetings-0']).toBe(1);
      expect(passing.feedbackHtml).toContain('Roadmap progress:');

      const failing = apply({ transcript: 'Buona sera', similarity: 0.5 });
      expect(failing.nextState.roadmapProgress.easy['greetings-0'] ?? 0).toBe(0);
    } finally {
      (globalThis as { window?: Window }).window = originalWindow;
    }
  });

  test('Step 7 — Phrases mode parity: unlock chain and prompt mismatch reset @step7', async ({ browser }) => {
    test.setTimeout(60_000);

    await withParityPages(browser, async ({ vanillaPage, reactPage }) => {
      await seedCustomState('/', vanillaPage, freshState);
      await seedCustomState('/react.html', reactPage, freshState);
      await unlockPhrasesMode(vanillaPage);
      await unlockPhrasesMode(reactPage);

      await expect(vanillaPage.getByRole('button', { name: /Phrases/ })).toBeEnabled();
      await expect(reactPage.getByRole('button', { name: /Phrases/ })).toBeEnabled();

      await vanillaPage.getByRole('button', { name: /Phrases/ }).click();
      await reactPage.getByRole('button', { name: /Phrases/ }).click();

      await expect(vanillaPage.locator('#phr-open-prompt')).toBeEnabled();
      await expect(reactPage.locator('#phr-open-prompt')).toBeEnabled();
      await expect(vanillaPage.locator('#phr-open-response')).toBeDisabled();
      await expect(reactPage.locator('#phr-open-response')).toBeDisabled();
      await expect(vanillaPage.locator('#phr-open-convo')).toBeDisabled();
      await expect(reactPage.locator('#phr-open-convo')).toBeDisabled();

      await vanillaPage.locator('#phr-open-prompt').click();
      await reactPage.locator('#phr-open-prompt').click();

      await advancePromptToMatch(vanillaPage);
      await advancePromptToMatch(reactPage);

      await triggerPromptMismatch(vanillaPage);
      await triggerPromptMismatch(reactPage);

      await expect(vanillaPage.locator('.message')).toContainText('reset');
      await expect(reactPage.locator('.message')).toContainText('reset');
      await expect(vanillaPage.locator('.is-matched')).toHaveCount(0);
      await expect(reactPage.locator('.is-matched')).toHaveCount(0);
    });
  });

  test('Step 8 — Settings/system parity: theme, contrast, font, reset @step8', async ({ browser }) => {
    await withParityPages(browser, async ({ vanillaPage, reactPage }) => {
      await seedCustomState('/', vanillaPage, freshState);
      await seedCustomState('/react.html', reactPage, freshState);

      await vanillaPage.getByRole('button', { name: /Practice/ }).click();
      await reactPage.getByRole('button', { name: /Practice/ }).click();

      await vanillaPage.locator('#settings-toggle').click();
      await reactPage.locator('#settings-toggle').click();

      await expect(vanillaPage.locator('#settings-panel')).toBeVisible();
      await expect(reactPage.locator('#settings-panel')).toBeVisible();

      await vanillaPage.locator('#theme-select').selectOption('light');
      await reactPage.locator('#theme-select').selectOption('light');

      await vanillaPage.locator('#contrast-toggle').setChecked(true);
      await reactPage.locator('#contrast-toggle').setChecked(true);

      await vanillaPage.locator('#font-range').evaluate((element) => {
        const input = element as HTMLInputElement;
        input.value = '1.25';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      await reactPage.locator('#font-range').evaluate((element) => {
        const input = element as HTMLInputElement;
        input.value = '1.25';
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });

      await expect(vanillaPage.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(reactPage.locator('html')).toHaveAttribute('data-theme', 'light');
      await expect(vanillaPage.locator('html')).toHaveAttribute('data-contrast', 'high');
      await expect(reactPage.locator('html')).toHaveAttribute('data-contrast', 'high');

      const vanillaFontScale = await vanillaPage.evaluate(() => document.documentElement.style.getPropertyValue('--font-scale').trim());
      const reactFontScale = await reactPage.evaluate(() => document.documentElement.style.getPropertyValue('--font-scale').trim());
      expect(vanillaFontScale).toBe('1.25');
      expect(reactFontScale).toBe('1.25');

      const vanillaBeforeReset = await vanillaPage.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), STORAGE_KEY);
      const reactBeforeReset = await reactPage.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), STORAGE_KEY);
      expect(vanillaBeforeReset.settings.theme).toBe('light');
      expect(reactBeforeReset.settings.theme).toBe('light');
      expect(vanillaBeforeReset.settings.highContrast).toBe(true);
      expect(reactBeforeReset.settings.highContrast).toBe(true);
      expect(vanillaBeforeReset.settings.fontScale).toBe(1.25);
      expect(reactBeforeReset.settings.fontScale).toBe(1.25);

      vanillaPage.once('dialog', (dialog) => dialog.accept());
      reactPage.once('dialog', (dialog) => dialog.accept());
      await vanillaPage.locator('#reset-btn').click();
      await reactPage.locator('#reset-btn').click();

      await expect(vanillaPage.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(reactPage.locator('html')).toHaveAttribute('data-theme', 'dark');
      await expect(vanillaPage.locator('html')).toHaveAttribute('data-contrast', 'normal');
      await expect(reactPage.locator('html')).toHaveAttribute('data-contrast', 'normal');

      const vanillaAfterReset = await vanillaPage.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), STORAGE_KEY);
      const reactAfterReset = await reactPage.evaluate((key) => JSON.parse(window.localStorage.getItem(key) || '{}'), STORAGE_KEY);

      expect(vanillaAfterReset.settings.theme).toBe('dark');
      expect(reactAfterReset.settings.theme).toBe('dark');
      expect(vanillaAfterReset.settings.highContrast).toBe(false);
      expect(reactAfterReset.settings.highContrast).toBe(false);
      expect(vanillaAfterReset.settings.fontScale).toBe(1);
      expect(reactAfterReset.settings.fontScale).toBe(1);
      expect(Array.isArray(vanillaAfterReset.phrasesProgress.promptCompletedCategories)).toBe(true);
      expect(Array.isArray(reactAfterReset.phrasesProgress.promptCompletedCategories)).toBe(true);
    });
  });
});
