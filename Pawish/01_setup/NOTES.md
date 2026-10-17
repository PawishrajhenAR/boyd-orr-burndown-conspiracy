# Step 1 — Frontend host setup (local demo)

**Who:** Pawish  
**Cursor helped:** Yes — scaffolded a Vite + React + TS app so P5 charts can run before P3/P4 merge.

## Why

P5 owns only `components/viz/*` and Map/Timeline/Network pages. Those need a host app, Zustand store, and Case types. Until teammates land:

- Temporary stubs under `frontend/` (types, store, router, sample JSON loader)
- Documented here as **local-only host**, not a claim on P3/P4 ownership

## Commands used

```bash
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
npm install d3 @types/d3 zustand react-router-dom clsx
```
