import type { CategoryManifest, Phrase } from '../types';
import { escapeHtml } from './dom';

interface TopbarAction {
  id: string;
  label?: string;
  variant?: 'ghost' | 'icon';
  disabled?: boolean;
  ariaLabel?: string;
  ariaExpanded?: 'true' | 'false';
  ariaControls?: string;
  iconUseHref?: string;
}

export function renderLandingSection(options: { isPhrasesUnlocked: boolean; showInstall: boolean }): string {
  const { isPhrasesUnlocked, showInstall } = options;
  return `<section class="landing card"><h1>Italian Travel Phrase Trainer</h1><p class="section-note">Recommended: follow the roadmap and complete categories in order.</p><div class="landing-actions"><button id="go-roadmap" class="btn btn--accent">Roadmap</button><button id="go-detailed" class="btn btn--ghost">Practice</button><button id="go-phrases" class="btn btn--ghost" ${
    isPhrasesUnlocked ? '' : 'disabled'
  }>Phrases ${isPhrasesUnlocked ? '' : '🔒'}</button><button id="install-btn" class="btn btn--ghost ${
    showInstall ? '' : 'is-hidden'
  }" aria-label="Install app">Install App</button></div></section>`;
}

export function renderTopbar(params: {
  title: string;
  subtitleHtml: string;
  actions: TopbarAction[];
  role?: string;
}): string {
  const { title, subtitleHtml, actions, role } = params;

  return `<header class="topbar"${role ? ` role="${role}"` : ''}><div class="brand"><img src="/assets/logo.svg" alt="App logo" width="36" height="36" /><div><h1>${escapeHtml(
    title
  )}</h1><p>${subtitleHtml}</p></div></div><div class="header-actions">${actions
    .map((action) => {
      const classes = action.variant === 'icon' ? 'btn btn--icon' : 'btn btn--ghost';
      const label = action.iconUseHref
        ? `<svg aria-hidden="true" width="20" height="20"><use href="${escapeHtml(action.iconUseHref)}"></use></svg>`
        : escapeHtml(action.label ?? '');
      const ariaLabel = action.ariaLabel ? ` aria-label="${escapeHtml(action.ariaLabel)}"` : '';
      const ariaExpanded = action.ariaExpanded ? ` aria-expanded="${action.ariaExpanded}"` : '';
      const ariaControls = action.ariaControls ? ` aria-controls="${escapeHtml(action.ariaControls)}"` : '';

      return `<button id="${escapeHtml(action.id)}" class="${classes}"${action.disabled ? ' disabled' : ''}${ariaLabel}${ariaExpanded}${ariaControls}>${label}</button>`;
    })
    .join('')}</div></header>`;
}

export function renderPhraseItemButton(params: {
  phrase: Phrase;
  isActive: boolean;
  badgesHtml: string;
  progress: { percent: number; attempts: number; label: string };
}): string {
  const { phrase, isActive, badgesHtml, progress } = params;

  return `<button class="phrase-item ${isActive ? 'is-active' : ''}" data-phrase-id="${phrase.id}" aria-label="Practice ${escapeHtml(phrase.it)}"><div class="phrase-it">${escapeHtml(phrase.it)}</div><div class="phrase-en">${escapeHtml(phrase.en)}</div><div class="phrase-meta">${badgesHtml}</div><div class="phrase-progress" aria-label="Progress ${progress.percent} percent, ${progress.attempts} attempts"><div class="phrase-progress__row"><span>${progress.label}</span><span>${progress.percent}% · ${progress.attempts} tries</span></div><div class="phrase-progress__track"><span class="phrase-progress__fill" style="width:${progress.percent}%"></span></div></div></button>`;
}

export function renderRoadmapCategoryButton(params: {
  category: CategoryManifest;
  completion: { complete: number; total: number; percent: number };
  isActive: boolean;
  isUnlocked: boolean;
}): string {
  const { category, completion, isActive, isUnlocked } = params;
  const lockIcon = isUnlocked ? '🔓' : '🔒';

  return `<button class="roadmap-cat ${isActive ? 'is-active' : ''} ${isUnlocked ? '' : 'is-locked'}" data-roadmap-category="${category.id}" ${
    isUnlocked ? '' : 'disabled'
  } aria-label="${escapeHtml(category.name)}"><div class="roadmap-cat__head"><span>${lockIcon} ${escapeHtml(category.name)}</span><span>${completion.complete}/${completion.total}</span></div><div class="roadmap-cat__track"><span style="width:${completion.percent}%"></span></div></button>`;
}

export function renderPhrasesCategoryPathPanel(params: {
  dataAttribute: string;
  categories: Array<{
    id: string;
    name: string;
    isActive: boolean;
    isUnlocked: boolean;
    progress: { complete: number; total: number; percent: number };
  }>;
}): string {
  const { dataAttribute, categories } = params;

  return `<details class="card roadmap-panel"><summary>Category Path</summary><div class="roadmap-list">${categories
    .map((category) => {
      const lockIcon = category.isUnlocked ? '🔓' : '🔒';
      return `<button class="roadmap-cat ${category.isActive ? 'is-active' : ''} ${category.isUnlocked ? '' : 'is-locked'}" ${dataAttribute}="${
        category.id
      }" ${category.isUnlocked ? '' : 'disabled'}><div class="roadmap-cat__head"><span>${lockIcon} ${escapeHtml(category.name)}</span><span>${
        `${category.progress.complete}/${category.progress.total}`
      }</span></div><div class="roadmap-cat__track"><span style="width:${category.progress.percent}%"></span></div></button>`;
    })
    .join('')}</div></details>`;
}

export function renderPhrasesCurrentStateCard(params: {
  categoryName: string;
  itemLabel: string;
  statusLabel: string;
  phaseLabel?: string;
}): string {
  const { categoryName, itemLabel, statusLabel, phaseLabel } = params;

  return `<section class="card roadmap-state"><h2>Current State</h2><p><strong>Category:</strong> ${escapeHtml(
    categoryName
  )}</p>${phaseLabel ? `<p><strong>Phase:</strong> ${escapeHtml(phaseLabel)}</p>` : ''}<p><strong>Item:</strong> ${escapeHtml(
    itemLabel
  )}</p><p><strong>Status:</strong> ${escapeHtml(statusLabel)}</p></section>`;
}
