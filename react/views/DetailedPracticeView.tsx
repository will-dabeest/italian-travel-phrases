import { useEffect, useMemo, useState } from 'react';
import { applyDetailedPracticeRecognition, recognizeAndScore, toRecognitionErrorMessage } from '../pronunciation';
import { loadState, resetState, saveState, updateStreak } from '../../state/store';
import type { AppState, CategoryManifest, Phrase, PhraseCategoryData, PhraseLibraryManifest, Settings } from '../../types';
import { speakItalian } from '../../utils/audio';
import { createInitialCard, isDue, overdueDays } from '../../utils/srs';

type FilterMode = 'all' | 'needs' | 'mastered' | 'difficult';
type SortMode = 'relevance' | 'least-progress' | 'most-progress';

const FEEDBACK_PLACEHOLDER_HTML = '<p>Practice feedback appears here for the selected phrase.</p>';

const CATEGORY_ORDER = [
  'greetings',
  'navigation',
  'transportation',
  'food',
  'hotels',
  'shopping',
  'social',
  'emergencies',
  'coffee',
  'trains',
  'restaurants_extra',
  'hotels_extra',
  'daily_extra'
];

function sortCategories(categories: CategoryManifest[]): CategoryManifest[] {
  const rank = new Map(CATEGORY_ORDER.map((id, index) => [id, index]));
  return [...categories].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

function similarity(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left && !right) return 1;
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.includes(right) || right.includes(left)) return Math.min(left.length, right.length) / Math.max(left.length, right.length);

  const leftTokens = new Set(left.split(/\s+/));
  const rightTokens = new Set(right.split(/\s+/));
  let overlap = 0;
  for (const token of leftTokens) {
    if (rightTokens.has(token)) overlap += 1;
  }
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? overlap / union : 0;
}

function applySettings(settings: Settings): void {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  document.documentElement.style.setProperty('--font-scale', String(settings.fontScale));
}

