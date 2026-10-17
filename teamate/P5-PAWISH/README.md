# P5-PAWISH — Visualisation Developer (local worklog)

**Path:** `teamate/P5-PAWISH/`  
**Person:** Pawish (Person 5)  
**Role:** Visualisation Developer (D3 + React + MapLibre/Leaflet)  
**Branch:** `P5-PAWISH`  
**Tooling:** Cursor AI coding agent (multi-agent) helped implement this work  

## How to use this folder

Each numbered subfolder is one step. Read `NOTES.md` inside for what was done, why, and what Cursor helped with.

| Step | Folder | What |
|------|--------|------|
| 0 | `00_prompt/` | The exact P5 prompt + design reference used |
| 1 | `01_setup/` | Frontend host scaffold so viz can run locally |
| 2 | `02_sample_data/` | `case.sample.json` for charts before real H12 data |
| 3 | `03_viz_utils/` | Shared D3 helpers (`util.ts`) |
| 4 | `04_components/` | TimeSlider, RedStrings, DayTimeline, Clock24, FlagHeatmap, RuleBars, minis |
| 5 | `05_pages/` | MapPage, TimelinePage, NetworkPage |
| 6 | `06_local_run/` | Commands used, URLs, screenshots/notes from local verify |
| 7 | `07_polish_lab/` | ResizeObserver fix, sticky TimeSlider, `/lab` harness, page polish |
| 8 | `08_satellite_map/` | Real Gilmorehill **satellite** map — MapLibre 3D + Leaflet ISO fallback |
| 9 | `09_playwright_report/` | Full Playwright suite — **PASS 9/9** |

## Owns (from prompt)

- `frontend/src/components/viz/*` (incl. `CampusMapFallback.tsx`)
- `frontend/src/pages/MapPage.tsx`
- `frontend/src/pages/TimelinePage.tsx`
- `frontend/src/pages/NetworkPage.tsx`
- `frontend/src/pages/VizLabPage.tsx` (local acceptance harness)

## Run

```bash
cd frontend
npm install
npm run dev -- --host 127.0.0.1 --port 5173
```

- Home `/` · Map `/map` · Timeline `/timeline` · Network `/network` · Lab `/lab`

## Temporary host files

Until P3/P4 land their final work, a Vite shell + sample Case types/store live under `frontend/` so Pawish can run charts. Shell files are stubs except where noted in the steps above.
