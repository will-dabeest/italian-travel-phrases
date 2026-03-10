# Italian Travel Phrase Trainer

A static, offline-capable, dark-mode-first web app to practice practical Italian travel phrases with speech recognition and a premium SM-2-inspired spaced repetition engine.

## Highlights

- 100% client-side (no backend, no paid APIs)
- Web Speech API (`it-IT`) for pronunciation practice
- Fixed pre-recorded clip support via `public/audio/manifest.json`
- Speech Synthesis API fallback for phrases without fixed clips
- Roadmap-first learning flow with sequential category unlocks
- Landing page with two paths: `Roadmap` (recommended) and `Detailed Practice`
- Difficulty progression:
  - `Easy`: full support (Italian text + example listen button)
  - `Intermediate`: no example listen button
  - `Hard`: no listen button and Italian prompt hidden
  - Unlock `Intermediate` by completing all Easy phrases
  - Unlock `Hard` by completing all Intermediate phrases
- Phrase completion rule for roadmap modes: score above 90% three times per phrase
- SM-2-inspired SRS with:
  - adaptive strictness from historical accuracy
  - phrase-length difficulty modifier
  - decay for long absences
- Token-level feedback and actionable pronunciation hints
- Lazy-loaded category phrase datasets (manifest + per-category JSON)
- Dark mode default + light mode fallback
- Accessibility controls: keyboard-friendly UI, ARIA labels, high contrast mode, font-size adjuster
- Celebration feedback for progress milestones (phrase completion and category completion)
- PWA manifest + install prompt support
- Offline service worker

## Tech Stack

- TypeScript + Vite
- Vanilla browser APIs only
- localStorage persistence

## Project Structure

- `index.html`
- `main.ts`
- `style.css`
- `types.ts`
- `state/store.ts`
- `features/roadmap.ts`
- `features/roadmapView.ts`
- `features/phrasesView.ts`
- `features/phrasesPractice.ts`
- `features/detailedPractice.ts`
- `utils/scoring.ts`
- `utils/audio.ts`
- `utils/recognition.ts`
- `utils/srs.ts`
- `utils/performance.ts`
- `ui/dom.ts`
- `public/phrases.json`
- `public/categories/*.json`
- `public/audio/manifest.json`
- `public/audio/*`
- `public/sw.js`
- `public/manifest.webmanifest`
- `public/assets/logo.svg`
- `public/assets/icons.svg`

## Run Locally

```bash
npm install
npm run dev
```

## Build / Verify

```bash
npm run check
npm run build
npm run preview
```

## Docker

Quick start (simplest):

```bash
npm run docker:up
```

Then open `http://localhost:8080`.
Stop:

```bash
npm run docker:down
```

Manual Docker commands:

```bash
docker build -t italian-travel-phrase-trainer .
docker run --rm -p 8080:80 italian-travel-phrase-trainer
```

Recommendation:

- For Netlify deployment, Docker is not required.
- For consistent local runtime and environment parity across machines/CI, Docker is a good option.

## Netlify Deployment

```bash
npm install -g netlify-cli
netlify login
netlify init
netlify dev
netlify deploy --prod
```

## Browser Notes

- Chrome: fully supported target browser (speech recognition required)
- Safari: best effort support (speech recognition behavior may vary)

## Difficulty Modes

- `Easy` is the baseline roadmap mode and is available immediately.
- `Intermediate` unlocks only after all categories and all phrases are fully completed in `Easy`.
- `Hard` unlocks only after all categories and all phrases are fully completed in `Intermediate`.
- Category progression is sequential in each mode, and phrase progression within each category is sequential.
- Completed categories remain revisit-able at any time.

## Offline Behavior

- Core assets are cached aggressively via service worker
- `phrases.json` and `/categories/*.json` use stale-while-revalidate strategy
- App remains usable offline after first successful load

## Fixed Audio Clips (Optional)

- Add vetted phrase clips under `public/audio/`
- Map phrase text to clip source in `public/audio/manifest.json`
- `Listen` tries a fixed clip first; if no fixed clip exists for a phrase, it falls back to Italian TTS

## Second-Pass Refinement Notes

- Critical CSS is inlined in `index.html`, with non-critical styles bundled and minified by Vite.
- Non-essential modules are lazy-loaded (`recognition`).
- Category data is lazy-loaded by manifest and fetched per category to reduce initial work.
- Event handlers are bound once with delegated events to reduce listener churn and reflow overhead.
- Global error/rejection guards are installed to avoid silent failures in runtime flows.
