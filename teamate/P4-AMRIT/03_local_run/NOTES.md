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
