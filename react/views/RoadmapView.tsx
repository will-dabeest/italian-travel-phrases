import { useEffect, useMemo, useState } from 'react';
import { getFirstRoadmapPhraseIdForCategory, getNextRoadmapTarget } from '../../features/roadmap';
import { applyRoadmapRecognition, recognizeAndScore, toRecognitionErrorMessage } from '../pronunciation';
import { loadState } from '../../state/store';
import type { AppState, CategoryManifest, DifficultyMode, Phrase, PhraseCategoryData, PhraseLibraryManifest } from '../../types';
import { speakItalian } from '../../utils/audio';
import {
  getCategoryCompletion,
  getFirstUnlockedCategory,
  getPhraseIndex,
  isCategoryUnlocked,
  isModeUnlocked,
  isPhraseCompletedInMode,
  isRoadmapPhraseUnlocked
} from '../../utils/roadmap';

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
  const [appState, setAppState] = useState<AppState>(() => loadState());
  const [difficulty, setDifficulty] = useState<DifficultyMode>('easy');
  const [categories, setCategories] = useState<CategoryManifest[]>([]);
  const [allPhrases, setAllPhrases] = useState<Phrase[]>([]);
  const [activeCategoryId, setActiveCategoryId] = useState('');
  const [selectedPhraseId, setSelectedPhraseId] = useState('');
  const [loadingCategories, setLoadingCategories] = useState(true);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [recording, setRecording] = useState(false);
  const [feedbackPhraseId, setFeedbackPhraseId] = useState('');
  const [feedbackHtml, setFeedbackHtml] = useState('<p>Practice feedback appears here for the selected phrase.</p>');

  const isModeUnlockedForState = (mode: DifficultyMode): boolean => isModeUnlocked(appState, categories, mode);
  const getPhrasePasses = (phraseId: string): number => appState.roadmapProgress[difficulty][phraseId] ?? 0;

  useEffect(() => {
    let cancelled = false;

    async function loadRoadmapData() {
      try {
        setLoadingCategories(true);
        setError('');
        const response = await fetch('/phrases.json', { cache: 'force-cache' });
        const data = (await response.json()) as PhraseLibraryManifest;
        if (cancelled) return;

        const ordered = sortCategories(data.categories ?? []);
        const categoryFiles = await Promise.all(
          ordered.map(async (category) => {
            const categoryResponse = await fetch(category.file, { cache: 'force-cache' });
            const categoryData = (await categoryResponse.json()) as PhraseCategoryData;
            const phrases = (categoryData.phrases ?? []).map((phrase, index) => ({
              id: `${category.id}-${index}`,
              categoryId: category.id,
              categoryName: category.name,
              it: phrase.it,
              en: phrase.en
            }));
            return phrases;
          })
        );

        if (cancelled) return;
        setCategories(ordered);
        setAllPhrases(categoryFiles.flat());
        setActiveCategoryId((prev) => prev || ordered[0]?.id || '');
      } catch {
        if (!cancelled) setError('Could not load roadmap categories.');
      } finally {
        if (!cancelled) setLoadingCategories(false);
      }
    }

    void loadRoadmapData();
    return () => {
      cancelled = true;
    };
  }, []);

  const modeIsUnlocked = isModeUnlockedForState(difficulty);
  const firstUnlockedCategory = modeIsUnlocked ? getFirstUnlockedCategory(appState, categories, difficulty) : categories[0];
  const activeCategory = useMemo(() => {
    const found = categories.find((category) => category.id === activeCategoryId);
    if (!found) return firstUnlockedCategory;

    const index = categories.findIndex((category) => category.id === found.id);
    return index >= 0 && isCategoryUnlocked(appState, index, categories, difficulty) ? found : firstUnlockedCategory;
  }, [activeCategoryId, appState, categories, difficulty, firstUnlockedCategory]);

  useEffect(() => {
    if (activeCategory?.id && activeCategory.id !== activeCategoryId) {
      setActiveCategoryId(activeCategory.id);
    }
  }, [activeCategory, activeCategoryId]);

  const activePhrases = useMemo(
    () =>
      allPhrases
        .filter((phrase) => phrase.categoryId === activeCategory?.id)
        .sort((a, b) => getPhraseIndex(a.id) - getPhraseIndex(b.id)),
    [activeCategory?.id, allPhrases]
  );

  useEffect(() => {
    if (!activeCategory?.id) {
      setSelectedPhraseId('');
      return;
    }

    const unlockedPhraseId = getFirstRoadmapPhraseIdForCategory({
      categoryId: activeCategory.id,
      mode: difficulty,
      loadedPhrases: allPhrases,
      isPhraseCompletedInMode: (phraseId, mode) => isPhraseCompletedInMode(appState, phraseId, mode)
    });

    if (unlockedPhraseId && unlockedPhraseId !== selectedPhraseId) {
      setSelectedPhraseId(unlockedPhraseId);
      return;
    }

    if (!selectedPhraseId && activePhrases[0]?.id) {
      setSelectedPhraseId(activePhrases[0].id);
    }
  }, [activeCategory?.id, activePhrases, allPhrases, appState, difficulty, selectedPhraseId]);

  const selectedPhrase = activePhrases.find((phrase) => phrase.id === selectedPhraseId) ?? activePhrases[0];
  const selectedFeedback = selectedPhrase && feedbackPhraseId === selectedPhrase.id ? feedbackHtml : '<p>Practice feedback appears here for the selected phrase.</p>';
  const selectedPhrasePasses = selectedPhrase ? getPhrasePasses(selectedPhrase.id) : 0;
  const selectedCategoryCompletion =
    activeCategory && modeIsUnlocked ? getCategoryCompletion(appState, activeCategory, difficulty) : { complete: 0, total: 0, percent: 0 };
  const roadmapNextTarget =
    selectedPhrase && selectedPhrasePasses >= 3
      ? getNextRoadmapTarget({
          mode: difficulty,
          currentCategoryId: selectedPhrase.categoryId,
          currentPhraseId: selectedPhrase.id,
          orderedCategories: categories,
          loadedPhrases: allPhrases,
          isCategoryUnlocked: (index, ordered, mode) => isCategoryUnlocked(appState, index, ordered, mode),
          isModeUnlocked: (mode) => isModeUnlockedForState(mode),
          getFirstUnlockedCategory: (mode) => getFirstUnlockedCategory(appState, categories, mode)
        })
      : null;
  const nextTargetCategoryName =
    roadmapNextTarget ? categories.find((category) => category.id === roadmapNextTarget.categoryId)?.name ?? roadmapNextTarget.categoryId : '';

  return (
    <section className="react-card react-card--roadmap">
      <div className="roadmap-head">
        <h1>Roadmap</h1>
        <button className="btn btn--ghost" onClick={onBack}>
          Back to Landing
        </button>
      </div>

      <p className="section-note">Behavior parity mode: unlocks and pass counters follow roadmap state.</p>

      <div className="chips" aria-label="Difficulty">
        {(['easy', 'intermediate', 'hard'] as DifficultyMode[]).map((mode) => (
          <button
            key={mode}
            className={`btn btn--ghost chip ${difficulty === mode ? 'is-active' : ''}`}
            data-mode={mode}
            disabled={!isModeUnlockedForState(mode)}
            onClick={() => setDifficulty(mode)}
          >
            {mode[0].toUpperCase() + mode.slice(1)} {!isModeUnlockedForState(mode) ? '🔒' : ''}
          </button>
        ))}
      </div>

      {error ? <p className="message">{error}</p> : null}

      <div className="roadmap-grid">
        <section>
          <h2>Categories</h2>
          {loadingCategories ? <p>Loading categories…</p> : null}
          <div className="roadmap-list">
            {categories.map((category, index) => {
              const completion = getCategoryCompletion(appState, category, difficulty);
              const unlocked = modeIsUnlocked && isCategoryUnlocked(appState, index, categories, difficulty);
              const complete = completion.complete === completion.total && completion.total > 0;
              return (
                <button
                  key={category.id}
                  className={`roadmap-cat ${activeCategory?.id === category.id ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`}
                  data-roadmap-category={category.id}
                  disabled={!unlocked}
                  onClick={() => setActiveCategoryId(category.id)}
                >
                  <span>{category.name}</span>
                  <span>{complete ? '✅' : `${completion.complete}/${category.count}`}</span>
                </button>
              );
            })}
          </div>
        </section>

        <section>
          <h2>
            Phrases {activeCategory ? `· ${activeCategory.name}` : ''} <small>({difficulty})</small>
          </h2>
          {!modeIsUnlocked ? <p className="message">This mode is locked until the previous mode is fully complete.</p> : null}
          {modeIsUnlocked && selectedCategoryCompletion.total > 0 ? (
            <p className="section-note">
              Category progress: {selectedCategoryCompletion.complete}/{selectedCategoryCompletion.total} ({selectedCategoryCompletion.percent}%)
            </p>
          ) : null}
          {roadmapNextTarget ? (
            <p className="section-note" data-roadmap-next-target>
              Next target: {roadmapNextTarget.mode} · {nextTargetCategoryName} · Step {getPhraseIndex(roadmapNextTarget.phraseId) + 1}
            </p>
          ) : null}
          <div className="phrase-list-react">
            {activePhrases.map((phrase, index) => {
              const passes = getPhrasePasses(phrase.id);
              const done = passes >= 3;
              const unlocked = done || isRoadmapPhraseUnlocked(appState, phrase.categoryId, index, difficulty);
              return (
                <button
                  key={phrase.id}
                  className={`phrase-item-react roadmap-phrase ${selectedPhrase?.id === phrase.id ? 'is-active' : ''} ${unlocked ? '' : 'is-locked'}`}
                  data-roadmap-phrase={phrase.id}
                  disabled={!unlocked}
                  onClick={() => setSelectedPhraseId(phrase.id)}
                >
                  <p className="phrase-it-react">{difficulty === 'hard' ? phrase.en : phrase.it}</p>
                  <p className="phrase-en-react">{phrase.en}</p>
                  <p className="phrase-meta-react">{done ? '✅' : unlocked ? `${passes}/3` : '🔒'}</p>
                </button>
              );
            })}
          </div>

          <section className="practice card roadmap-practice-card" aria-label="Roadmap pronunciation practice">
            <h3>Pronunciation Practice</h3>
            {selectedPhrase ? (
              <>
                <p className="practice-it">{difficulty === 'hard' ? '••••••' : selectedPhrase.it}</p>
                <p className="practice-en">{selectedPhrase.en}</p>
                <div className="practice-actions">
                  <button
                    id="roadmap-speak-btn"
                    className="btn"
                    onClick={() => {
                      speakItalian(selectedPhrase.it).catch((playbackError) => {
                        setMessage(playbackError instanceof Error ? playbackError.message : 'Could not play pronunciation in this browser.');
                      });
                    }}
                  >
                    Play Audio
                  </button>
                  <button
                    id="roadmap-record-btn"
                    className={`btn btn--accent ${recording ? 'is-recording' : ''}`}
                    disabled={recording}
                    onClick={() => {
                      if (!selectedPhrase || recording) return;
                      setRecording(true);
                      setMessage('');

                      recognizeAndScore(selectedPhrase.it)
                        .then((result) => {
                          const apply = applyRoadmapRecognition({ state: appState, phrase: selectedPhrase, mode: difficulty });
                          const next = apply(result);
                          setAppState(next.nextState);
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
                <div className="feedback" id="roadmap-feedback" dangerouslySetInnerHTML={{ __html: selectedFeedback }}></div>
              </>
            ) : (
              <p>No phrase selected.</p>
            )}
            {message ? <p className="message">{message}</p> : null}
          </section>
        </section>
      </div>
    </section>
  );
}