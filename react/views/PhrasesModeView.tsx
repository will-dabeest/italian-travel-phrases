import { useEffect, useMemo, useState } from 'react';
import convoData from '../../convo.json';
import { recognizeAndScore, toRecognitionErrorMessage } from '../pronunciation';
import { saveState, loadState } from '../../state/store';
import type {
  AppState,
  CategoryManifest,
  CategoryPhase,
  ConvoCategory,
  ConvoLibraryRaw,
  PhrasesStage,
  PromptCategory,
  ResponseCategory
} from '../../types';
import { speakItalian } from '../../utils/audio';
import { buildConvoDerivedData } from '../../utils/convo';
import { progressLabel } from '../../utils/format';
import {
  getFirstUnlockedPhrasesCategoryId,
  getNextUnlockedPhrasesCategoryId,
  isPhrasesCategoryUnlockedAtIndex,
  isPhrasesStageFullyCompleted
} from '../../utils/phrases';
import { isModeFullyCompleted } from '../../utils/roadmap';

type PhrasesViewMode = 'home' | 'prompt' | 'response' | 'convo';

type UnitLike = { id: string; it: string; en: string };

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

const LOCAL_UNLOCK_OVERRIDE =
  new URLSearchParams(window.location.search).get('unlockAll') === '1' ||
  new URLSearchParams(window.location.search).get('unlockAll') === 'true';

function sortCategories(categories: CategoryManifest[]): CategoryManifest[] {
  const rank = new Map(CATEGORY_ORDER.map((id, index) => [id, index]));
  return [...categories].sort((a, b) => (rank.get(a.id) ?? 999) - (rank.get(b.id) ?? 999));
}

