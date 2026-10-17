# Step 4 — Viz components (P5)

**Who:** Pawish  
**Cursor helped:** Yes — built the full `frontend/src/components/viz/` kit against the data contract + Zustand store.

## What was built

All under `frontend/src/components/viz/`:

| File | Role |
|------|------|
| `util.ts` | `hhmm`, `timeScale`, `verdictColor`, `useVisibleFlags`, `useSvgSize`, `isOpenAt`, `TOKENS`, `NETWORK` |
| `TimeSlider.tsx` | Bottom “REPLAY THE DAY” bar — orange track, play/pause (+5 min / 100 ms), red flag ticks |
| `RedStrings.tsx` | Cork-board SVG overlay; curved meeting strings between board cards |
| `DayTimeline.tsx` | Mini Gantt: visit bars, ghost lecture, hatched closed hours, flagged outlines |
| `Clock24.tsx` | Radial 24h clock; opening rings, visit arcs, OOH pulse, 18+ badge, centre break count |
| `FlagHeatmap.tsx` | Buildings × hour occupancy; red flag dots; click → replay + building |
| `RuleBars.tsx` | Horizontal flag counts per rule; colour by avg severity; click → `setHint` |
| `StorylineMini.tsx` | Static storyline preview for Case Closed |
| `NetworkMini.tsx` | Static force-layout network preview (dark link-analysis look) |
| `index.ts` | Re-exports components + util helpers |

## Patterns

- React owns the `<svg>` / shell; D3 draws inside `useEffect` and cleans up.
- `ResizeObserver` (and `MutationObserver` on RedStrings) for layout.
- Store: `../../store/useCaseStore` · types: `../../types/case`.
- Tokens: accent `#ffb347`, pin `#d62828`, panel `#2a1f17`, network `#0b1020`.

## Not in this step

Map / Timeline / Network **pages** (`pages/MapPage.tsx` etc.) are a later P5 step.
