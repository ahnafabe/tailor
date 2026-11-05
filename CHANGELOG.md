# Changelog

Commit dates match when each version was published. Older code snapshots were not kept, so the full app source arrives with v15.

## v1: Left Wrist Comeback rehab tracker
Daily wrist mobility checklist, pain traffic-light, weekly left-vs-right range/grip tests, injury summary from hospital records.

## v2: Rebuild as all-in-one fitness app
4-session lifting rotation with double progression and 15-min wrist finisher; adaptive TDEE and macros; food log with Claude estimates, barcode and label scanning; weight trend.

## v3: Personal targets, posture and goal tracker
Profile set to 25/M/5'10"/240.8 lb, goal 215 lb by Dec 15; protein from goal weight; posture primer, extra left-side sets, core work; goal projection and steps.

## v4: Per-side weights, Progress tab, sleep log
Separate L/R weights and progression, iso-lateral pressing, pec deck; progress photos, strength and balance charts, measurements; sleep entry and sleep-vs-performance table.

## v5: Read RingConn screenshots
Claude reads sleep hours, score, resting HR and HRV from RingConn screenshots.

## v6: Lifting days Sat/Mon/Tue/Fri
Tappable week planner, rotation projected onto planned days, "already trained today" option.

## v7: Fix food logging, add serving sizes
Synced docs were read-only so only the first food logged; now cloned. Serving editor with servings/g/oz/ml/cups/tbsp and live macros.

## v8: Apple-style redesign
iOS system font, colors and grouped cards, frosted tab bar with icons, activity rings for calories/protein/steps.

## v9: Eaten / Left toggle
Segmented control to show calories and macros eaten or remaining, with overage in red.

## v10: Exercise guides
Animated range-of-motion figures, front/back muscle maps, form cues and video links for every lift.

## v11: Guides for primer and wrist work
Hand/forearm close-up figures and forearm map with median nerve for wrist exercises; body guides for posture primer.

## v12: Creatine tracking
Daily creatine check with streak and water-weight note; creatine start marker on weight chart.

## v13: Daily home wrist routine
Wrist work moved out of the gym into a 15-min home routine using thera-bands, plates and grip trainer; alternating strength and mobility days.

## v14: Overeating carry-over and 3-day recap
Yesterday's overage comes off today's carbs/fat (max 500 kcal, floor 1,600, protein untouched); last-3-days recap and Claude coach notes.

## v15: Motivation (Why) tab
About-to-give-in flow with personal reasons, promises-kept proof, craving timer, goal picture, moment logging and pattern tips.

## v16: Rebrand to Tailor
Renamed the app Tailor with the subtitle "Fitness and wellbeing, made to measure"; calorie carry-over shown as an Alteration and the 3-day recap as a Fitting.

## v17: Weekly plan, volume tracking, training blocks, optional arm day
This Week view of remaining sessions; per-muscle weekly set tracker against cut targets; added lateral raises, hammer curls, triceps and a second calf day without removing anything; optional arm day outside the rotation; 5-week blocks (4 build + deload) with set ramp in weeks 3-4, stall detection, early-deload advice, exercise swaps and accessory rotation.

## v18: Context for meal photo estimates
Choosing a meal photo now opens a preview with a text box for context (portion eaten, skin removed, cooking method) that Claude uses over what the photo suggests; results offer a re-estimate with more context.

## v19: TypeScript core package, tests and build pipeline
Moved calorie, carry-over, training-block, stall, plan and progression logic into @tailor/core (strict TypeScript, 33 unit tests). The app now runs on the bundled core. AI food estimates are validated with zod. Fixed a date bug in the adaptive-burn window found by the new tests. Added esbuild build, Playwright smoke and parity tests, and GitHub Actions CI.

## v20: React app foundation (Today and Food tabs)
Vite + React 19 + TypeScript + TanStack Query app in apps/web with Store and AiClient adapters, optimistic writes and live sync. Today (rings, eaten/left, alterations, macros) and Food (search, Claude estimates with validation, serving editor) ported with Vitest + Testing Library tests. Serving-size math moved into core. Original UI moved to apps/legacy and remains the published app until React reaches parity.

## v21: Partial days, past-day editing, food catalogue
- **"I didn't log everything this day"** toggle on the Food tab. Partial days are left out of the burn estimate, recap score, streaks and sleep comparison, because a half-logged day looks like a deficit that never happened. Overage on a partial day still carries over (what was logged is a minimum). Past days that look light get a nudge to mark them.
- **Past days**: ‹ › day stepping and "Back to today" on the Food tab; a Past days list on Progress to fix weight, steps, sleep, creatine and the partial flag for any earlier day, or jump to that day's food log. Recap links to it.
- **My foods catalogue**: every food ever logged is rebuilt from history (`foodCatalog` in core, a pure function, so no data migration), merged with saved foods, one entry per name. Add re-logs the amount you had last time; edit and remove only affect future logs. Search ranks your own foods before staples.
- Core: `log.ts` (`countsAsLogged`, `foodCatalog`, `searchCatalog`, `foodKey`) with 6 new tests (44 total); `adaptive` skips partial days. Smoke tests cover all three features; parity with v20 unchanged.