export function DetailedPracticeView(props: { onBack: () => void; onStateChanged?: (nextState: AppState) => void }): React.JSX.Element {
  const { onBack, onStateChanged } = props;
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [categories, setCategories] = useState<CategoryManifest[]>([]);
  const [phrases, setPhrases] = useState<Phrase[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [feedbackPhraseId, setFeedbackPhraseId] = useState('');
  const [feedbackHtml, setFeedbackHtml] = useState(FEEDBACK_PLACEHOLDER_HTML);

  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [filter, setFilter] = useState<FilterMode>('all');
  const [sortMode, setSortMode] = useState<SortMode>('relevance');
  const [selectedPhraseId, setSelectedPhraseId] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadAll() {
      try {
        setLoading(true);
        setError('');
        const response = await fetch('/phrases.json', { cache: 'force-cache' });
        const data = (await response.json()) as PhraseLibraryManifest;
        const ordered = sortCategories(data.categories ?? []);

        const phraseGroups = await Promise.all(
          ordered.map(async (category) => {
            const categoryResponse = await fetch(category.file, { cache: 'force-cache' });
            const categoryData = (await categoryResponse.json()) as PhraseCategoryData;
            return (categoryData.phrases ?? []).map((phrase, index) => ({
              id: `${category.id}-${index}`,
              categoryId: category.id,
              categoryName: category.name,
              it: phrase.it,
              en: phrase.en
            }));
          })
        );

        if (cancelled) return;
        const loaded = phraseGroups.flat();
        setCategories(ordered);
        setPhrases(loaded);
        setSelectedPhraseId((current) => current || loaded[0]?.id || '');
      } catch {
        if (!cancelled) setError('Could not load detailed practice content.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadAll();
    return () => {
      cancelled = true;
    };
  }, []);

  const averageAccuracy = (phraseId: string): number => {
    const progress = appState.progress[phraseId];
    if (!progress || progress.attempts === 0) return 0.7;
    return progress.totalAccuracy / progress.attempts;
  };

  const isMastered = (phraseId: string): boolean => Boolean(appState.progress[phraseId]?.mastered);
  const isDifficult = (phraseId: string): boolean => Boolean(appState.progress[phraseId]?.difficult);

  const isNeedsPractice = (phraseId: string): boolean => {
    const progress = appState.progress[phraseId];
    if (!progress || progress.attempts === 0) return true;
    if (progress.mastered) return false;

    const average = progress.totalAccuracy / Math.max(1, progress.attempts);
    const card = appState.srs[phraseId] ?? createInitialCard();
    return progress.difficult || average < 0.85 || isDue(card);
  };

  const getPhraseProgress = (phraseId: string): { percent: number; attempts: number; label: string } => {
    const progress = appState.progress[phraseId];
    if (!progress || progress.attempts === 0) return { percent: 0, attempts: 0, label: 'New' };

    const average = progress.totalAccuracy / Math.max(1, progress.attempts);
    const card = appState.srs[phraseId] ?? createInitialCard();
    const intervalScore = Math.min(1, card.interval / 30);
    const masteryScore = Math.min(1, average * 0.75 + intervalScore * 0.25);
    const percent = Math.round(masteryScore * 100);

    let label = 'Learning';
    if (progress.mastered || percent >= 85) label = 'Strong';
    else if (progress.difficult || percent < 45) label = 'Needs Focus';

    return { percent, attempts: progress.attempts, label };
  };

  const searchScore = (phrase: Phrase, query: string): number => {
    if (!query) return 1;
    const normalizedQuery = query.toLowerCase();
    if (phrase.it.toLowerCase().includes(normalizedQuery) || phrase.en.toLowerCase().includes(normalizedQuery)) return 1;
    return Math.max(similarity(phrase.it, query), similarity(phrase.en, query));
  };

  const visiblePhrases = useMemo(() => {
    const q = search.trim();
    const filtered = phrases
      .filter((phrase) => (selectedCategory === 'all' ? true : phrase.categoryId === selectedCategory))
      .filter((phrase) => (q ? searchScore(phrase, q) >= 0.42 : true))
      .filter((phrase) => {
        if (filter === 'all') return true;
        if (filter === 'mastered') return isMastered(phrase.id);
        if (filter === 'difficult') return isDifficult(phrase.id);
        return isNeedsPractice(phrase.id);
      });

    if (sortMode === 'least-progress') return filtered.sort((a, b) => getPhraseProgress(a.id).percent - getPhraseProgress(b.id).percent);
    if (sortMode === 'most-progress') return filtered.sort((a, b) => getPhraseProgress(b.id).percent - getPhraseProgress(a.id).percent);
    return filtered.sort((a, b) => searchScore(b, q) - searchScore(a, q));
  }, [phrases, selectedCategory, search, filter, sortMode]);

  const selectedPhrase =
    phrases.find((item) => item.id === selectedPhraseId) ?? visiblePhrases[0] ?? phrases[0];
  const selectedFeedback = selectedPhrase && feedbackPhraseId === selectedPhrase.id ? feedbackHtml : FEEDBACK_PLACEHOLDER_HTML;

  useEffect(() => {
    if (selectedPhrase && selectedPhrase.id !== selectedPhraseId) {
      setSelectedPhraseId(selectedPhrase.id);
    }
  }, [selectedPhrase, selectedPhraseId]);

  const updateAppState = (nextState: AppState): void => {
    setAppState(nextState);
    saveState(nextState);
    onStateChanged?.(nextState);
  };

  const due = phrases.filter((phrase) => isDue(appState.srs[phrase.id] ?? createInitialCard()));
  const overdueCount = due.filter((phrase) => overdueDays(appState.srs[phrase.id] ?? createInitialCard()) > 0).length;

  return (
    <section className="react-card react-card--detailed">
      <div className="roadmap-head">
        <h1>Detailed Practice</h1>
        <div className="landing-actions">
          <button className="btn btn--ghost" onClick={onBack}>
            Back to Landing
          </button>
          <button
            id="settings-toggle"
            className="btn btn--ghost"
            aria-label="Settings"
            aria-controls="settings-panel"
            aria-expanded={settingsOpen}
            onClick={() => setSettingsOpen((current) => !current)}
          >
            Settings
          </button>
        </div>
      </div>

      <p className="section-note">
        Streak: <strong>{appState.streak}</strong> · Due: <strong>{due.length}</strong> · Overdue: <strong>{overdueCount}</strong>
      </p>

      <section className="controls" aria-label="Phrase controls">
        <input
          id="search"
          type="search"
          value={search}
          placeholder="Search Italian or English"
          aria-label="Search phrases"
          onChange={(event) => setSearch(event.target.value)}
        />

        <label className="sort-control">
          Sort phrases
          <select id="sort-select" aria-label="Sort phrases" value={sortMode} onChange={(event) => setSortMode(event.target.value as SortMode)}>
            <option value="relevance">Best match</option>
            <option value="least-progress">Least progress first</option>
            <option value="most-progress">Most progress first</option>
          </select>
        </label>

        <div className="chips" role="tablist" aria-label="Filter phrases">
          {(['all', 'needs', 'mastered', 'difficult'] as FilterMode[]).map((key) => (
            <button
              key={key}
              className={`chip ${filter === key ? 'is-active' : ''}`}
              data-filter={key}
              role="tab"
              aria-selected={filter === key}
              onClick={() => setFilter(key)}
            >
              {key === 'all' ? 'All' : key === 'needs' ? 'Needs Practice' : key[0].toUpperCase() + key.slice(1)}
            </button>
          ))}
        </div>

        <div className="categories" role="tablist" aria-label="Categories">
          <button className={`chip ${selectedCategory === 'all' ? 'is-active' : ''}`} data-category="all" onClick={() => setSelectedCategory('all')}>
            All
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`chip ${selectedCategory === category.id ? 'is-active' : ''}`}
              data-category={category.id}
              onClick={() => setSelectedCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </section>

      {error ? <p className="message">{error}</p> : null}
      {loading ? <p>Loading phrases…</p> : null}

      <main className="content" role="main">
        <section className="library card" aria-label="Phrase library">
          <h2>Phrase Library</h2>
          <div className="phrase-list" id="phrase-list">
            {visiblePhrases.map((phrase) => {
              const card = appState.srs[phrase.id] ?? createInitialCard();
              const overdue = overdueDays(card);
              const phraseProgress = getPhraseProgress(phrase.id);
              return (
                <button
                  key={phrase.id}
                  className={`phrase-item ${selectedPhrase?.id === phrase.id ? 'is-active' : ''}`}
                  data-phrase-id={phrase.id}
                  onClick={() => {
                    setSelectedPhraseId(phrase.id);
                    setMessage('');
                  }}
                >
                  <div className="phrase-it">{phrase.it}</div>
                  <div className="phrase-en">{phrase.en}</div>
                  <div className="phrase-meta">
                    {isNeedsPractice(phrase.id) && !isMastered(phrase.id) ? <span className="badge badge--needs">Needs Practice</span> : null}
                    {isMastered(phrase.id) ? <span className="badge badge--mastered">Mastered</span> : null}
                    {isDifficult(phrase.id) ? <span className="badge badge--difficult">Difficult</span> : null}
                    {overdue > 0 ? <span className="badge badge--overdue">Overdue {overdue}d</span> : null}
                  </div>
                  <div className="phrase-progress" aria-label={`Progress ${phraseProgress.percent} percent, ${phraseProgress.attempts} attempts`}>
                    <div className="phrase-progress__row">
                      <span>{phraseProgress.label}</span>
                      <span>
                        {phraseProgress.percent}% · {phraseProgress.attempts} tries
                      </span>
                    </div>
                    <div className="phrase-progress__track">
                      <span className="phrase-progress__fill" style={{ width: `${phraseProgress.percent}%` }}></span>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        <section className="practice card" aria-label="Pronunciation practice">
          <h2>Pronunciation Practice</h2>
          {selectedPhrase ? (
            <>
              <p className="practice-it">{selectedPhrase.it}</p>
              <p className="practice-en">{selectedPhrase.en}</p>
              <div className="practice-actions">
                <button
                  id="speak-btn"
                  className="btn"
                  onClick={() => {
                    if (!selectedPhrase) return;
                    speakItalian(selectedPhrase.it).catch((playbackError) => {
                      setMessage(playbackError instanceof Error ? playbackError.message : 'Could not play pronunciation in this browser.');
                    });
                  }}
                >
                  Play Audio
                </button>
                <button
                  id="record-btn"
                  className={`btn btn--accent ${recording ? 'is-recording' : ''}`}
                  disabled={recording}
                  onClick={() => {
                    if (!selectedPhrase || recording) return;
                    setRecording(true);
                    setMessage('');

                    recognizeAndScore(selectedPhrase.it)
                      .then((result) => {
                        const apply = applyDetailedPracticeRecognition({ state: appState, phrase: selectedPhrase });
                        const next = apply(result);
                        updateAppState(next.nextState);
                        setFeedbackPhraseId(selectedPhrase.id);
                        setFeedbackHtml(next.feedbackHtml);
                      })
                      .catch((recognitionError) => {
                        setMessage(toRecognitionErrorMessage(recognitionError));
                      })
                      .finally(() => {
                        setRecording(false);
                      });
                  }}
                >
                  {recording ? 'Listening…' : 'Speak Now'}
                </button>
              </div>
            </>
          ) : (
            <p>No phrase available with current filters.</p>
          )}

          <div className="feedback" id="feedback" dangerouslySetInnerHTML={{ __html: selectedFeedback }}></div>
          {message ? <p className="message">{message}</p> : null}
        </section>
      </main>

      <aside id="settings-panel" className="settings card" hidden={!settingsOpen} aria-label="Settings panel">
        <h2>Settings</h2>
        <label>
          <span>Theme</span>
          <select
            id="theme-select"
            aria-label="Theme"
            value={appState.settings.theme}
            onChange={(event) => {
              const nextState = structuredClone(appState);
              nextState.settings.theme = event.target.value === 'light' ? 'light' : 'dark';
              applySettings(nextState.settings);
              updateAppState(nextState);
            }}
          >
            <option value="dark">Dark</option>
            <option value="light">Light</option>
          </select>
        </label>
        <label className="switch">
          <input
            id="contrast-toggle"
            type="checkbox"
            checked={appState.settings.highContrast}
            onChange={(event) => {
              const nextState = structuredClone(appState);
              nextState.settings.highContrast = event.target.checked;
              applySettings(nextState.settings);
              updateAppState(nextState);
            }}
          />{' '}
          High contrast
        </label>
        <label>
          <span>Font size</span>
          <input
            id="font-range"
            type="range"
            min="0.9"
            max="1.25"
            step="0.05"
            value={appState.settings.fontScale}
            aria-label="Font size"
            onInput={(event) => {
              const target = event.target as HTMLInputElement;
              const nextState = structuredClone(appState);
              nextState.settings.fontScale = Number(target.value);
              applySettings(nextState.settings);
              updateAppState(nextState);
            }}
          />
        </label>
        <button
          id="reset-btn"
          className="btn btn--danger"
          aria-label="Reset local data"
          onClick={() => {
            if (!window.confirm('Reset all saved progress and preferences?')) return;
            const nextState = resetState();
            updateStreak(nextState);
            applySettings(nextState.settings);
            updateAppState(nextState);
            setFeedbackPhraseId('');
            setFeedbackHtml(FEEDBACK_PLACEHOLDER_HTML);
            setMessage('');
          }}
        >
          Reset all progress
        </button>
      </aside>
    </section>
  );
}