function shuffledIds(ids: string[]): string[] {
  const next = [...ids];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

export function PhrasesModeView(props: { onBack: () => void }): React.JSX.Element {
  const { onBack } = props;
  const [state, setState] = useState<AppState>(() => loadState());
  const [manifestCategories, setManifestCategories] = useState<CategoryManifest[]>([]);
  const [viewMode, setViewMode] = useState<PhrasesViewMode>('home');
  const [recording, setRecording] = useState(false);
  const [message, setMessage] = useState('');

  const [promptCategoryId, setPromptCategoryId] = useState('');
  const [promptPhase, setPromptPhase] = useState<CategoryPhase>('learn');
  const [promptLearnIndex, setPromptLearnIndex] = useState(0);
  const [promptMatchAudioSelected, setPromptMatchAudioSelected] = useState('');
  const [promptMatchEnglishSelected, setPromptMatchEnglishSelected] = useState('');
  const [promptMatchedIds, setPromptMatchedIds] = useState<Set<string>>(new Set());
  const [promptAudioOrder, setPromptAudioOrder] = useState<string[]>([]);
  const [promptEnglishOrder, setPromptEnglishOrder] = useState<string[]>([]);

  const [responseCategoryId, setResponseCategoryId] = useState('');
  const [responsePhase, setResponsePhase] = useState<CategoryPhase>('learn');
  const [responseLearnIndex, setResponseLearnIndex] = useState(0);
  const [responseMatchAudioSelected, setResponseMatchAudioSelected] = useState('');
  const [responseMatchEnglishSelected, setResponseMatchEnglishSelected] = useState('');
  const [responseMatchedIds, setResponseMatchedIds] = useState<Set<string>>(new Set());
  const [responseAudioOrder, setResponseAudioOrder] = useState<string[]>([]);
  const [responseEnglishOrder, setResponseEnglishOrder] = useState<string[]>([]);
  const [responseSpeakIndex, setResponseSpeakIndex] = useState(0);
  const [responseSpeakPasses, setResponseSpeakPasses] = useState(0);

  const [convoCategoryId, setConvoCategoryId] = useState('');
  const [convoSpeakIndex, setConvoSpeakIndex] = useState(0);

  const convoDerived = useMemo(() => buildConvoDerivedData(convoData as ConvoLibraryRaw), []);
  const promptCategories = convoDerived.promptCategories;
  const responseCategories = convoDerived.responseCategories;
  const convoCategories = convoDerived.convoCategories;

  useEffect(() => {
    let cancelled = false;

    async function loadManifest() {
      const response = await fetch('/phrases.json', { cache: 'force-cache' });
      const data = (await response.json()) as { categories?: CategoryManifest[] };
      if (cancelled) return;
      setManifestCategories(sortCategories(data.categories ?? []));
    }

    void loadManifest();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistState = (next: AppState) => {
    setState(next);
    saveState(next);
  };

  const isPhrasesModeUnlocked = (): boolean => {
    if (LOCAL_UNLOCK_OVERRIDE) return true;
    return isModeFullyCompleted(state, manifestCategories, 'hard');
  };

  const getStageCompletedCategories = (stage: PhrasesStage): string[] => {
    if (stage === 'prompt') return state.phrasesProgress.promptCompletedCategories;
    if (stage === 'response') return state.phrasesProgress.responseCompletedCategories;
    return state.phrasesProgress.convoCompletedCategories;
  };

  const isStageFullyCompleted = (stage: PhrasesStage): boolean => {
    const categories = stage === 'prompt' ? promptCategories : stage === 'response' ? responseCategories : convoCategories;
    return isPhrasesStageFullyCompleted(categories, getStageCompletedCategories(stage));
  };

  const isPhrasesSubModeUnlocked = (stage: PhrasesStage): boolean => {
    if (LOCAL_UNLOCK_OVERRIDE) return true;
    if (!isPhrasesModeUnlocked()) return false;
    if (stage === 'prompt') return true;
    if (stage === 'response') return isStageFullyCompleted('prompt');
    return isStageFullyCompleted('response');
  };

  const isPhrasesCategoryUnlocked = (stage: PhrasesStage, categoryIndex: number): boolean => {
    const categories = stage === 'prompt' ? promptCategories : stage === 'response' ? responseCategories : convoCategories;
    return isPhrasesCategoryUnlockedAtIndex(categoryIndex, categories, getStageCompletedCategories(stage), LOCAL_UNLOCK_OVERRIDE);
  };

  const getFirstUnlockedCategoryId = (stage: PhrasesStage): string => {
    const categories = stage === 'prompt' ? promptCategories : stage === 'response' ? responseCategories : convoCategories;
    return getFirstUnlockedPhrasesCategoryId(categories, getStageCompletedCategories(stage), LOCAL_UNLOCK_OVERRIDE);
  };

  const initializePromptCategory = (categoryId: string) => {
    const category = promptCategories.find((item) => item.id === categoryId);
    if (!category) return;
    setPromptCategoryId(category.id);
    setPromptPhase('learn');
    setPromptLearnIndex(0);
    setPromptMatchAudioSelected('');
    setPromptMatchEnglishSelected('');
    setPromptMatchedIds(new Set());
    const ids = category.units.map((u) => u.id);
    setPromptAudioOrder(shuffledIds(ids));
    setPromptEnglishOrder(shuffledIds(ids));
    setMessage('');
  };

  const initializeResponseCategory = (categoryId: string) => {
    const category = responseCategories.find((item) => item.id === categoryId);
    if (!category) return;
    setResponseCategoryId(category.id);
    setResponsePhase('learn');
    setResponseLearnIndex(0);
    setResponseMatchAudioSelected('');
    setResponseMatchEnglishSelected('');
    setResponseMatchedIds(new Set());
    const ids = category.units.map((u) => u.id);
    setResponseAudioOrder(shuffledIds(ids));
    setResponseEnglishOrder(shuffledIds(ids));
    setResponseSpeakIndex(0);
    setResponseSpeakPasses(0);
    setMessage('');
  };

  const initializeConvoCategory = (categoryId: string) => {
    const category = convoCategories.find((item) => item.id === categoryId);
    if (!category) return;
    setConvoCategoryId(category.id);
    setConvoSpeakIndex(0);
    setMessage('');
  };

  const markStageCategoryCompleted = (stage: PhrasesStage, categoryId: string) => {
    const next = structuredClone(state);
    const list =
      stage === 'prompt'
        ? next.phrasesProgress.promptCompletedCategories
        : stage === 'response'
        ? next.phrasesProgress.responseCompletedCategories
        : next.phrasesProgress.convoCompletedCategories;
    if (!list.includes(categoryId)) {
      list.push(categoryId);
      persistState(next);
    }
  };

  const getNextExerciseTarget = (stage: PhrasesStage, currentCategoryId: string): { stage: PhrasesStage; categoryId: string } | null => {
    const categories = stage === 'prompt' ? promptCategories : stage === 'response' ? responseCategories : convoCategories;
    const nextCategoryId = getNextUnlockedPhrasesCategoryId(
      categories,
      getStageCompletedCategories(stage),
      LOCAL_UNLOCK_OVERRIDE,
      currentCategoryId
    );
    if (nextCategoryId) return { stage, categoryId: nextCategoryId };

    if (stage === 'prompt' && isStageFullyCompleted('prompt') && isPhrasesSubModeUnlocked('response')) {
      const firstResponse = getFirstUnlockedCategoryId('response');
      return firstResponse ? { stage: 'response', categoryId: firstResponse } : null;
    }

    if (stage === 'response' && isStageFullyCompleted('response') && isPhrasesSubModeUnlocked('convo')) {
      const firstConvo = getFirstUnlockedCategoryId('convo');
      return firstConvo ? { stage: 'convo', categoryId: firstConvo } : null;
    }

    return null;
  };

  const goToTarget = (target: { stage: PhrasesStage; categoryId: string }) => {
    if (target.stage === 'prompt') initializePromptCategory(target.categoryId);
    else if (target.stage === 'response') initializeResponseCategory(target.categoryId);
    else initializeConvoCategory(target.categoryId);

    setViewMode(target.stage === 'prompt' ? 'prompt' : target.stage === 'response' ? 'response' : 'convo');
    setMessage('');
  };

  const currentPromptCategory = promptCategories.find((c) => c.id === promptCategoryId) ?? promptCategories[0];
  const currentResponseCategory = responseCategories.find((c) => c.id === responseCategoryId) ?? responseCategories[0];
  const currentConvoCategory = convoCategories.find((c) => c.id === convoCategoryId) ?? convoCategories[0];

  useEffect(() => {
    if (viewMode === 'prompt' && !promptCategoryId && promptCategories[0]) initializePromptCategory(getFirstUnlockedCategoryId('prompt'));
    if (viewMode === 'response' && !responseCategoryId && responseCategories[0]) initializeResponseCategory(getFirstUnlockedCategoryId('response'));
    if (viewMode === 'convo' && !convoCategoryId && convoCategories[0]) initializeConvoCategory(getFirstUnlockedCategoryId('convo'));
  }, [viewMode, promptCategories.length, responseCategories.length, convoCategories.length]);

  const handlePromptMatchSelection = () => {
    if (!promptMatchAudioSelected || !promptMatchEnglishSelected) return;

    if (promptMatchAudioSelected === promptMatchEnglishSelected) {
      const next = new Set(promptMatchedIds);
      next.add(promptMatchAudioSelected);
      setPromptMatchedIds(next);
      setPromptMatchAudioSelected('');
      setPromptMatchEnglishSelected('');

      if (currentPromptCategory && next.size === currentPromptCategory.units.length) {
        markStageCategoryCompleted('prompt', currentPromptCategory.id);
      }
      return;
    }

    setPromptMatchedIds(new Set());
    setPromptMatchAudioSelected('');
    setPromptMatchEnglishSelected('');
    setMessage('Incorrect match. The exercise has been reset — try again.');
  };

  useEffect(() => {
    handlePromptMatchSelection();
  }, [promptMatchAudioSelected, promptMatchEnglishSelected]);

  const handleResponseMatchSelection = () => {
    if (!responseMatchAudioSelected || !responseMatchEnglishSelected) return;

    if (responseMatchAudioSelected === responseMatchEnglishSelected) {
      const next = new Set(responseMatchedIds);
      next.add(responseMatchAudioSelected);
      setResponseMatchedIds(next);
      setResponseMatchAudioSelected('');
      setResponseMatchEnglishSelected('');

      if (currentResponseCategory && next.size === currentResponseCategory.units.length) {
        setResponsePhase('speak');
        setResponseSpeakIndex(0);
        setResponseSpeakPasses(0);
      }
      return;
    }

    setResponseMatchedIds(new Set());
    setResponseMatchAudioSelected('');
    setResponseMatchEnglishSelected('');
    setMessage('Incorrect match. The exercise has been reset — try again.');
  };

  useEffect(() => {
    handleResponseMatchSelection();
  }, [responseMatchAudioSelected, responseMatchEnglishSelected]);

  const runResponseSpeakingChallenge = () => {
    const unit = currentResponseCategory?.units[responseSpeakIndex];
    if (!unit || recording) return;

    setRecording(true);
    recognizeAndScore(unit.it)
      .then((result) => {
        if (result.similarity >= 0.7) {
          const nextPasses = responseSpeakPasses + 1;
          setResponseSpeakPasses(nextPasses);
          setMessage(`Correct (${Math.round(result.similarity * 100)}%). Pass ${nextPasses}/3.`);
          if (nextPasses >= 3) {
            const nextIndex = responseSpeakIndex + 1;
            setResponseSpeakIndex(nextIndex);
            setResponseSpeakPasses(0);
            if (currentResponseCategory && nextIndex >= currentResponseCategory.units.length) {
              markStageCategoryCompleted('response', currentResponseCategory.id);
            }
          }
        } else {
          setResponseSpeakPasses(0);
          setMessage(`Below threshold (${Math.round(result.similarity * 100)}%). Passes reset.`);
        }
      })
      .catch((error) => setMessage(toRecognitionErrorMessage(error)))
      .finally(() => setRecording(false));
  };

  const runConvoSpeakingChallenge = () => {
    const unit = currentConvoCategory?.units[convoSpeakIndex];
    if (!unit || recording) return;

    setRecording(true);
    recognizeAndScore(unit.responseIt)
      .then((result) => {
        if (result.similarity >= 0.7) {
          const nextIndex = convoSpeakIndex + 1;
          setConvoSpeakIndex(nextIndex);
          setMessage(`Passed ${Math.round(result.similarity * 100)}% for “${unit.promptIt}” → “${unit.responseIt}”.`);
          if (currentConvoCategory && nextIndex >= currentConvoCategory.units.length) {
            markStageCategoryCompleted('convo', currentConvoCategory.id);
          }
        } else {
          setMessage(`Below threshold (${Math.round(result.similarity * 100)}%) for “${unit.promptIt}” → “${unit.responseIt}”. Try again.`);
        }
      })
      .catch((error) => setMessage(toRecognitionErrorMessage(error)))
      .finally(() => setRecording(false));
  };

  if (viewMode === 'home') {
    const promptUnlocked = isPhrasesSubModeUnlocked('prompt');
    const responseUnlocked = isPhrasesSubModeUnlocked('response');
    const convoUnlocked = isPhrasesSubModeUnlocked('convo');

    return (
      <section className="react-card">
        <h1>Phrases Mode</h1>
        <p className="section-note">Unlock Prompt → Response → Convo by completing each stage in order.</p>
        <div className="landing-actions">
          <button className="btn btn--ghost" onClick={onBack}>Back to Landing</button>
          <button id="phr-open-prompt" className="btn btn--accent" disabled={!promptUnlocked} onClick={() => {
            initializePromptCategory(getFirstUnlockedCategoryId('prompt'));
            setViewMode('prompt');
          }}>
            Prompt {promptUnlocked ? '' : '🔒'}
          </button>
          <button id="phr-open-response" className="btn btn--ghost" disabled={!responseUnlocked} onClick={() => {
            initializeResponseCategory(getFirstUnlockedCategoryId('response'));
            setViewMode('response');
          }}>
            Response {responseUnlocked ? '' : '🔒'}
          </button>
          <button id="phr-open-convo" className="btn btn--ghost" disabled={!convoUnlocked} onClick={() => {
            initializeConvoCategory(getFirstUnlockedCategoryId('convo'));
            setViewMode('convo');
          }}>
            Convo {convoUnlocked ? '' : '🔒'}
          </button>
        </div>
        {!isPhrasesModeUnlocked() ? <p className="message">Complete all Roadmap phrases through Hard mode to unlock Phrases mode.</p> : null}
      </section>
    );
  }

  if (viewMode === 'prompt') {
    const category = currentPromptCategory;
    if (!category) return <section className="react-card"><p>No prompt content available.</p></section>;
    const unit = category.units[promptLearnIndex];
    const unitsById = new Map(category.units.map((u) => [u.id, u]));
    const completed = new Set(state.phrasesProgress.promptCompletedCategories);
    const nextTarget = completed.has(category.id) ? getNextExerciseTarget('prompt', category.id) : null;

    return (
      <section className="react-card">
        <div className="landing-actions"><button id="phr-home" className="btn btn--ghost" onClick={() => setViewMode('home')}>Home</button></div>
        <h1>Prompt</h1>
        <div className="roadmap-list">
          {promptCategories.map((c, index) => (
            <button
              key={c.id}
              className={`roadmap-cat ${promptCategoryId === c.id ? 'is-active' : ''}`}
              data-prompt-category={c.id}
              disabled={!isPhrasesCategoryUnlocked('prompt', index)}
              onClick={() => initializePromptCategory(c.id)}
            >
              <span>{c.name}</span>
              <span>{completed.has(c.id) ? '✅' : ''}</span>
            </button>
          ))}
        </div>

        {promptPhase === 'learn' ? (
          <>
            <p className="section-note">Phrase {progressLabel(promptLearnIndex, category.units.length)}</p>
            <p className="practice-it">{unit?.it}</p>
            <p className="practice-en">{unit?.en}</p>
            <div className="practice-actions">
              <button id="prompt-listen" className="btn" onClick={() => unit && speakItalian(unit.it).catch((e) => setMessage(e instanceof Error ? e.message : 'Could not play pronunciation in this browser.'))}>Play Audio</button>
              <button
                id="prompt-next"
                className="btn btn--accent"
                onClick={() => {
                  if (promptLearnIndex < category.units.length - 1) setPromptLearnIndex(promptLearnIndex + 1);
                  else setPromptPhase('match');
                  setMessage('');
                }}
              >
                {promptLearnIndex >= category.units.length - 1 ? 'Start Match Game' : 'Next'}
              </button>
            </div>
          </>
        ) : (
          <>
            <p className="section-note">Match each audio clip to its English translation. Any mistake resets the round.</p>
            <div className="content">
              <section className="card">
                <h2>Audio</h2>
                <div className="roadmap-list">
                  {promptAudioOrder.map((id) => {
                    const matched = promptMatchedIds.has(id);
                    return (
                      <button
                        key={id}
                        className={`roadmap-phrase ${matched ? 'is-matched' : ''} ${promptMatchAudioSelected === id ? 'is-active' : ''}`}
                        data-prompt-match-audio={id}
                        disabled={matched}
                        onClick={() => {
                          const item = unitsById.get(id);
                          if (item) speakItalian(item.it).catch((e) => setMessage(e instanceof Error ? e.message : 'Could not play pronunciation in this browser.'));
                          setPromptMatchAudioSelected(id);
                        }}
                      >
                        🔊 Audio {matched ? '✅' : ''}
                      </button>
                    );
                  })}
                </div>
              </section>
              <section className="card">
                <h2>English</h2>
                <div className="roadmap-list">
                  {promptEnglishOrder.map((id) => {
                    const matched = promptMatchedIds.has(id);
                    return (
                      <button
                        key={id}
                        className={`roadmap-phrase ${matched ? 'is-matched' : ''} ${promptMatchEnglishSelected === id ? 'is-active' : ''}`}
                        data-prompt-match-english={id}
                        disabled={matched}
                        onClick={() => {
                          setPromptMatchEnglishSelected(id);
                        }}
                      >
                        {unitsById.get(id)?.en}
                      </button>
                    );
                  })}
                </div>
              </section>
            </div>
            {promptMatchedIds.size === category.units.length && nextTarget ? (
              <div className="practice-actions">
                <button className="btn btn--accent" data-next-stage={nextTarget.stage} data-next-category={nextTarget.categoryId} onClick={() => goToTarget(nextTarget)}>
                  Next
                </button>
              </div>
            ) : null}
          </>
        )}

        {message ? <p className="message">{message}</p> : null}
      </section>
    );
  }

  if (viewMode === 'response') {
    const category = currentResponseCategory;
    if (!category) return <section className="react-card"><p>No response content available.</p></section>;
    const learnUnit = category.units[responseLearnIndex];
    const speakUnit = category.units[responseSpeakIndex];
    const unitsById = new Map(category.units.map((u) => [u.id, u]));
    const completed = new Set(state.phrasesProgress.responseCompletedCategories);
    const nextTarget = completed.has(category.id) ? getNextExerciseTarget('response', category.id) : null;

    return (
      <section className="react-card">
        <div className="landing-actions"><button id="phr-home" className="btn btn--ghost" onClick={() => setViewMode('home')}>Home</button></div>
        <h1>Response</h1>

        {responsePhase === 'learn' ? (
          <>
            <p className="section-note">Response {progressLabel(responseLearnIndex, category.units.length)}</p>
            <p className="practice-it">{learnUnit?.it}</p>
            <p className="practice-en">{learnUnit?.en}</p>
            <div className="practice-actions">
              <button id="response-listen" className="btn" onClick={() => learnUnit && speakItalian(learnUnit.it).catch((e) => setMessage(e instanceof Error ? e.message : 'Could not play pronunciation in this browser.'))}>Play Audio</button>
              <button id="response-next" className="btn btn--accent" onClick={() => {
                if (responseLearnIndex < category.units.length - 1) setResponseLearnIndex(responseLearnIndex + 1);
                else setResponsePhase('match');
                setMessage('');
              }}>
                {responseLearnIndex >= category.units.length - 1 ? 'Start Match Game' : 'Next'}
              </button>
            </div>
          </>
        ) : responsePhase === 'match' ? (
          <div className="content">
            <section className="card">
              <h2>Audio</h2>
              <div className="roadmap-list">
                {responseAudioOrder.map((id) => {
                  const matched = responseMatchedIds.has(id);
                  return (
                    <button
                      key={id}
                      className={`roadmap-phrase ${matched ? 'is-matched' : ''} ${responseMatchAudioSelected === id ? 'is-active' : ''}`}
                      data-response-match-audio={id}
                      disabled={matched}
                      onClick={() => {
                        const item = unitsById.get(id);
                        if (item) speakItalian(item.it).catch((e) => setMessage(e instanceof Error ? e.message : 'Could not play pronunciation in this browser.'));
                        setResponseMatchAudioSelected(id);
                      }}
                    >
                      🔊 Audio {matched ? '✅' : ''}
                    </button>
                  );
                })}
              </div>
            </section>
            <section className="card">
              <h2>English</h2>
              <div className="roadmap-list">
                {responseEnglishOrder.map((id) => {
                  const matched = responseMatchedIds.has(id);
                  return (
                    <button
                      key={id}
                      className={`roadmap-phrase ${matched ? 'is-matched' : ''} ${responseMatchEnglishSelected === id ? 'is-active' : ''}`}
                      data-response-match-english={id}
                      disabled={matched}
                      onClick={() => {
                        setResponseMatchEnglishSelected(id);
                      }}
                    >
                      {unitsById.get(id)?.en}
                    </button>
                  );
                })}
              </div>
            </section>
          </div>
        ) : speakUnit ? (
          <>
            <p className="section-note">Speaking challenge {progressLabel(responseSpeakIndex, category.units.length)}</p>
            <p className="practice-en">{speakUnit.en}</p>
            <p className="section-note">Say the Italian response 3 times with at least 70% accuracy to pass this item.</p>
            <p><strong>Passes:</strong> {responseSpeakPasses}/3</p>
            <div className="practice-actions">
              <button id="response-speak" className={`btn btn--accent ${recording ? 'is-recording' : ''}`} onClick={runResponseSpeakingChallenge}>
                {recording ? 'Listening…' : 'Speak Now'}
              </button>
            </div>
          </>
        ) : nextTarget ? (
          <div className="practice-actions">
            <button className="btn btn--accent" data-next-stage={nextTarget.stage} data-next-category={nextTarget.categoryId} onClick={() => goToTarget(nextTarget)}>
              Next
            </button>
          </div>
        ) : (
          <p>Category complete.</p>
        )}

        {message ? <p className="message">{message}</p> : null}
      </section>
    );
  }

  const category = currentConvoCategory;
  if (!category) return <section className="react-card"><p>No convo content available.</p></section>;
  const unit = category.units[convoSpeakIndex];
  const completed = new Set(state.phrasesProgress.convoCompletedCategories);
  const nextTarget = completed.has(category.id) ? getNextExerciseTarget('convo', category.id) : null;

  return (
    <section className="react-card">
      <div className="landing-actions"><button id="phr-home" className="btn btn--ghost" onClick={() => setViewMode('home')}>Home</button></div>
      <h1>Convo</h1>
      {unit ? (
        <>
          <p className="section-note"><strong>Current prompt:</strong> {unit.promptIt}</p>
          <div className="practice-actions">
            <button id="convo-listen-prompt" className="btn" disabled={recording} onClick={() => speakItalian(unit.promptIt).catch((e) => setMessage(e instanceof Error ? e.message : 'Could not play pronunciation in this browser.'))}>
              Play Audio
            </button>
          </div>
          <p className="practice-en"><strong>Expected intent (English):</strong> {unit.responseEn}</p>
          <div className="practice-actions">
            <button id="convo-speak" className={`btn btn--accent ${recording ? 'is-recording' : ''}`} onClick={runConvoSpeakingChallenge}>
              {recording ? 'Listening…' : 'Speak Now'}
            </button>
          </div>
        </>
      ) : nextTarget ? (
        <div className="practice-actions">
          <button className="btn btn--accent" data-next-stage={nextTarget.stage} data-next-category={nextTarget.categoryId} onClick={() => goToTarget(nextTarget)}>
            Next
          </button>
        </div>
      ) : (
        <p>Category complete.</p>
      )}
      {message ? <p className="message">{message}</p> : null}
    </section>
  );
}
