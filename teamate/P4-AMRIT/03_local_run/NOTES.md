# 03 — Local verification

Commands run from `frontend/`:

```powershell
npm.cmd ci --no-audit
npm.cmd run build
npm.cmd run dev -- --host 127.0.0.1
```

Result:

- Production build passed: TypeScript compiled and Vite emitted `dist/`.
- Vite served at `http://127.0.0.1:5173/`.
- `GET /` and `GET /case.sample.json` each returned HTTP 200.

## Offline demo and game feedback update

- Confirmed `case.json` and `case.sample.json` are identical, complete mock Cases. The existing API client therefore falls back to a full working case when FastAPI is unavailable.
- Added a `DEMO CASE` rail label to make that temporary data source clear during the hackathon.
- Added browser-generated click sounds for cards, navigation, clues, danger actions, and successful actions. The rail includes a Sound on/off control.
- Verified every application route and both mock data endpoints returned HTTP 200 from the local Vite server.

## Backend-independent P4 demo mode

- P4's Zustand store now loads `/case.sample.json` directly rather than calling the incomplete `/api/case` backend.
- The local fixture uses the shared Case contract and retains raw-data findings such as the lowercase `2813225b` source ID resolving to canonical `2813225B`.
- The production build passed, and the title, game pages, all P5 visualisation routes, the Stuart Wands interrogation route, and the fixture endpoint returned HTTP 200 locally.

## Integration update — origin/main at `8194b24`

- Pulled P3's completed FastAPI, models, export module, pipeline scaffolding, and API client into `P4-AMRIT`.
- Removed P4's forced offline loader and restored the shared `api/client.ts` loader. The UI now loads `/api/case` first, then uses P3's documented `case.json` and `case.sample.json` fallbacks only if necessary.
- Removed the P4 `DEMO CASE` rail label. The sound controls and game feedback remain.
- Verified `GET /api/health` and `GET /api/case` through Vite's proxy. The returned Case has 9 students, 14 buildings, 26 visits, 11 flags, 9 meetings, and 9 suspects, with valid time bounds. The production front-end build passed and all P4 and P5 routes returned HTTP 200.

### Team handoff: backend issue found

`backend/app/pipeline/run.py` currently raises `NotImplementedError("pipeline steps 2-5 not built yet")`. P3's API handles this safely by falling back to `frontend/public/case.sample.json`, so the full front end works now. P1/P2/P3 should complete the remaining pipeline/analysis integration before claiming that `/api/case` is generated from `data/raw/` rather than the sample fixture.

## Full check — local services running

- `python -m pytest -q` in `backend/`: **3 passed**.
- `npm.cmd run build` in `frontend/`: **passed**.
- `npm.cmd run lint` completed with one non-blocking React manual-memoization warning in P4's `BoardPage.tsx`.
- FastAPI is serving `http://127.0.0.1:8000` and Vite is serving `http://127.0.0.1:5173`.
- Verified API health, the live Case endpoint through both FastAPI and Vite's proxy, plus every game and visualisation route: all returned HTTP 200.

## P5 visualisation integration — origin/main at `1e1ce1a`

- Merged P5's latest visualisation updates, including the satellite-map fallback, upgraded map/timeline/network components, the Viz Lab, and their Leaflet/MapLibre dependencies.
- Preserved the P4 game flow, shared game components, sound feedback, P4 router, and P4 teammate worklog while resolving the two P4-owned conflicts in `App.tsx` and `index.css`.
- Added `/lab` to the P4 router and navigation rail so the new P5 Viz Lab is reachable alongside Map, Timeline, and Network.
- Verified `python -m pytest -q` in `backend/` (3 passed), the combined front-end production build, FastAPI health, Vite's proxied Case endpoint, and all P4/P5 routes including `/lab` (HTTP 200).
- Build warning: the combined JavaScript bundle is 1.38 MB before compression. It is functional; split map/network libraries into lazy-loaded routes if bundle size becomes a deployment concern.
- Lint warnings: P4 Board manual memoization and P5 Map state-in-effect. Neither blocks the build or local run.
