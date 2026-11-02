# Tailor

**Fitness and wellbeing, made to measure.**

A personal fitness app that adapts to one person's body: calorie targets recalibrate from real weigh-ins and food logs, training progresses per side, and rehab, sleep and motivation are built in. It runs today as a Claude artifact; the codebase is being migrated toward a typed, tested monorepo that can also back a native app.

## Repository layout

```
packages/core/      @tailor/core: pure TypeScript domain logic (no UI, no storage)
  src/energy.ts       weight trend, formula and adaptive calorie burn
  src/targets.ts      daily targets and overeating carry-over (with safety caps)
  src/training.ts     training blocks, deloads, stall detection, session plans, progression
  src/nutrition.ts    food totals and zod validation of AI output
  test/               unit tests (node:test via tsx)
apps/web/src/app.html  the current single-page UI (being migrated to React)
scripts/build.mjs      bundles core with esbuild and inlines it into dist/index.html
tests/e2e/             Playwright smoke + parity tests against a mock of the artifact runtime
```

## Commands

```
npm install
npm run typecheck   # strict TypeScript
npm test            # core unit tests
npm run build       # -> dist/index.html (what gets published)
npm run e2e         # smoke test of the built app
```

## Design decisions

- **Pure core.** All math lives in `@tailor/core` as functions of explicit state, so the web app, a future Expo app, an Express API and scheduled Lambda jobs can share it.
- **Safety rules are code, and tested.** Carry-over never removes more than 500 kcal/day, never goes below 1,600 kcal, and never reduces protein.
- **AI output is validated.** Food estimates from Claude pass through zod schemas; malformed items are dropped instead of saved.
- **Migration by strangler fig.** Logic moved to TypeScript first, behind thin wrappers, with a parity test proving the UI shows identical numbers. The one intentional difference is a fixed date bug the new tests caught (the adaptive-burn window parsed dates as UTC and skipped a day west of Greenwich).

## Features

- **Today**: calorie/protein/steps rings, eaten vs left toggle, overeating carry-over ("alterations"), 3-day "fitting" recap, weigh-in, sleep (RingConn screenshot reading), steps, creatine, daily home wrist routine
- **Train**: 4-session Upper/Lower rotation plus optional arm day, per-side weights, auto progression, 5-week blocks with deloads and stall detection, exercise swaps, weekly per-muscle volume, posture primer, exercise guides
- **Food**: search, Claude estimates, barcode + label scanning, meal photos with context, serving sizes in servings/g/oz/ml
- **Why**: motivation tools, promises-kept tracking, moment logging
- **Progress**: photos, strength and left/right balance, weight trend, measurements, sleep vs. performance
- **Me**: profile, goal, adaptive calorie targets

## Roadmap

1. React + TypeScript UI with TanStack Query, behind `Store` and `AiClient` adapters (Vite build).
2. Express + MongoDB API, Auth0, S3 for photos.
3. Expo app with Apple Health, live barcode scanning and notifications; EventBridge + Lambda for nightly recalculation.
