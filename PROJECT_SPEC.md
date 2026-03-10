# Italian Travel Phrase Trainer — Current Generation Prompt (Aligned to Live App)

You (Copilot) must generate a complete static web app that matches the current Italian Travel Phrase Trainer behavior as implemented today.

This is a **generation prompt**, not a changelog. Build the app to these exact requirements.

**Normative keywords**
- **MUST** = required for acceptance
- **SHOULD** = strongly recommended unless there is a clear reason not to
- **MAY** = optional

---

## 0) Product Goal

Create a dark-mode-first, offline-capable, front-end-only Italian phrase trainer for travel.

The app **MUST** combine:
- Roadmap-based progression
- Detailed pronunciation practice
- Multi-stage phrases mode (Prompt → Response → Convo)
- Speech recognition scoring + SRS persistence

---

## 1) Non-Negotiable Constraints

- The app **MUST** be 100% client-side (no backend).
- The app **MUST NOT** use paid services or API keys.
- The app **MUST** be deployable on Netlify.
- The app **MUST** use browser APIs only for speech:
  - Web Speech API (`it-IT`) for recognition
  - Speech Synthesis for playback fallback
- The app **MUST** persist user state in `localStorage`.
- The app **MUST** work offline after first successful load via service worker.
- The app **MUST** default to dark mode and include a light mode option.

---

## 2) Primary UX Structure

Implement these top-level views. Each view **MUST** exist.

1. `Landing`
  - Entry point **MUST** include actions for:
     - `Roadmap`
     - `Practice` (detailed practice)
     - `Phrases` (locked until roadmap hard mode completion)
  - Install button **SHOULD** appear when `beforeinstallprompt` is available.

2. `Roadmap`
  - Difficulty chips **MUST** include: `Easy`, `Intermediate`, `Hard`.
  - Sequential unlock **MUST** be enforced:
     - Intermediate unlocks only after full Easy completion.
     - Hard unlocks only after full Intermediate completion.
  - UI **MUST** include category path, phrase path, and compact practice panel.
  - Phrase completion rule **MUST** be: **3 successful runs with similarity ≥ 90%** in current mode.

3. `Detailed Practice`
  - View **MUST** include fuzzy search, category filter, and progress filters.
  - View **MUST** include sort modes: relevance, least progress, most progress.
  - View **MUST** show SRS due/overdue indicators.
  - View **MUST** include pronunciation panel with token feedback.

4. `Phrases Mode Home`
  - Unlock-gated submodes **MUST** include:
     - `Prompt`
     - `Response`
     - `Convo`
  - Stage unlock chain **MUST** be:
     - Prompt always first (after roadmap hard completion)
     - Response unlocks after all Prompt categories complete
     - Convo unlocks after all Response categories complete

5. `Phrases Submodes`
  - Prompt **MUST** include learn phase + audio↔English match game.
  - Response **MUST** include learn phase + match phase + speaking challenge.
  - Convo **MUST** include listen-to-prompt + speak expected response.

---

## 3) Learning & Progression Rules

### 3.1 Roadmap progression

- Categories **MUST** be ordered and unlocked sequentially.
- Phrase order inside each category **MUST** be deterministic by phrase id index.
- Phrase completion in a mode **MUST** occur when pass count reaches 3.
- Next action **SHOULD** support jumping to:
  - next phrase in category,
  - next unlocked category,
  - next difficulty mode when current mode fully complete.

### 3.2 Phrases mode progression

- Stage/category progression **MUST** be sequential.
- Category completion **MUST** be tracked separately per stage:
  - `promptCompletedCategories`
  - `responseCompletedCategories`
  - `convoCompletedCategories`
- Matching exercises **MUST** reset the round on mismatch.

### 3.3 Speaking thresholds

- Roadmap pronunciation pass threshold **MUST** be similarity ≥ 0.90.
- Response/Convo speaking pass threshold **MUST** be similarity ≥ 0.70.
- Response speaking **MUST** require 3 successful passes per item.

---

## 4) Speech Recognition Behavior

Recognition module **MUST** be lazy-loaded and resilient:
- Language: `it-IT`
- Timeout support
- Retry support
- iOS-specific longer timeout/retry behavior
- Graceful error messages when unavailable or timed out

Recognition quality mapping **MUST** produce label/quality values used for SRS updates.

---

## 5) Scoring, Feedback, and Pronunciation Hints

Scoring **MUST** be local-only (no cloud calls):
- Similarity formula based on normalized Levenshtein distance.
- Token-level diff with statuses (exact/close/miss/extra).
- Close-token logic **MUST** account for:
  - vowel normalization
  - elisions/apostrophes
  - doubled consonant simplification

User-facing pronunciation hints **MUST** include:
- double consonant guidance
- open/closed vowel guidance
- elision guidance

IPA-like local guidance **MUST** be provided via local lookup/fallback helper.

---

## 6) SRS Engine (SM-2 Inspired + Refinements)

Per phrase SRS card **MUST** track:
- `interval`
- `repetitions`
- `easinessFactor`
- `lastReviewed`
- `nextReview`

Requirements:
- **MUST** implement SM-2 style EF update and interval progression.
- **MUST** reset/penalize progression when performance is poor.
- **MUST** include phrase-length difficulty modifier (longer phrases grow slower).
- **MUST** include decay for long absences.
- **MUST** provide due/overdue helpers.
- **SHOULD** provide daily queue helper with ~70/30 review/new mix and bounded session size.

---

## 7) Data & Content Model

