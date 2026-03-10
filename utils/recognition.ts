interface SpeechRecognitionResult {
  transcript: string;
  confidence: number;
}

interface MinimalSpeechRecognitionEvent {
  results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>>;
}

interface MinimalSpeechRecognitionErrorEvent {
  error: string;
}

interface RecognizeOptions {
  timeoutMs?: number;
  retries?: number;
  retryDelayMs?: number;
  startDelayMs?: number;
}

interface BrowserSpeechRecognition extends EventTarget {
  lang: string;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  onresult: ((event: MinimalSpeechRecognitionEvent) => void) | null;
  onerror: ((event: MinimalSpeechRecognitionErrorEvent) => void) | null;
  onend: (() => void) | null;
}

declare global {
  interface Window {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  }
}

/**
 * Returns whether speech recognition is supported.
 */
export function isRecognitionSupported(): boolean {
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * Performs Italian speech recognition with timeout and retry handling.
 */
export async function recognizeItalian(options: RecognizeOptions = {}): Promise<SpeechRecognitionResult> {
  const timeoutMs = options.timeoutMs ?? 7000;
  let retries = options.retries ?? 1;
  const retryDelayMs = options.retryDelayMs ?? 300;
  const startDelayMs = options.startDelayMs ?? 0;

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    throw new Error('Speech recognition is not supported in this browser.');
  }

  const wait = (ms: number): Promise<void> => new Promise((resolve) => window.setTimeout(resolve, ms));

  while (retries >= 0) {
    if (startDelayMs > 0) {
      await wait(startDelayMs);
    }

    try {
      const result = await new Promise<SpeechRecognitionResult>((resolve, reject) => {
        const recognition = new SpeechRecognition();
        let completed = false;

        recognition.lang = 'it-IT';
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;

        const timeoutId = window.setTimeout(() => {
          if (completed) return;
          completed = true;
          recognition.stop();
          reject(new Error('Recognition timed out. Speak clearly and try again.'));
        }, timeoutMs);

        recognition.onresult = (event) => {
          if (completed) return;
          completed = true;
          window.clearTimeout(timeoutId);

          let transcript = '';
          let confidence = 0;
          for (let index = event.results.length - 1; index >= 0; index -= 1) {
            const candidate = event.results[index]?.[0];
            const candidateTranscript = candidate?.transcript?.trim() ?? '';
            if (!candidateTranscript) continue;
            transcript = candidateTranscript;
            confidence = candidate?.confidence ?? 0;
            break;
          }

          try {
            recognition.stop();
          } catch {
            // no-op: stopping can fail if engine already ended
          }

          resolve({ transcript, confidence });
        };

        recognition.onerror = (event) => {
          if (completed) return;
          completed = true;
          window.clearTimeout(timeoutId);
          reject(new Error(event.error === 'no-speech' ? 'No speech detected. Try again.' : `Recognition error: ${event.error}`));
        };

        recognition.onend = () => {
          if (completed) return;
          completed = true;
          window.clearTimeout(timeoutId);
          reject(new Error('Recognition ended without a result.'));
        };

        recognition.start();
      });

      return result;
    } catch (error) {
      if (retries === 0) {
        throw error;
      }
      retries -= 1;
      if (retryDelayMs > 0) {
        await wait(retryDelayMs);
      }
    }
  }

  throw new Error('Recognition failed after retries.');
}
