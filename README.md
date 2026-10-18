# The Boyd Orr Burndown Conspiracy

GUTS / SAS hackathon case: find **6 conspirators** and **1 mastermind** in messy campus data — and ship a **creative visualisation**.

Repo: https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy

## Quick start

```bash
git clone https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy.git
cd boyd-orr-burndown-conspiracy
```

1. Review [`OWNERS.md`](OWNERS.md) before changing shared code.
2. Use [`docs/design_reference.png`](docs/design_reference.png) as the visual target.
3. Keep raw challenge files in `data/raw/` and coordinate cross-role changes with the owner.

| Role | Owns |
|------|------|
| P1 Data Engineer | `backend/app/pipeline/*` |
| P2 Detective Analyst | `backend/app/analysis/*` |
| P3 Backend & Integration | API, contract, export |
| P4 Front-end Game Lead | React shell, game pages |
| P5 Visualisation | D3 viz + Map/Timeline/Network |

## Repo layout

```
├── README.md / OWNERS.md
├── data/raw/                 challenge CSVs + statements
├── docs/                     design_reference.png + challenge-brief.pdf
├── backend/                  P3 glue · P1 pipeline · P2 analysis (stubs ready)
├── frontend/                 Vite app (P5 viz live; P4 game pages stubbed)
└── teamate/                  per-person worklogs and presentation materials
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

## Deploy on Vercel

The repository is configured as one Vercel project with two services: the frontend is public at `/`, and the FastAPI backend is public at `/api/*`.

1. Import this Git repository into Vercel and keep the project root set to `.` so it can read the root `vercel.json`.
2. In **Project Settings → Build and Deployment**, set the **Framework Preset** to **Services**. Vercel requires this setting as well as the `services` block in `vercel.json`.
3. Leave the service roots and build settings in `vercel.json`; do not add a top-level build command or output directory.
4. Deploy the project. The frontend calls the backend through same-origin `/api` URLs, so no API URL environment variable or service binding is required.

For local Vercel routing, install Python 3.12 and run `npx vercel dev -L` from the repository root. For a linked Vercel project, deploy with `npx vercel --prod`.

## Git

Branch `p<N>-<topic>` → small PRs into `main`. Pull `main` before each task.

Good luck — protect the Boyd Orr.