### 7.1 Phrase dataset

Category data **MUST** use manifest + per-category JSON loading from `public/categories/*.json`.

### 7.2 Convo dataset

Conversation data **MUST** use `convo.json` and derive:
- prompt categories
- response categories
- convo categories

### 7.3 Audio

- Audio layer **MUST** support fixed clip manifest (`public/audio/manifest.json`).
- Playback strategy **MUST** be:
  1. fixed clip when available
  2. speech synthesis fallback otherwise

---

## 8) Accessibility & Settings

Accessibility/settings **MUST** include:
- keyboard-friendly interactions
- ARIA labels on controls
- high-contrast toggle
- font-scale control
- theme selector (dark/light)
- settings state persisted in localStorage

---

## 9) Performance & Runtime Requirements

- **MUST** lazy-load non-critical modules (recognition at minimum).
- **MUST** lazy-load phrase categories by manifest/file.
- **MUST** debounce search input.
- **MUST** minimize redundant listeners and bind events once.
- **SHOULD** use passive listeners where appropriate.
- **MUST** guard against silent runtime failures with global error/rejection handlers.

---

## 10) PWA / Offline / Install

- PWA/offline support **MUST** implement:
- `manifest.webmanifest`
- service worker (`public/sw.js`) with:
  - core asset caching
  - stale-while-revalidate style behavior for phrase/audio JSON resources
  - cache versioning cleanup
- install prompt support via `beforeinstallprompt`

---

## 11) Current File Organization Target

Generated code **MUST** be TypeScript and **SHOULD** follow this domain organization used by the live app:

- Root:
  - `index.html`
  - `main.ts`
  - `style.css`
  - `types.ts`
- State:
  - `state/store.ts`
- Features:
  - `features/roadmap.ts`
  - `features/roadmapView.ts`
  - `features/phrasesView.ts`
  - `features/phrasesPractice.ts`
  - `features/detailedPractice.ts`
- UI:
  - `ui/dom.ts`
  - `ui/markup.ts`
  - `ui/quickReview.ts` (MAY be surfaced in UI)
  - `ui/extras.ts` (MAY provide helpers such as numbers/verbs)
- Utils:
  - `utils/audio.ts`
  - `utils/recognition.ts`
  - `utils/scoring.ts`
  - `utils/srs.ts`
  - `utils/performance.ts`
  - `utils/phrases.ts`
  - `utils/roadmap.ts`
  - `utils/convo.ts`
  - `utils/format.ts`
- Public:
  - `public/categories/*.json`
  - `public/audio/*`
  - `public/audio/manifest.json`
  - `public/manifest.webmanifest`
  - `public/sw.js`

---

## 12) Deployment / Scripts

Project **MUST** support:
- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run check`

Netlify build behavior **MUST** match:
- build command: `npm run build`
- publish directory: `dist`

---

## 13) QA Acceptance Criteria

Before finalizing generated output, verification **MUST** include:
- TypeScript check passes (`tsc --noEmit`).
- No unhandled runtime errors during common flows.
- Core flows work:
  - roadmap progression and unlocks
  - detailed practice pronunciation scoring
  - phrases submode unlock chain and stage progression
- Offline support works after first load.
- Chrome speech path works; Safari is best-effort.

---

## 14) Important Alignment Notes

- Generation **MUST** keep the app fully free and client-only.
- Generation **MUST** align to **current behavior** and avoid speculative requirements.
- Quick Review and extras helpers **MAY** exist without being primary-nav features unless explicitly requested.
- Prompt **MUST NOT** require features absent from the current app (for example, mandatory onboarding wizard).

---

## 15) Output Instruction

Generate a polished, production-ready version of this application that **MUST** conform to all requirements above and mirror the current app’s implemented behavior and architecture.

---

## 16) Compliance Checklist (Quick Pass)

Use this checklist before accepting generated output:

- [ ] Verify the app is fully client-side and uses no paid/API-key services.
- [ ] Verify Netlify build target is `dist` and build command is `npm run build`.
- [ ] Verify all required views exist: Landing, Roadmap, Detailed Practice, Phrases Home, Prompt, Response, Convo.
- [ ] Verify roadmap unlock chain works: Easy → Intermediate → Hard.
- [ ] Verify roadmap phrase completion requires 3 passes at ≥ 0.90 similarity.
- [ ] Verify phrases unlock chain works: Prompt → Response → Convo.
- [ ] Verify matching exercises reset on mismatch.
- [ ] Verify Response/Convo speaking pass threshold is ≥ 0.70 and Response requires 3 passes per item.
- [ ] Verify SRS card fields and SM-2-inspired update logic are implemented.
- [ ] Verify search is debounced and category data is lazy-loaded.
- [ ] Verify recognition path is lazy-loaded with timeout/retry handling.
- [ ] Verify service worker, web manifest, and install prompt support are present.
- [ ] Verify settings persistence for theme, contrast, and font scale in localStorage.
- [ ] Verify type-check passes with `npm run check`.

### 16.1 Failure Handling Expectations

- [ ] Verify speech-unavailable scenarios show a clear message and keep the app usable.
- [ ] Verify recognition timeout path returns actionable retry guidance.
- [ ] Verify recognition retries are attempted before final failure.
- [ ] Verify playback failures surface a user-visible fallback error message.
- [ ] Verify recording state resets correctly after recognition errors.
- [ ] Verify no unhandled promise rejections occur in speech/playback paths.
- [ ] Verify offline fallback serves cached app shell after first successful load.
