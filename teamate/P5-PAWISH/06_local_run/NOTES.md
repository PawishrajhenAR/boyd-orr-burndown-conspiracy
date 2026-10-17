# Step 6 — Local run

**Who:** Pawish  
**Cursor helped:** Yes — `npm run build` then `npm run dev`.

## Commands

```bash
cd frontend
npm run build    # typecheck + production bundle — PASSED
npm run dev -- --host 127.0.0.1 --port 5173
```

## URLs

- Home: http://127.0.0.1:5173/
- Map: http://127.0.0.1:5173/map
- Timeline: http://127.0.0.1:5173/timeline
- Network: http://127.0.0.1:5173/network

## Verify

- `npm run build` — **passed** (tsc + vite production bundle)
- Dev server started: `vite --host 0.0.0.0 --port 5173`
- Open in your browser (on this machine): http://127.0.0.1:5173/

## Policy

**Do not push to `main` yet.** Everyone finishes their role locally; team integrates later, then one push.

## Cursor + Pawish credit

Implemented by **Pawish** (P5) with **Cursor** multi-agent assistance. Prompt recorded in `teamate/P5-PAWISH/00_prompt/`.
