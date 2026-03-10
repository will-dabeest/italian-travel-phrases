import { useEffect, useState } from 'react';
import { DetailedPracticeView } from './views/DetailedPracticeView';
import { RoadmapView } from './views/RoadmapView';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

type ReactView = 'landing' | 'roadmap' | 'detailed' | 'phrases';

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
  const [phrasesUnlocked] = useState(false);

  useEffect(() => {
    const onBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
  }, []);

  if (view === 'roadmap') return <RoadmapView onBack={() => setView('landing')} />;
  if (view === 'detailed') return <DetailedPracticeView onBack={() => setView('landing')} />;
  if (view === 'phrases') return <PlaceholderView title="Phrases" onBack={() => setView('landing')} />;

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
      </section>
    </main>
  );
}
