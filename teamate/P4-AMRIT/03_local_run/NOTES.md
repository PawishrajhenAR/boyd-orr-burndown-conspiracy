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
