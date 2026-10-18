# Workspace context — Boyd Orr Burndown Conspiracy

**Verified:** 2026-10-17 at commit `25e6e41` (branch `P5-PAWISH`). Re-verify anything below before relying on it after major merges.
**Why here and not `docs/`:** `OWNERS.md` marks `docs/` as shared read-only; `teamate/P{N}-NAME/` is the per-person worklog convention.

## 1. What it is

A GUTS 2026 / SAS hackathon app: "Case File #1105: The Boyd Orr Firework Plot". It ingests 4 messy raw files
(`data/raw/`), cleans them, flags rule violations, finds who met whom, ranks 6 conspirators + 1 mastermind,
and presents everything as a detective game with D3/MapLibre visualisations. Judging weights visualisation and
generalisability (no hard-coded names in logic).

No database, no auth, no user accounts, no AI/LLM integration. State is an in-memory `Case` (backend) and a Zustand store (frontend).

## 2. Stack (verified from manifests / runtime)

| Layer | Verified versions |
|---|---|
| Backend | Python 3.11.9 (`backend/.venv`), FastAPI 0.143.3, Pydantic 2.14.1, pydantic-settings, pandas 3.0.6, NetworkX 3.6.1 (listed; not imported by app code), pytest, httpx |
| Frontend | Node 22.22, Vite 8.3, React 19.2, TypeScript ~6.0, react-router-dom 7, Zustand 5, D3 7.9, maplibre-gl 4.7, leaflet 1.9, oxlint |
| Not present despite prompt §2 | Tailwind, Framer Motion (`clsx` installed but unused) |

## 3. Commands (all run and observed 2026-10-17)

```bash
cd backend && .venv/bin/python -m pytest -q            # 41 passed (3 deprecation warnings: on_event)
cd backend && .venv/bin/python -m app.analysis.build_case   # readable verdict summary
cd backend && .venv/bin/python -m app.pipeline.run          # pipeline + data-quality summary
cd backend && .venv/bin/python -m app.export                # regenerates frontend/public/case.json (P3)
cd backend && .venv/bin/uvicorn app.main:app --reload --port 8000
cd frontend && npm run build    # passes; 1.38 MB JS chunk warning
cd frontend && npm run lint     # 0 errors, 2 warnings (BoardPage memoisation, MapPage setState-in-effect)
cd frontend && npm run dev      # Vite proxies /api -> 127.0.0.1:8000
```
System `python3` has no deps — always use `backend/.venv`.

## 4. Architecture / data flow

```
data/raw/* ─► pipeline/run.py run_pipeline() ─► CleanData
              (load → buildings → clean students/visits → assign_lectures → statements → quality)
CleanData ─► analysis/build_case.py build_case(clean, RuleConfig)
              rules.run_rules → testimony.annotate_statements → meetings.find_meetings
              → scoring.build_suspects → oddities.detect_oddities → CaseMeta
Case ─► main.py (cached at startup; falls back to case.sample.json on failure)
     └► export.py → frontend/public/case.json (1.6 MB, committed; verified identical to fresh output)
Frontend: App.tsx mounts → store.loadCase() → api/client.loadCase():
          /api/case → /case.json → /case.sample.json (8 s timeout each)
          All filtering is client-side from the single Case object.
```

## 5. Ownership (OWNERS.md) — only edit your role's files

| Area | Owner |
|---|---|
| `backend/app/pipeline/*`, `tests/test_pipeline.py` | P1 |
| `backend/app/analysis/*`, `tests/test_analysis.py` | P2 |
| `main.py`, `models.py`, `config.py`, `export.py`, `requirements.txt`, `tests/test_api.py`, `types/case.ts`, `api/client.ts`, `case.sample.json` | P3 |
| App shell, store, theme, content, `components/game/`, game pages | P4 |
| `components/viz/*`, `pages/MapPage.tsx`, `TimelinePage.tsx`, `NetworkPage.tsx`, `VizLabPage.tsx` | **P5 (Pawish — this branch)** |

## 6. Key files

