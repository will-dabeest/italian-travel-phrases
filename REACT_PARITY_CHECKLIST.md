# React Parity Checklist (Executable QA)

**Read `REACT_MIGRATION.md` first.**

Use this file second, as the operational pass/fail checklist for the current migration step.

Use this checklist during migration to ensure React behavior matches the current vanilla app.

This file is procedural (not a status page). Run only the section relevant to the current migration step.

## 1) How to Run Side-by-Side

Open two terminals:

- Vanilla baseline: `npm run dev`
- React scaffold: `npm run dev:react`

For each test case:
1. Reset localStorage for both apps.
2. Apply the same fixture state.
3. Execute the same user actions.
4. Compare visible UI and localStorage outcomes.

---

## 2) Global Gates (Run for Every Step)

- [ ] `npm run check` passes.
- [ ] `npm run build` passes.
- [ ] `npm run build:react` passes.
- [ ] `npm run test:parity:ui` passes for all declared step tags in the parity test suite.
- [ ] No unhandled console errors in migrated flows.
- [ ] No unhandled promise rejections in migrated flows.

---

## 3) Fixture Setup Snippets

Run these in browser devtools for each app before test cases.

## 3.1 Reset fixture

```js
localStorage.removeItem('italian-trainer-state-v1');
location.reload();
```

## 3.2 Fresh-state fixture

```js
localStorage.setItem('italian-trainer-state-v1', JSON.stringify({
  settings: { theme: 'dark', highContrast: false, fontScale: 1 },
  streak: 0,
  lastActiveDate: null,
  progress: {},
  srs: {},
  roadmapProgress: { easy: {}, intermediate: {}, hard: {} },
  phrasesProgress: {
    promptCompletedCategories: [],
    responseCompletedCategories: [],
    convoCompletedCategories: []
  }
}));
location.reload();
```

## 3.3 Intermediate-locked but easy-in-progress fixture

```js
const s = JSON.parse(localStorage.getItem('italian-trainer-state-v1') || '{}');
s.settings = s.settings || { theme: 'dark', highContrast: false, fontScale: 1 };
s.progress = s.progress || {};
s.srs = s.srs || {};
s.roadmapProgress = s.roadmapProgress || { easy: {}, intermediate: {}, hard: {} };
s.roadmapProgress.easy['greetings-0'] = 3;
s.roadmapProgress.easy['greetings-1'] = 2;
s.phrasesProgress = s.phrasesProgress || {
  promptCompletedCategories: [],
  responseCompletedCategories: [],
  convoCompletedCategories: []
};
localStorage.setItem('italian-trainer-state-v1', JSON.stringify(s));
location.reload();
```

## 3.4 Phrases partially unlocked fixture

```js
const s = JSON.parse(localStorage.getItem('italian-trainer-state-v1') || '{}');
s.settings = s.settings || { theme: 'dark', highContrast: false, fontScale: 1 };
s.progress = s.progress || {};
s.srs = s.srs || {};
s.roadmapProgress = s.roadmapProgress || { easy: {}, intermediate: {}, hard: {} };
// simulate hard completion unlock prerequisite (minimal shortcut for QA)
for (const id of ['greetings-0','greetings-1','greetings-2']) {
  s.roadmapProgress.hard[id] = 3;
}
s.phrasesProgress = {
  promptCompletedCategories: ['greetings'],
  responseCompletedCategories: [],
  convoCompletedCategories: []
};
localStorage.setItem('italian-trainer-state-v1', JSON.stringify(s));
location.reload();
```

---

## 4) Step-Based Parity Matrix (Run Relevant Section)

## Step 2 — Landing Parity

- [ ] Landing shows 4 CTAs: Roadmap, Practice, Phrases, Install App.
- [ ] Phrases CTA lock state matches unlock precondition.
- [ ] Install App button only appears when `beforeinstallprompt` is available.

## Step 3 — Roadmap Data Skeleton Parity

- [ ] Roadmap view loads manifest categories from `/phrases.json`.
- [ ] Selecting a category loads phrases from matching `/categories/*.json` file.
- [ ] Difficulty chip selection updates label/state in roadmap view.

## Step 4 — Roadmap Behavioral Parity

- [ ] Easy always available.
- [ ] Intermediate locked until Easy fully complete.
- [ ] Hard locked until Intermediate fully complete.
- [ ] Category unlock chain is sequential.
- [ ] Phrase unlock chain is sequential within category.
- [ ] Phrase pass counter increments only when similarity ≥ 0.90.
- [ ] Phrase completion requires exactly 3 passes.
- [ ] Category completion status mirrors vanilla for same state.
- [ ] Next target behavior (next phrase/category/mode) matches vanilla.
- [ ] Same localStorage input yields same active category/phrase selection.

## Step 5 — Detailed Practice Parity

- [ ] Search results match vanilla for same query.
- [ ] Filter chips (`all`, `needs`, `mastered`, `difficult`) match vanilla counts/results.
- [ ] Sort modes match ordering from vanilla.
- [ ] Due/overdue badges and counts match vanilla.
- [ ] Selecting phrase updates practice panel identically.

## Step 6 — Pronunciation Flow Parity

- [ ] Recording guard prevents double-start while already recording.
- [ ] Recognition unavailable path shows equivalent user message.
- [ ] Timeout/retry behavior mirrors vanilla.
- [ ] Similarity + label output matches vanilla for same transcript.
- [ ] Token diff output statuses match vanilla logic.
- [ ] Hint message source matches same conditions as vanilla.
- [ ] SRS updates match same inputs.
- [ ] Roadmap pass increment only occurs at ≥ 0.90.

## Step 7 — Phrases Mode Parity

- [ ] Phrases Home lock/unlock chain matches vanilla.
- [ ] Prompt learn progression matches vanilla.
- [ ] Prompt match reset-on-mismatch behavior matches vanilla.
- [ ] Response learn/match/speak phases transition identically.
- [ ] Response speaking requires 3 passes per item at ≥ 0.70.
- [ ] Convo speaking threshold and progression match vanilla.
- [ ] Completed categories arrays persist identically:
  - `promptCompletedCategories`
  - `responseCompletedCategories`
  - `convoCompletedCategories`

## Step 8 — Settings/System/PWA Parity

- [ ] Theme selector updates document theme and persists.
- [ ] High contrast toggle updates UI and persists.
- [ ] Font scale updates UI and persists.
- [ ] Reset action restores default state shape.
- [ ] Service worker register/update behavior matches vanilla.
- [ ] Offline shell loads after first successful load.

---

## 5) Parity Decision Rule

A migration step is accepted only if:
- all relevant boxes for that step are checked,
- global gates pass,
- no behavior differences remain for tested fixtures.

If any mismatch appears:
1. capture fixture JSON,
2. capture user action sequence,
3. capture expected (vanilla) vs actual (React),
4. fix before proceeding to next step.

---

## 6) Evidence Log Template (copy for each step)

```md
## Step X Evidence
- Date:
- Tester:
- Commit/branch:

### Fixtures tested
- [ ] Reset
- [ ] Fresh state
- [ ] Easy in-progress
- [ ] Phrases partial unlock
- [ ] Custom:

### Outcomes
- Passed:
- Failed:
- Notes:

### Commands
- npm run check: PASS/FAIL
- npm run build: PASS/FAIL
- npm run build:react: PASS/FAIL
```

---

## 7) Next-Step Selection Rule

Use this rule each cycle:
1. Find the first step in `REACT_MIGRATION.md` that is not yet satisfied.
2. Run the matching section in this checklist.
3. If all boxes and global gates pass, move to the next step.
4. If not, fix only that step scope and retest.
