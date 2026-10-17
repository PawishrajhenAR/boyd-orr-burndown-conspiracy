# Pawish — P5 Visualisation Developer (local worklog)

**Person:** Pawish (Person 5)  
**Role:** Visualisation Developer (D3 + React)  
**Tooling:** Cursor AI coding agent (multi-agent) helped implement this work  
**Repo policy:** Role work stays local first; push to `main` only after the team integrates.

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

## Owns (from prompt)

- `frontend/src/components/viz/*`
- `frontend/src/pages/MapPage.tsx`
- `frontend/src/pages/TimelinePage.tsx`
- `frontend/src/pages/NetworkPage.tsx`

## Temporary host files (for local demo only)

Until P3/P4 land their work, a minimal Vite shell + sample Case types/store live under `frontend/` so Pawish can run charts. Those shell files are **stubs**, not the final P3/P4 ownership claim.
