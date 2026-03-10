import { useEffect, useState } from 'react';
import { loadState } from '../state/store';
import type { AppState, CategoryManifest, Settings } from '../types';
import { isModeFullyCompleted } from '../utils/roadmap';
import { DetailedPracticeView } from './views/DetailedPracticeView';
import { PhrasesModeView } from './views/PhrasesModeView';
import { RoadmapView } from './views/RoadmapView';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type ReactView = 'landing' | 'roadmap' | 'detailed' | 'phrases';

const ERROR_RUNTIME_UNEXPECTED = 'An unexpected error occurred. Please refresh and try again.';
const ERROR_RUNTIME_BACKGROUND = 'A background operation failed. Please retry the action.';

function applySettings(settings: Settings): void {
  document.documentElement.dataset.theme = settings.theme;
  document.documentElement.dataset.contrast = settings.highContrast ? 'high' : 'normal';
  document.documentElement.style.setProperty('--font-scale', String(settings.fontScale));
}

async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return;
  if (import.meta.env.DEV || location.hostname === 'localhost' || location.hostname === '127.0.0.1') return;
  const registration = await navigator.serviceWorker.register('/sw.js');
  await registration.update();

  let didReloadOnControllerChange = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (didReloadOnControllerChange) return;
    didReloadOnControllerChange = true;
    location.reload();
  });

  if (registration.waiting) {
    registration.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  registration.addEventListener('updatefound', () => {
    const installing = registration.installing;
    if (!installing) return;
    installing.addEventListener('statechange', () => {
      if (installing.state === 'installed' && navigator.serviceWorker.controller) {
        installing.postMessage({ type: 'SKIP_WAITING' });
      }
    });
  });
}

function PlaceholderView(props: { title: string; onBack: () => void }): React.JSX.Element {
  const { title, onBack } = props;
  return (
    <section className="react-card">
      <h1>{title} (React WIP)</h1>
      <p>This view is a placeholder while you migrate features incrementally.</p>
      <button className="btn btn--ghost" onClick={onBack}>
        Back to Landing
      </button>
    </section>
  );
}

export function App(): React.JSX.Element {
  const [view, setView] = useState<ReactView>('landing');
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [phrasesUnlocked, setPhrasesUnlocked] = useState(false);
  const [runtimeMessage, setRuntimeMessage] = useState('');

  const refreshPhrasesUnlock = async (stateOverride?: AppState): Promise<void> => {
    try {
      const response = await fetch('/phrases.json', { cache: 'force-cache' });
      const data = (await response.json()) as { categories?: CategoryManifest[] };
      const stateToCheck = stateOverride ?? loadState();
      setPhrasesUnlocked(isModeFullyCompleted(stateToCheck, data.categories ?? [], 'hard'));
    } catch {
      setPhrasesUnlocked(false);
    }
  };

  useEffect(() => {
    applySettings(loadState().settings);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadPhrasesUnlock() {
      await refreshPhrasesUnlock();
    }

    void loadPhrasesUnlock();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  useEffect(() => {
    const onError = () => setRuntimeMessage(ERROR_RUNTIME_UNEXPECTED);
    const onUnhandledRejection = () => setRuntimeMessage(ERROR_RUNTIME_BACKGROUND);

    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onUnhandledRejection);

    return () => {
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onUnhandledRejection);
    };
  }, []);

  useEffect(() => {
    registerServiceWorker().catch(() => undefined);
  }, []);

  const handleDetailedStateChange = (nextState: AppState): void => {
    applySettings(nextState.settings);
    setRuntimeMessage('');
    void refreshPhrasesUnlock(nextState);
  };

  if (view === 'roadmap') return <RoadmapView onBack={() => setView('landing')} />;
  if (view === 'detailed') {
    return (
      <DetailedPracticeView
        onBack={() => setView('landing')}
        onStateChanged={handleDetailedStateChange}
      />
    );
  }
  if (view === 'phrases') return <PhrasesModeView onBack={() => setView('landing')} />;

  return (
    <main className="react-shell" aria-label="React landing screen">
      <section className="react-card react-card--landing">
        <h1>Italian Travel Phrase Trainer</h1>
        <p className="section-note">Recommended: follow the roadmap and complete categories in order.</p>
        <div className="landing-actions">
          <button className="btn btn--accent" onClick={() => setView('roadmap')}>
            Roadmap
          </button>
          <button className="btn btn--ghost" onClick={() => setView('detailed')}>
            Practice
          </button>
          <button className="btn btn--ghost" disabled={!phrasesUnlocked} onClick={() => setView('phrases')}>
            Phrases {!phrasesUnlocked ? '🔒' : ''}
          </button>
          <button
            className={`btn btn--ghost ${installPrompt ? '' : 'is-hidden'}`}
            aria-label="Install app"
            onClick={() => {
              installPrompt?.prompt().catch(() => undefined);
            }}
          >
            Install App
          </button>
        </div>
        {runtimeMessage ? <p className="message">{runtimeMessage}</p> : null}
      </section>
    </main>
  );
}
