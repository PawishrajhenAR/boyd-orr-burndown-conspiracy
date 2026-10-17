# Boyd Orr Case: Team Pack (read this first, 5 minutes)

## How to use this pack

1. Clone **this** repo (`boyd-orr-burndown-conspiracy`). Raw data is already in `data/raw/`. Design ref is in `docs/`.
2. Open your AI coding assistant **with this repo as the workspace**.
3. Paste **your own** prompt file from this folder (`PROMPT_1` … `PROMPT_5`) in full.
4. Attach [`docs/design_reference.png`](../docs/design_reference.png) if your tool accepts images.
5. Every prompt shares the same **Shared Context** (data facts, contract, ownership, design). If the contract changes, **P3** updates `models.py` + `case.ts` and tells everyone — don’t edit the shared section alone.

| Person | Prompt | Owns | Needs from | Gives to |
|---|---|---|---|---|
| **P1 Data Engineer** | PROMPT_1 | `backend/app/pipeline/*` | raw files | `CleanData` → P2 (H6) |
| **P2 Detective Analyst** | PROMPT_2 | `backend/app/analysis/*` | P1 | `Case` → P3 (H8–12) |
| **P3 Backend & Integration** | PROMPT_3 | repo glue, contract, FastAPI, export, deploy, pitch | P1, P2 | API + `case.json` → P4, P5 |
| **P4 Front-end Game Lead** | PROMPT_4 | React shell, store, game pages | P3 contract | pages that host P5's charts |
| **P5 Visualisation Dev** | PROMPT_5 | D3 components + Map/Timeline/Network pages | P4 shell, P3 data | all charts |

Suggested fit: ETL/SQL → P1; strongest analytical/Python → P2; most full-stack → P3; strongest React/CSS → P4; most into D3/visuals → P5.

## What's in the data (summary)

- **4 files** in `data/raw/`: 163 students, 662 access logs (one day), 14 buildings (GPS, opening hours, lecture timetables in free-text descriptions), 25 interview statements.
- **Messy bits** (the “gross CSV” part of the brief): lowercase IDs, IDs that don’t exist (2 people filed under the wrong ID), a location typo ("Queen Maragret Building"), societies stored as Python lists *and* sets *and* blanks, times crossing midnight, lecture times only in prose, the README’s subject list not matching the data, and the documented Physics time not matching the logs.

## Our reference answer (the code must find it from rules, not names)

| | Student | Why they stand out |
|---|---|---|
| 1 | **Oscar Brown** | In two places at once, twice. Wrong ID in his statement. Refused to answer |
| 2 | **Alice Patterson** | Engineering student who skipped the Engineering lecture but sat in the Computing lecture. Overlapping logs |
| 3 | **Abdul Murphy** | Boyd Orr at **22:08**, after its 21:00 closing. Statement names the wrong places |
| 4 | **Eric Parkin** | Studies "Pharmacy", a course with no lecture on campus. Claims a society he isn't in |
| 5 | **Jonny Craig** | Logs filed under a fake ID. Left his lecture early. Claims a building he never entered |
| 6 | **Stuart Wands** | Aged **17** in The Hive (strictly 18+). ID typed in lowercase |
| 👑 | **Scott Johnston** | **Mastermind:** perfectly clean record, but the **only** student who met all six (park 07:55 → Boyd Orr 10:00 → Library 17:03 → Hive 22:31) |
| 7? | Paul Butler | Weaker irregularity (park overlaps his lecture), so "suspicious" |

## Pages in the app

Title (Start / **Judge mode**) → Briefing (PC Morag) → **Evidence Room** (messy → clean) → **Suspect Board** (hub, the mockup) ⇄ **Interrogation** (Lecture · Hours · Alibi · Profile checks) · **HQ dashboard** · **Map** · **Timeline** (storyline) · **Network** (link-analysis reveal) → **Accuse** → **Case Closed** (newspaper + oddities).

## Timeline (24 h)

| Time | Milestone |
|---|---|
| **H0–1** | P3 scaffolds `backend/` + contract + `case.sample.json`. P4 scaffolds app shell. Everyone reads the data together for 20 minutes |
| **H6** | Checkpoint 1: P1 clean data ✅, P4/P5 Board + first charts on sample data |
| **H12** | **Checkpoint 2 (most important):** real `case.json` flowing into the UI, with all 5 sitting together |
| **H18** | Checkpoint 3: feature freeze, polish and bug fixes only. Deploy |
| **H20** | Backup demo video recorded |
| **H22–24** | Pitch rehearsal × 2 |

## Git rules (short version)

Branch `p<N>-<topic>` → small PRs into `main` · only edit files you own · pull `main` before each task ·
P3 merges at checkpoints and keeps `frontend/public/case.json` up to date.
