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
