import type { AudioManifest } from '../types';

const normalizeAudioKey = (input: string): string =>
  input
    .toLowerCase()
    .normalize('NFD')
    .replace(/['’]/g, "'")
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zàèéìòù'\s-]/gi, ' ')
    .replace(/['-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const fixedAudioClips = new Map<string, string>();
let fixedAudioLoaded = false;
let fixedAudioLoadingPromise: Promise<void> | null = null;

const resolveClipSrc = (src: string): string => {
  if (/^https?:\/\//i.test(src)) return src;
  return new URL(src, window.location.origin).toString();
};

export function configureFixedAudio(clips: Array<{ text: string; src: string }>): void {
  fixedAudioClips.clear();
  clips.forEach((clip) => {
    const key = normalizeAudioKey(clip.text);
    if (key && clip.src) fixedAudioClips.set(key, resolveClipSrc(clip.src));
  });
  fixedAudioLoaded = true;
}

export async function loadFixedAudioManifest(): Promise<void> {
  if (fixedAudioLoadingPromise) {
    await fixedAudioLoadingPromise;
    return;
  }

  fixedAudioLoadingPromise = (async () => {
    try {
      const response = await fetch('/audio/manifest.json', { cache: 'no-store' });
      if (!response.ok) {
        configureFixedAudio([]);
        return;
      }

      const manifest = (await response.json()) as AudioManifest;
      configureFixedAudio(manifest.clips ?? []);
    } catch {
      configureFixedAudio([]);
    } finally {
      fixedAudioLoadingPromise = null;
    }
  })();

  await fixedAudioLoadingPromise;
}

const ensureFixedAudioReady = async (text: string): Promise<void> => {
  const key = normalizeAudioKey(text);
  if (!fixedAudioLoaded || !fixedAudioClips.has(key)) {
    await loadFixedAudioManifest();
  }
};

const playFixedClip = async (text: string): Promise<'played' | 'missing' | 'failed'> => {
  const src = fixedAudioClips.get(normalizeAudioKey(text));
  if (!src) return 'missing';

  const audio = new Audio(src);
  audio.preload = 'auto';

  try {
    await audio.play();
    return 'played';
  } catch {
    return 'failed';
  }
};

const waitForVoices = (timeoutMs = 1200): Promise<SpeechSynthesisVoice[]> =>
  new Promise((resolve) => {
    const existing = window.speechSynthesis.getVoices();
    if (existing.length) {
      resolve(existing);
      return;
    }

    const finish = () => {
      window.speechSynthesis.removeEventListener('voiceschanged', onVoicesChanged);
      resolve(window.speechSynthesis.getVoices());
    };

    const onVoicesChanged = () => finish();
    window.speechSynthesis.addEventListener('voiceschanged', onVoicesChanged);
    window.setTimeout(finish, timeoutMs);
  });

const getItalianVoice = async (): Promise<SpeechSynthesisVoice | null> => {
  const voices = await waitForVoices();
  const byExact = voices.find((voice) => voice.lang.toLowerCase() === 'it-it');
  if (byExact) return byExact;
  return voices.find((voice) => voice.lang.toLowerCase().startsWith('it')) ?? null;
};

/**
 * Speaks Italian text via browser speech synthesis.
 */
export async function speakItalian(text: string): Promise<void> {
  await ensureFixedAudioReady(text);
  const fixedAudioResult = await playFixedClip(text);
  if (fixedAudioResult === 'played') return;
  if (fixedAudioResult === 'failed') {
    throw new Error('A saved pronunciation clip exists for this phrase but could not be played in this browser.');
  }

  if (!('speechSynthesis' in window)) {
    throw new Error('Speech synthesis is not supported in this browser.');
  }

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.rate = 0.95;

  const italianVoice = await getItalianVoice();
  if (!italianVoice) {
    throw new Error('No Italian voice is available on this device/browser.');
  }
  utterance.voice = italianVoice;

  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}
