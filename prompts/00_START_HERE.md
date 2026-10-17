# Boyd Orr Case: Team Pack (read this first, 5 minutes)

## Same workflow for everyone

1. Clone / pull **this** repo: `boyd-orr-burndown-conspiracy`
2. Confirm you see this layout (do not move folders):

```
data/raw/     ← challenge CSVs + statements
docs/         ← design_reference.png + challenge-brief.pdf
prompts/      ← this pack (+ SEND_TO_TEAMMATES.md)
backend/      ← P3 / P1 / P2 (stubs ready — fill your TODOs)
frontend/     ← P4 shell + P5 viz
teamate/      ← your worklog folder P{N}-YOURNAME
OWNERS.md     ← who may edit what
```

3. Open your AI coding assistant **with this repo as the workspace**
4. Paste **your** `PROMPT_N_*.md` file in full
5. Attach `docs/design_reference.png` if your tool accepts images
6. Only edit files your role owns (section 5 of your prompt / `OWNERS.md`). Message the owner for anything else.
7. Log your steps under `teamate/P{N}-YOURNAME/` (same idea as `teamate/P5-PAWISH/`).

Every prompt shares the same **Shared Context** (data, contract, structure, design). If the contract changes,
**P3** updates `models.py` + `case.ts` and tells the team — don’t edit the shared section alone.

| Person | Prompt | Owns | Needs from | Gives to |
|---|---|---|---|---|
| **P1 Data Engineer** | PROMPT_1 | `backend/app/pipeline/*` | `data/raw/` | `CleanData` → P2 (H6) |
| **P2 Detective Analyst** | PROMPT_2 | `backend/app/analysis/*` | P1 | `Case` → P3 (H8–12) |
| **P3 Backend & Integration** | PROMPT_3 | API, contract, export, deploy, glue | P1, P2 | API + `case.json` → P4, P5 |
| **P4 Front-end Game Lead** | PROMPT_4 | React shell, store, game pages | P3 contract | pages that host P5's charts |
| **P5 Visualisation Dev** | PROMPT_5 | D3 components + Map/Timeline/Network | P4 shell, P3 data | all charts |

Suggested fit: ETL/SQL → P1; strongest analytical/Python → P2; most full-stack → P3; strongest React/CSS → P4; most into D3/visuals → P5.

## What's in the data (summary)

- **4 files** in `data/raw/`: 163 students, 662 access logs (one day), 14 buildings (GPS, opening hours, lecture timetables in free-text descriptions), 25 interview statements.
- **Messy bits**: lowercase IDs, wrong IDs, location typo ("Queen Maragret Building"), societies as lists/sets/blanks, midnight-crossing times, lecture times only in prose, README subjects ≠ data, Physics doc time ≠ logs.

## Our reference answer (code must find it from rules, not names)

| | Student | Why they stand out |
|---|---|---|
| 1 | **Oscar Brown** | In two places at once, twice. Wrong ID in his statement. Refused to answer |
| 2 | **Alice Patterson** | Engineering student who skipped Engineering lecture but sat Computing. Overlapping logs |
| 3 | **Abdul Murphy** | Boyd Orr at **22:08**, after 21:00 closing. Statement names wrong places |
| 4 | **Eric Parkin** | Studies "Pharmacy" (no lecture on campus). Claims a society he isn't in |
| 5 | **Jonny Craig** | Logs under a fake ID. Left lecture early. Claims a building he never entered |
| 6 | **Stuart Wands** | Aged **17** in The Hive (18+). ID typed lowercase |
| 👑 | **Scott Johnston** | **Mastermind:** clean record, only student who met all six |
| 7? | Paul Butler | Weaker irregularity — "suspicious" |

## Pages in the app

Title (Start / **Judge mode**) → Briefing → **Evidence Room** → **Suspect Board** ⇄ Interrogation · HQ · Map · Timeline · Network → Accuse → Case Closed.

## Timeline (24 h)

| Time | Milestone |
|---|---|
| **H0–1** | P3 scaffolds `backend/` + contract. P4 scaffolds `frontend/` at repo root. Team reads data 20 min |
| **H6** | Checkpoint 1: P1 clean data ✅ · P4/P5 Board + first charts on sample data |
| **H12** | **Checkpoint 2:** real `case.json` in the UI (all 5 together) |
| **H18** | Feature freeze · polish · deploy |
| **H20** | Backup demo video |
| **H22–24** | Pitch rehearsal × 2 |

## Git rules

Branch `p<N>-<topic>` → small PRs into `main` · only edit files you own · pull `main` before each task ·
never relocate `data/raw/`, `docs/`, or `prompts/` · P3 merges at checkpoints and keeps `frontend/public/case.json` current.
