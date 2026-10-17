# The Boyd Orr Burndown Conspiracy

GUTS / SAS hackathon case: find **6 conspirators** and **1 mastermind** in messy campus data — and ship a **creative visualisation**.

Repo: https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy

Local folder should be named **`boyd-orr-burndown-conspiracy`** (same as GitHub).  
If yours is still `SaSProject`, run once in a normal terminal (not inside this chat):

```bash
mv ~/Projects/SaSProject ~/Projects/boyd-orr-burndown-conspiracy
# then reopen Cursor on that folder (or the .code-workspace file)
```

## Quick start

```bash
git clone https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy.git
cd boyd-orr-burndown-conspiracy
```

1. Read [`prompts/00_START_HERE.md`](prompts/00_START_HERE.md) (5 minutes).
2. Paste **your** role prompt into your AI agent (whole file).
3. Attach [`docs/design_reference.png`](docs/design_reference.png) if the tool accepts images.
4. Only edit files you own — see [`OWNERS.md`](OWNERS.md).
5. Messages to send teammates: [`prompts/SEND_TO_TEAMMATES.md`](prompts/SEND_TO_TEAMMATES.md).

| Role | Prompt | Owns |
|------|--------|------|
| P1 Data Engineer | [`prompts/PROMPT_1_Data_Engineer.md`](prompts/PROMPT_1_Data_Engineer.md) | `backend/app/pipeline/*` |
| P2 Detective Analyst | [`prompts/PROMPT_2_Detective_Analyst.md`](prompts/PROMPT_2_Detective_Analyst.md) | `backend/app/analysis/*` |
| P3 Backend & Integration | [`prompts/PROMPT_3_Backend_Lead.md`](prompts/PROMPT_3_Backend_Lead.md) | API, contract, export |
| P4 Front-end Game Lead | [`prompts/PROMPT_4_Front_end_Lead.md`](prompts/PROMPT_4_Front_end_Lead.md) | React shell, game pages |
| P5 Visualisation | [`prompts/PROMPT_5_Visualisation_Developer.md`](prompts/PROMPT_5_Visualisation_Developer.md) | D3 viz + Map/Timeline/Network |

## Repo layout (matches the prompts)

```
├── README.md / AGENTS.md / OWNERS.md
├── prompts/                  role prompts + SEND_TO_TEAMMATES.md
├── data/raw/                 challenge CSVs + statements
├── docs/                     design_reference.png + challenge-brief.pdf
├── backend/                  P3 glue · P1 pipeline · P2 analysis (stubs ready)
├── frontend/                 Vite app (P5 viz live; P4 game pages stubbed)
└── teamate/                  per-person worklogs (P5-PAWISH done)
```

### Run viz (P5)

```bash
cd frontend && npm install && npm run dev
```

Open http://localhost:5173/ — Map · Timeline · Network.

### Backend (when P3 fills stubs)

```bash
cd backend && pip install -r requirements.txt
# uvicorn app.main:app --reload --port 8000
```

## Git

Branch `p<N>-<topic>` → small PRs into `main`. Pull `main` before each task.

Good luck — protect the Boyd Orr.
