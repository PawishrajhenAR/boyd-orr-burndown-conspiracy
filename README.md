# The Boyd Orr Burndown Conspiracy

GUTS / SAS hackathon case: find **6 conspirators** and **1 mastermind** in messy campus security data — and ship a **creative visualisation** (that’s what scores).

## Quick start (humans + AI agents)

```bash
git clone https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy.git
cd boyd-orr-burndown-conspiracy
```

1. Read [`prompts/00_START_HERE.md`](prompts/00_START_HERE.md) (5 minutes).
2. Pick your role prompt and paste the **whole file** into your AI coding agent (Cursor, Claude Code, Copilot, etc.) **with this repo as the workspace**.
3. Attach [`docs/design_reference.png`](docs/design_reference.png) if your tool accepts images.

| Role | Prompt | Owns |
|------|--------|------|
| P1 Data Engineer | [`prompts/PROMPT_1_Data_Engineer.md`](prompts/PROMPT_1_Data_Engineer.md) | `backend/app/pipeline/*` |
| P2 Detective Analyst | [`prompts/PROMPT_2_Detective_Analyst.md`](prompts/PROMPT_2_Detective_Analyst.md) | `backend/app/analysis/*` |
| P3 Backend & Integration | [`prompts/PROMPT_3_Backend_Lead.md`](prompts/PROMPT_3_Backend_Lead.md) | API, contract, deploy, glue |
| P4 Front-end Game Lead | [`prompts/PROMPT_4_Front_end_Lead.md`](prompts/PROMPT_4_Front_end_Lead.md) | React shell, pages, store |
| P5 Visualisation Dev | [`prompts/PROMPT_5_Visualisation_Developer.md`](prompts/PROMPT_5_Visualisation_Developer.md) | D3 charts (map / timeline / network) |

AI agents: also read [`AGENTS.md`](AGENTS.md).

## Repo layout

```
├── README.md                 ← you are here
├── AGENTS.md                 ← rules for AI coding agents
├── data/raw/                 ← challenge CSVs + statements (do not invent extra raw files)
│   ├── people_data.csv
│   ├── location_data.csv
│   ├── security_logs.csv
│   └── student_statements.txt
├── docs/
│   ├── design_reference.png  ← UI look (corkboard detective game)
│   └── challenge-brief.pdf   ← official organiser brief
├── prompts/                  ← paste these into your AI agent
├── frontend/                 ← Vite app (P5 viz: /map /timeline /network)
├── Pawish/                   ← P5 worklog (prompt + step notes)
└── backend/                  ← created by P3 during the hack
```

### Run the viz (P5 local)

```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173/ — Map, Timeline, Network.

## Data (summary)

| File | What it is |
|------|------------|
| `data/raw/people_data.csv` | 163 student profiles |
| `data/raw/location_data.csv` | 14 buildings (GPS, hours, lecture text in descriptions) |
| `data/raw/security_logs.csv` | 662 access logs for one day |
| `data/raw/student_statements.txt` | 25 interview testimonies |

**Game rules:** students attend their mandatory lecture once; no out-of-hours building access; the mastermind’s day looks clean except they met every conspirator.

## Stack (target)

Python 3.11 + pandas + NetworkX → FastAPI + Pydantic → React + Vite + TypeScript + Tailwind + Zustand + Framer Motion + D3.

## Git (short)

- Branch `p<N>-<topic>` → small PRs into `main`
- Only edit files your role owns (see your prompt §5)
- Pull `main` before each task

Good luck — protect the Boyd Orr.
