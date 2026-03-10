import { useEffect, useMemo, useState } from 'react';
import type { CategoryManifest, DifficultyMode, PhraseCategoryData, PhraseLibraryManifest } from '../../types';

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

export function RoadmapView(props: { onBack: () => void }): React.JSX.Element {
  const { onBack } = props;
  const [difficulty, setDifficulty] = useState<DifficultyMode>('easy');
  const [categories, setCategories] = useState<CategoryManifest[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [phrases, setPhrases] = useState<Array<Pick<PhraseCategoryData['phrases'][number], 'it' | 'en'>>>([]);
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [loadingPhrases, setLoadingPhrases] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      try {
        setLoadingCategories(true);
        setError('');
        const response = await fetch('/phrases.json', { cache: 'force-cache' });
        const data = (await response.json()) as PhraseLibraryManifest;
        if (cancelled) return;
        const ordered = sortCategories(data.categories ?? []);
        setCategories(ordered);
        setActiveCategoryId((prev) => prev || ordered[0]?.id || '');
      } catch {
        if (!cancelled) setError('Could not load roadmap categories.');
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }

    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeCategoryId) ?? categories[0],
    [categories, activeCategoryId]
  );

  useEffect(() => {
    let cancelled = false;
    if (!activeCategory?.file) {
      setPhrases([]);
      return;
    }

    async function loadCategoryPhrases() {
      try {
        setLoadingPhrases(true);
        setError('');
        const response = await fetch(activeCategory.file, { cache: 'force-cache' });
        const data = (await response.json()) as PhraseCategoryData;
        if (!cancelled) setPhrases(data.phrases ?? []);
      } catch {
        if (!cancelled) setError('Could not load phrases for this category.');
      } finally {
        if (!cancelled) setLoadingPhrases(false);
      }
    }

    void loadCategoryPhrases();
    return () => {
      cancelled = true;
    };
  }, [activeCategory?.file]);

  return (
    <section className="react-card react-card--roadmap">
      <div className="roadmap-head">
        <h1>Roadmap (React WIP)</h1>
        <button className="btn btn--ghost" onClick={onBack}>
          Back to Landing
        </button>
      </div>

      <p className="section-note">Phase 3 scaffold: data loading + category and phrase lists. Practice logic will be migrated next.</p>

      <div className="chips" aria-label="Difficulty">
        {(['easy', 'intermediate', 'hard'] as DifficultyMode[]).map((mode) => (
          <button
            key={mode}
            className={`btn btn--ghost chip ${difficulty === mode ? 'is-active' : ''}`}
            onClick={() => setDifficulty(mode)}
          >
            {mode[0].toUpperCase() + mode.slice(1)}
          </button>
        ))}
      </div>

      {error ? <p className="message">{error}</p> : null}

      <div className="roadmap-grid">
        <section>
          <h2>Categories</h2>
          {loadingCategories ? <p>Loading categories…</p> : null}
          <div className="roadmap-list">
            {categories.map((category) => (
              <button
                key={category.id}
                className={`roadmap-cat ${activeCategory?.id === category.id ? 'is-active' : ''}`}
                onClick={() => setActiveCategoryId(category.id)}
              >
                <span>{category.name}</span>
                <span>{category.count}</span>
              </button>
            ))}
          </div>
        </section>

        <section>
          <h2>
            Phrases {activeCategory ? `· ${activeCategory.name}` : ''} <small>({difficulty})</small>
          </h2>
          {loadingPhrases ? <p>Loading phrases…</p> : null}
          <div className="phrase-list-react">
            {phrases.map((phrase, index) => (
              <article key={`${activeCategory?.id ?? 'cat'}-${index}`} className="phrase-item-react">
                <p className="phrase-it-react">{difficulty === 'hard' ? phrase.en : phrase.it}</p>
                <p className="phrase-en-react">{phrase.en}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </section>
  );
}