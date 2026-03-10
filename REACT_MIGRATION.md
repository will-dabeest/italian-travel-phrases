# React Migration Guide (Copilot Playbook)

**Read this file first.**

Then execute validation from:
- `REACT_PARITY_CHECKLIST.md`

This document is a **task-oriented migration playbook**, not a live status report.

Use it to:
- identify the next required migration step,
- verify whether a step is already satisfied,
- move forward without changing behavior.

Companion QA artifact (mandatory):
- `REACT_PARITY_CHECKLIST.md`

---

## 1) Migration Objective

Migrate the app UI/runtime orchestration to React while preserving:
- user-visible behavior,
- progression/unlock rules,
- scoring/SRS behavior,
- localStorage schema,
- offline/PWA behavior.

The vanilla app remains baseline until cutover criteria are met.

---

## 2) How to Use This Guide

For each step in Section 4:
1. Run the “Completion Test” for that step.
2. If all checks pass, mark the step as satisfied and proceed to the next step.
3. If checks fail, implement only that step’s scope and re-run tests.

Important:
- Do not skip sequence unless a later step explicitly depends only on already-satisfied prerequisites.
- Do not treat this file as history; treat it as an executable plan.

---

## 3) Global Migration Rules

1. **No logic rewrites first**: reuse existing domain modules (`utils/*`, `state/store.ts`, `features/*`) before re-architecting.
2. **One vertical slice at a time**: migrate one view/flow fully, then verify parity.
3. **Keep localStorage schema stable** until final parity sign-off.
4. **Do not remove vanilla app entry** (`main.ts`) until React parity is confirmed.
5. **Parity over aesthetics**: behavior fidelity is the acceptance gate.
6. **Checklist is mandatory**: each step MUST be validated via `REACT_PARITY_CHECKLIST.md`.

---

## 4) Step Plan (Sequential, Reusable)

## Step 1 — Parallel React Scaffold

### Goal
Create a React runtime in parallel, without affecting vanilla production entry.

### Required Tasks
- Add React dependencies and Vite React plugin.
- Add React scripts (`dev:react`, `build:react`, `preview:react`).
- Add `vite.react.config.ts` with separate output directory.
- Add parallel entry (`react.html`, `react/main.tsx`, `react/App.tsx`).
- Enable TSX in `tsconfig.json`.

### Completion Test
- `npm run check` passes.
- `npm run build:react` passes.
- `npm run dev` still runs vanilla unchanged.

### If Already Satisfied
Proceed to Step 2.

---

## Step 2 — Landing View Parity in React

### Goal
React landing view mirrors vanilla CTA structure and install prompt handling.

### Required Tasks
- Implement Landing with CTAs:
  - Roadmap
  - Practice
  - Phrases (lock-aware)
  - Install App (prompt-aware)
- Wire `beforeinstallprompt` handling.

### Completion Test
- Landing CTA layout and text match baseline behavior.
- Install button visibility logic matches baseline behavior.

### If Already Satisfied
Proceed to Step 3.

---

## Step 3 — Roadmap Data Skeleton in React

### Goal
React roadmap loads live manifest/category phrase files and displays them.

### Required Tasks
- Load `/phrases.json` manifest.
- Load selected category file from `/categories/*.json`.
- Render difficulty chips, categories list, phrase list.

### Completion Test
- Category and phrase data loading works with no runtime errors.
- `build:react` output is healthy.

### If Already Satisfied
Proceed to Step 4.

---

## Step 4 — Roadmap Behavioral Parity

### Goal
Make React roadmap functionally equivalent to vanilla roadmap.

### Required Tasks
- Reuse unlock/progression logic from `utils/roadmap.ts` and `features/roadmap.ts`.
- Use persisted `AppState` via `state/store.ts`.
- Implement mode/category/phrase unlocks and pass counters.
- Implement next-target navigation behavior.

### Completion Test
- For identical localStorage fixtures, React and vanilla show same mode/category/phrase availability and pass states.
- Phase 4 checks in `REACT_PARITY_CHECKLIST.md` are green.

### If Already Satisfied
Proceed to Step 5.

---

## Step 5 — Detailed Practice Parity

### Goal
Migrate detailed practice interactions with behavior parity.

### Required Tasks
- Port search/filter/category/sort controls.
- Port phrase list computation and ordering.
- Port due/overdue/progress indicators.
- Port phrase selection + feedback panel behavior.

### Completion Test
- Same inputs yield same phrase ordering/selection outcomes as vanilla.
- Phase 5 checks in `REACT_PARITY_CHECKLIST.md` are green.

