import { expect, test } from '@playwright/test';
import type { Browser, Page } from '@playwright/test';

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

async function getManifestCategoryCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const response = await fetch('/phrases.json', { cache: 'no-store' });
    const data = (await response.json()) as { categories?: unknown[] };
    return Array.isArray(data.categories) ? data.categories.length : 0;
  });
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
});
