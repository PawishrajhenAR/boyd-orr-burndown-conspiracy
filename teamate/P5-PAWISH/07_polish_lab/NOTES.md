# Step 7 — Polish, ResizeObserver fix, Viz lab

**Who:** Pawish  
**Branch:** `P5-PAWISH`  
**Date:** 2026-10-17

## What changed

### Shared viz
- Added `observeResize()` in `util.ts` — rAF-debounced ResizeObserver (stops console floods).
- Wired it through TimeSlider, Clock24, DayTimeline, FlagHeatmap, RuleBars, StorylineMini, RedStrings, Map/Timeline/Network pages.
- TimeSlider: sticky bottom bar + shadow so it stays on screen.

### App shell (local P5 host)
- Removed duplicate play interval from `App.tsx` (TimeSlider owns playback).
- Live replay clock in the topbar.
- New route `/lab` → `VizLabPage.tsx`.

### Viz lab (`/lab`)
Acceptance harness for charts P4 will mount later:
- Clock24 + DayTimeline (pick flagged student; Stuart = 18+/midnight, Abdul = OOH Boyd Orr)
- FlagHeatmap + RuleBars (HQ)

### Page polish
- Map: legend, clearer captions (later replaced by satellite — see step 8).
- Timeline: top + bottom time axes, hour guides.
- Network: hair colour swatch for hex values.
- Home: card link to Viz lab.
