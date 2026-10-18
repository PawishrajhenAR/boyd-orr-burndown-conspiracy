# Case File #1105: The Boyd Orr Burndown Conspiracy

An interactive, data-driven investigation into a fictional campus mystery. Explore movement records, statements, security logs, and connections between people to reconstruct what happened at Boyd Orr Hall.

## Contents

- [The investigation](#the-investigation)
- [Highlights](#highlights)
- [Technology](#technology)
- [Run locally](#run-locally)
- [Run checks](#run-checks)
- [API](#api)
- [Project files](#project-files)

## The investigation

Start with the case overview, then follow the evidence through an interactive investigation. Review the timeline and map, compare accounts with recorded movements, inspect relationships, and examine the evidence before reaching a conclusion.

The case is built from the supplied CSV and text records. The backend prepares the case data and exposes it through an API; the frontend presents the investigation as a guided, interactive experience.

## Highlights

- Case overview and guided investigation flow
- Interactive movement map, timeline, and relationship network
- Evidence, student statements, and building details
- Data-driven case analysis rather than a manually authored answer
- Responsive interface with animated transitions and optional sound effects

## Technology

| Area | Tools |
| --- | --- |
| Frontend | React, TypeScript, Vite |
| Visualisation | D3, MapLibre/Leaflet |
| UI state and motion | Zustand, Framer Motion |
| Backend | Python, FastAPI, Pydantic |
| Data analysis | pandas, NumPy, NetworkX |

## Run locally

### Prerequisites

- Node.js `20.19+` or `22.12+`, with npm
- Python `3.12+`
- Git

### 1. Get the project

```bash
git clone <repository-url>
cd SaSProject
```

Replace `<repository-url>` with the URL of your GitHub repository.

### 2. Install and start the backend

In a terminal from the repository root:

```bash
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

On Windows PowerShell, activate the virtual environment with:

```powershell
.venv\Scripts\Activate.ps1
```

Keep this terminal running. The API is available at `http://127.0.0.1:8000`; interactive API documentation is at `http://127.0.0.1:8000/docs`.

### 3. Install and start the frontend

Open a second terminal from the repository root:

```bash
cd frontend
npm ci
npm run dev -- --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/` in your browser. The Vite development server forwards `/api` requests to the local backend.

### Data and case loading

The backend reads the challenge inputs from `data/raw/` at the repository root:

```text
data/raw/
├── people_data.csv
├── location_data.csv
├── security_logs.csv
└── student_statements.txt
```

The frontend requests the case from `/api/case`. If the API is unavailable, it can use an exported `case.json` or the included sample case so the interface can still be explored.

## Run checks

Run frontend checks from `frontend/`:

```bash
npm test
npm run lint
npm run build
```

Run the browser end-to-end suite with:

```bash
npm run e2e
```

Run backend tests from `backend/` if the test dependencies are installed:

```bash
python -m pytest
```

## API

The FastAPI service provides endpoints for case data, health checks, student and building details, meetings, uploads, and configuration. Browse the interactive endpoint list at `http://127.0.0.1:8000/docs` while the backend is running.

## Project files

```text
backend/       FastAPI service and data processing
data/raw/      Original case input files
docs/          Project brief, visual reference, and documentation assets
frontend/      React application and visualisations
```

---

<p align="center">
  <img src="docs/team29-thank-you.svg" alt="Thank you, from Team 29, with a heart" width="720">
</p>
