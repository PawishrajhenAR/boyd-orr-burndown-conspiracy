# 10 — Full acceptance (post–P4 merge)

Date: 2026-10-17

## Fixes
- `RedStrings`: `pointer-events: none` + `z-index: 1` so corkboard polaroids stay clickable (was blocking Playwright / real clicks).
- `VizLabPage`: re-enables `judgeMode` when case is present (after `loadCase` resets it) so FlagHeatmap / RuleBars show the full flag set.
- `RuleBars`: taller empty-state SVG so “No flags revealed yet” is readable on HQ.

## Suite (`/tmp/p5-full/report.json`)
- Build: pass
- Backend pytest: 3 passed
- Playwright checks: **10/10 PASS**
  - board cards + TimeSlider + polaroid click
  - HQ charts
  - map Esri satellite + iso buildings + dossier
  - timeline paths
  - network reveal 6/6
  - lab Clock24 / DayTimeline / FlagHeatmap / RuleBars + 18+
  - interrogation charts
  - no unexpected console (1 expected headless WebGL → Leaflet fallback)
