# Notes — MapPage & TimelinePage

**Person:** Pawish (P5)  
**Date:** 2026-10-17  
**Owns:** `frontend/src/pages/MapPage.tsx`, `TimelinePage.tsx` (+ thin `TimeSlider` / `util` stubs if missing)

## What was built

### Map (`/map`) — `MapPage.tsx`
- Title **Map — where it happened** + how-to-read caption.
- Layout: `row` → `viz-stage` (flex) + `side-panel`.
- `d3.geoMercator().fitExtent` on building lat/lon; dark campus backdrop.
- Buildings as labelled circles sized by visit count.
- At `replayTime`: occupant dots (`start <= t < end`) with `forceCollide` around each building.
- Conspirators red; mastermind gold only when `judgeMode`.
- Buildings with flags near the current time glow red.
- Click building → `selectBuilding` + side panel (name, open hours, description, lectures, occupants, flags).
- `selectedStudentId` draws an animated path through buildings in time order.
- `<TimeSlider />` at the bottom; D3 draw in `useEffect` + `ResizeObserver`.

### Timeline (`/timeline`) — `TimelinePage.tsx`
- Title **Timeline — the day** + how-to-read caption.
- Storyline: rows = buildings, x = `meta.time_min…time_max`, one `curveMonotoneX` path per student with per-row offset.
- Hatched closed-hours (`always_open` skipped; `open_end` may be > 1440).
- Lecture visits drawn thicker; flags as red ×; gold rings for meetings with the selected student.
- Filters: All | Flagged only | Selected + contacts.
- Brush strip at chart bottom zooms the time axis; double-click / Reset clears zoom.
- Vertical dashed line at `replayTime`.
- Hover tooltip (name + statement snippet); click → `selectStudent`.
- `<TimeSlider />` at the bottom.

### Supporting stubs (P5-owned viz folder)
- `components/viz/util.ts` — `hhmm`, `verdictColor`.
- `components/viz/TimeSlider.tsx` — thin working range + play toggle (full mockup styling later).
- `pages/NetworkPage.tsx` — placeholder so the local App router compiles (full network viz next).

## How to verify locally

```bash
cd frontend && npm run dev
```

Open `/map` and `/timeline` against `public/case.sample.json` (API fallback). Scrub the slider; click buildings/students; brush the timeline zoom strip.