### If Already Satisfied
Proceed to Step 6.

---

## Step 6 — Pronunciation Flow Parity (Roadmap + Detailed)

### Goal
Preserve microphone scoring flow and state transitions exactly.

### Required Tasks
- Wire lazy recognition import path (`utils/recognition.ts`).
- Keep scoring pipeline identical (`getSimilarity`, `classifyAccuracy`, `tokenDiff`, hints).
- Keep thresholds and pass logic unchanged (90% roadmap; etc.).
- Keep recording guards/errors/messages equivalent.

### Completion Test
- For same phrase+transcript inputs, React and vanilla produce matching score labels and state updates.
- Phase 6 checks in `REACT_PARITY_CHECKLIST.md` are green.

### If Already Satisfied
Proceed to Step 7.

---

## Step 7 — Phrases Mode Parity (Prompt/Response/Convo)

### Goal
Migrate full staged phrases mode with identical unlock/progression behavior.

### Required Tasks
- Port Phrases Home unlock logic.
- Port Prompt learn+match (reset-on-mismatch).
- Port Response learn+match+speak.
- Port Convo listen+speak.
- Preserve stage completion persistence arrays.

### Completion Test
- Stage/category unlock progression matches vanilla on same fixtures.
- Phase 7 checks in `REACT_PARITY_CHECKLIST.md` are green.

### If Already Satisfied
Proceed to Step 8.

---

## Step 8 — Settings/System/PWA Parity

### Goal
Migrate system-level behavior and persistence parity.

### Required Tasks
- Port settings (theme, contrast, font scale).
- Port reset flow.
- Port install prompt behavior.
- Port global error/rejection guards.
- Port service worker registration behavior.

### Completion Test
- Settings/reset/pwa behavior matches vanilla on same fixture states.
- Phase 8 checks in `REACT_PARITY_CHECKLIST.md` are green.

### If Already Satisfied
Proceed to Step 9.

---

## Step 9 — Consolidation and Cutover

### Goal
Make React the primary production entry only after parity proof.

### Required Tasks
- Switch production entry to React.
- Keep vanilla snapshot in branch/tag until post-cutover validation.
- Remove dead vanilla-only rendering paths only after acceptance.
- Update docs/scripts for final architecture.

### Completion Test
- All phase checks are green.
- Final cutover build passes and no regression is observed in parity checklist.

### If Already Satisfied
Migration is complete.

---

## 5) Practical No-Regression Verification Strategy

Primary execution artifact:
- `REACT_PARITY_CHECKLIST.md` is the operational pass/fail script.

Strategy layers:
- Baseline capture from vanilla for each target flow.
- Deterministic localStorage fixtures for side-by-side comparison.
- Per-step parity checks before moving to next step.
- Build/runtime gates each cycle.

Minimum gates (every step):
- `npm run check`
- `npm run build`
- `npm run build:react`

---

## 6) Suggested Target Structure During Migration

React destination structure:
- `react/components/*`
- `react/views/*`
- `react/hooks/*`
- `react/adapters/*`

Keep existing modules as canonical logic until replaced with parity proof:
- `utils/*`
- `state/store.ts`
- `features/*`

---

## 7) Definition of Done (Per Step)

A step is complete only when:
1. Its Completion Test passes.
2. Corresponding section in `REACT_PARITY_CHECKLIST.md` is fully green.
3. `npm run check`, `npm run build`, and `npm run build:react` pass.
4. No new console errors/unhandled rejections appear in migrated flow.
5. Relevant docs are updated.

---

## 8) Risk Register (Mitigations)

Risk: unlock/progression drift
- Mitigation: reuse existing roadmap/phrases logic modules first.

Risk: localStorage schema drift
- Mitigation: keep `state/store.ts` as persistence boundary until final cutover.

Risk: async speech race conditions in React
- Mitigation: preserve explicit recording guards and retry/timeout behavior.

Risk: partial migration without parity
- Mitigation: enforce step order + mandatory checklist gating.

---

## 9) Copilot Execution Notes

When executing a step:
- implement only in-scope tasks for that step,
- avoid UI text/threshold changes unless explicitly requested,
- run parity checklist section and build gates before moving forward,
- if step already satisfies Completion Test, skip to the next step.

---

## 10) Command Reference

Vanilla baseline:
- `npm run dev`
- `npm run build`

React migration path:
- `npm run dev:react`
- `npm run build:react`
- `npm run preview:react`

Global check:
- `npm run check`
