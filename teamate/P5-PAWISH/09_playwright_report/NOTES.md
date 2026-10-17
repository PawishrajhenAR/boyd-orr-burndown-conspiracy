# Step 9 — Playwright acceptance report

**Who:** Pawish  
**Branch:** `P5-PAWISH`  
**Date:** 2026-10-17

## Command
Headless Chromium against `http://127.0.0.1:5173` + `npm run build`.

## Verdict: **PASS (9/9)**

| Check | Result |
|-------|--------|
| Production build (`tsc` + vite) | Pass |
| Home | Pass |
| Map — satellite tiles + 14 buildings + dossier click + slider on screen | Pass |
| Timeline — paths + filters | Pass |
| Network — Reveal → Scott, Clean record, **6/6** | Pass |
| Lab — Clock24 / DayTimeline / FlagHeatmap / RuleBars + Stuart **18+** | Pass |
| Unexpected console errors (excluding expected MapLibre WebGL miss in headless) | None |

## Note
Headless CI/browser has no WebGL → Map uses **SATELLITE ISO** (Leaflet). Desktop Chrome gets **SATELLITE 3D** (MapLibre).

Screenshots from the run lived under `/tmp/p5-report/` on the test machine (not committed).