| File | Responsibility |
|---|---|
| `backend/app/models.py` | Pydantic contract (`Case` and children). Field names verified identical, in order, to `frontend/src/types/case.ts`. |
| `backend/app/config.py` | `Settings` (RAW_DIR, CORS) + mutable global `RuleConfig` (CONSPIRATOR_COUNT=6, SEVERITY map, MIN_MEETING_MINUTES=1). |
| `backend/app/main.py` | Routes: `GET /api/health`, `/api/case`, `/api/students/{id}` (accepts raw/lowercase IDs), `/api/buildings/{id}`, `/api/meetings?until&student`, `POST /api/upload` (4 multipart files), `GET/PUT /api/config`. |
| `analysis/rules.py` | `FlagFactory` (IDs `f0001…`, severity from config) + log rules. |
| `analysis/scoring.py` | Score = sum of severities of distinct rules; top-N with score ≥3 = conspirator; mastermind = unique non-serious student who met all conspirators. |
| `analysis/meetings.py` | Sweep-line co-location → 6,848 meetings on real data. |
| `frontend/src/store/useCaseStore.ts` | Zustand store: case, selection, replayTime/isPlaying, judgeMode, examined/revealedFlagIds, accusation, hint; helpers `studentById`, `visitsFor`, `flagsFor`, `meetingsUntil`, `boardStudents`. Highest-coupling node in the graph (51 edges). |
| `frontend/src/components/viz/util.ts` | `hhmm`, `timeScale`, `verdictColor`, `useVisibleFlags`, `observeResize`, `useSvgSize`, `isOpenAt`, `TOKENS`, `NETWORK`. |
| `frontend/src/components/viz/TimeSlider.tsx` | Owns playback interval (5 min / 100 ms) driven by `isPlaying`. |
| `pages/MapPage.tsx` (767 lines) | MapLibre satellite map; falls back to `CampusMapFallback.tsx` (Leaflet). Uses external tile/glyph URLs (needs network). |
| `pages/NetworkPage.tsx` (834 lines) | d3-force link-analysis graph, reveal-mastermind. |
| `pages/TimelinePage.tsx` (483 lines) | Storyline chart with filters. |
| P4 game pages | Board, Interrogation, Evidence, HQ, Accuse, CaseClosed, Briefing, Title — written as dense one-line JSX. |

## 7. Business rules (contract §6–7)

- Times are integer minutes from midnight; ≥1440 = after midnight.
- Verified real-data result: conspirators Alice Patterson, Jonny Craig, Eric Parkin, Oscar Brown, Abdul Murphy, Stuart Wands; suspicious Paul Butler; mastermind Scott Johnston (met 6/6). 23 flags, 56 data-quality issues, 19 oddities. (Names allowed in tests only.)
- Flags are hidden in field mode until revealed by Interrogation checks; judge mode shows all.

## 8. Known issues (with evidence)

Verified:
1. `PUT /api/config` with a partial `SEVERITY` map → **500** `KeyError: 'subject_without_lecture'` (`rules.py:31`). Negative and unknown rule severities are accepted (200). (P3)
2. `PUT /api/config` rebuilds from `settings.RAW_DIR` (`main.py` `update_config`), silently discarding a case produced by `POST /api/upload`. (P3)
3. Store `loadCase` has no error handling (`useCaseStore.ts:34`); if all 3 sources fail the promise rejects unhandled and pages stay on "Loading…" forever. (P4)
4. Accuse flow: `AccusePage` decides the mastermind by looking up the *true* verdict among picks; `CaseClosedPage` never compares the accusation with the answer — always prints "FIREWORK PLOT FOILED". (P4)
5. `InterrogationPage` "Profile check" lists `flagsFor` (all flags) regardless of reveal state — leaks flags in field mode. (P4)
6. `EvidencePage` shows only the first 6 of 56 data-quality issues. (P4)
7. Dead code: `pages/HomePage.tsx` (not routed), `src/App.css` (never imported), `assets/hero.png`, `react.svg`, `vite.svg`, `public/icons.svg`; API helpers `uploadCase`, `updateConfig`, `checkApiHealth` unused; `clsx` unused. `index.html` title is "frontend".
8. Colour inconsistency: `TOKENS.mastermind` is green `#38e062`, while `verdictColor('mastermind')` and `NETWORK.mastermind` are amber `#e3af35`. (P5)
9. Single 1.38 MB JS bundle (MapLibre + D3 + Leaflet); no route-level code splitting.
10. Lint warnings: `BoardPage.tsx` manual memo; `MapPage.tsx:303` setState in effect (P5).

Risks (not reproduced):
- `useVisibleFlags` selector returns a fresh `[]` when `case` is null (`util.ts:41`); Zustand 5 can loop on unstable selector results. Currently guarded because callers render only after load.
- Title "Judge mode" before load finishes would be reset by `loadCase` (it sets `judgeMode: false`).
- Amber Dark restyle (commit `25e6e41`) deliberately departs from prompt §10 tokens/fonts (Fredoka/Inter, cork palette).
- `@app.on_event` is deprecated (FastAPI warning). Upload has no size limit. CORS `allow_credentials=True` with explicit origins (fine locally).
- Playwright suite cited in `09_playwright_report/` lives in `/tmp`, not in the repo; it predates the P4 merge (it tests the old Home page). No frontend tests exist in-repo.

## 9. Graphify

- Installed: `graphify` 0.8.46 (`~/.local/bin/graphify`). Output dirs are gitignored.
- Canonical graph: `graphify-out/` at repo root (`graph.json`, `graph.html`, `GRAPH_REPORT.md`). Refreshed with `graphify update .` on 2026-10-17 — no topology change since `ce0feed`.
- `backend/graphify-out/` (backend-only, older) and `frontend/graphify-out/` (manifest only) are stale leftovers.
- 745 nodes / 1,327 edges, no import cycles. God nodes: `useCaseStore`, `CleanData`, `hhmm()`, `FlagFactory`, `run_pipeline()`, `build_case()`.
- Limitation: AST-only (no LLM pass) — it does **not** link `fetch('/api/case')` to the FastAPI route, has no runtime/Zustand-subscription edges, and duplicates prompt-markdown communities.
- Useful: `graphify affected "CleanData" --depth 1`, `graphify path "A" "B"`, `graphify explain "useCaseStore"`.

