# Tailor

**Fitness and wellbeing, made to measure.**

A personal fitness app that adapts to one person's body: calorie targets recalibrate from real weigh-ins and food logs, training progresses per side, and rehab, sleep and motivation are built in. Single-file HTML, built with Claude.

- **Today**: calorie/protein/steps rings, eaten vs left toggle, overeating carry-over ("alterations"), 3-day "fitting" recap, weigh-in, sleep (RingConn screenshot reading), steps, creatine, daily home wrist routine
- **Train**: 4-session Upper/Lower rotation with per-side weights, auto progression, posture primer, exercise guides (animated figures, muscle maps, cues)
- **Food**: search, Claude estimates, barcode + nutrition-label scanning, serving sizes in servings/g/oz/ml
- **Why**: motivation tools, promises-kept tracking, moment logging
- **Progress**: photos, strength and left/right balance, weight trend, measurements, sleep vs. performance
- **Me**: profile, goal, adaptive calorie targets

Runs as a Claude artifact; storage, Claude calls and photo uploads use the artifact runtime (`window.claude`).