## 10. Recommended sequence

1. P5 (own files): unify mastermind colour; fix `MapPage` setState-in-effect; stabilise `useVisibleFlags` selector; lazy-load Map/Network routes (needs P4 to touch `App.tsx`).
2. Message P4: load-error state in store; accusation scoring on Case Closed; stop Profile-check flag leak; full Evidence table; remove dead files.
3. Message P3: merge partial `SEVERITY` updates + validate (0–3, known rules → 422); keep uploaded data for re-scoring; lifespan handler.
4. Optional: commit a minimal Playwright smoke test so acceptance is reproducible.

## 10b. New UI: "The Investigation File" (built 2026-10-17, uncommitted at time of writing)

- `/` → `src/flow/InvestigationFlow.tsx` (all other routes redirect to `/`). Old corkboard pages in `src/pages/*` are untouched but unrouted; `src/index.css` no longer imported (`main.tsx` imports `src/flow/flow.css`).
- Pages: Envelope (story-gate login, creds in one constant in `Envelope.tsx`) → Register (163 flip cards) → Level 1 filter (163→25 via `shortlist.ts`) → Level 2 (6 conspirators) → MovementChart (D3 step lines, 1 s = 1 h) → FinalResult (mastermind ring + oddities + print).
- `?judge=1` skips login and title cards. Keyboard ← →, scroll-snap, progress bar.
- New deps: `tailwindcss` 4.3 + `@tailwindcss/vite`, `framer-motion` 14.3. `vite.config.ts` adds the Tailwind plugin.
- `npm test` → `node --test src/flow/*.test.ts` (Node 22 strips TS natively; tests excluded from `tsconfig.app.json`). 4/4 pass.
- E2E: `frontend/e2e/smoke.py` (`npm run e2e`; Python Playwright; env `FLOW_URL`, `BROWSER_PATH=/usr/bin/brave` on this machine, `EXPECT_API=1`). Verified 16/16 with the live API (1280×800 + 1920×1080, zero console errors) and 16/16 on the `/case.json` fallback.
- **2026-10-18: pulled `origin/main` (56ee628, P4 merged the flow).** Tests now live in `frontend/tests/` (`npm test` → 11 unit tests; `npm run e2e` → P4's `tests/flow.smoke.mjs`, which launches `channel: 'msedge'` and needs Edge). The Python smoke test `frontend/e2e/smoke.py` (37 checks, Brave) is still local-only/uncommitted. Old pages are routed again under `/classic`, `/map`, `/register`, … with the legacy CSS loaded only off `/`. Pre-pull local work is kept in `git stash` ("P5 local investigation-flow work before pulling origin/main").
- Polish pass (2026-10-17): Register auto-flip wave + "Flip all"; police⇄investigator dialogue drives Level 1/2/3 + final stages (`dialogue.ts` templates filled from data, `Conversation.tsx`, `FilterBasis.tsx`); MovementChart nodes + "Analysing pattern…" darkening sequence; `Background.tsx` (vignette/grain/watermarks); `sound.ts` (Howler 2.2.4, master 0.4, per-sound gap, max 3 concurrent, mute in localStorage, played sounds logged to `window.__sfx`). SFX are synthesised by `frontend/scripts/make_sfx.py` (CC0, see `public/sfx/CREDITS.md`). `--color-alarm #f07a7a` is the red for text on dark (contrast ≥4.5:1). Smoke test now 37 checks, passing at 1280×800 + 1920×1080 and against the live API.
- Old-UI issues (MapPage lint, mastermind colour, `useVisibleFlags`, P4 page bugs) are moot while those pages are unrouted. Backend `PUT /api/config` bugs still exist but the new UI doesn't call config/upload.
- Ownership note: `App.tsx`, `main.tsx`, `package.json`, `vite.config.ts`, `index.html`, `tsconfig.app.json` are P4/shared files changed for this UI.

## 11. Inspection checklist

- [x] Git state, branches, ownership, prompts (00, P5)
- [x] Backend: all of `main.py`, `config.py`, `export.py`, `models.py`, `build_case.py`, `scoring.py`, `meetings.py`, `timeutil.py`, `run.py`, `quality.py`; head of `rules.py`; `test_api.py`
- [x] Frontend: `main.tsx`, `App.tsx`, `client.ts`, store, tokens, story, `GameKit`, all P4 pages, viz `util.ts`/`index.ts`/`VizPageShell`, structure of Map/Network/Timeline
- [x] Build, lint, tests, case.json freshness, config endpoint probe, Graphify refresh + queries
- [ ] Not read in full: `pipeline/clean.py`, `buildings.py`, `statements.py`, `load.py`; `testimony.py`, `oddities.py`; `test_analysis.py`, `test_pipeline.py`; bodies of Map/Network/Timeline pages and the viz components; `index.css` beyond tokens
- [ ] Not run: the app in a browser (no visual/runtime UI check this pass); `docs/challenge-brief.pdf` and `design_reference.png` not opened
