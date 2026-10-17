# Copy-paste messages for teammates

Send **one** of these to each person (WhatsApp / Discord / email).  
Repo: https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy

---

## Message for everyone (group chat)

```
Boyd Orr case repo is ready — clone this and work ONLY your role:

https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy

1) git clone https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy.git
2) Open the folder in Cursor / Claude Code / Copilot
3) Read prompts/00_START_HERE.md (5 min)
4) Paste YOUR prompts/PROMPT_N_….md into your AI agent (whole file)
5) Attach docs/design_reference.png if the tool accepts images
6) Only edit files you own (see OWNERS.md). Branch: pN-topic → PR to main

Do NOT push random stuff to main until we integrate. Keep a worklog under teamate/P{N}-YOURNAME/ like P5-PAWISH.

P5 (Pawish) already started the viz under frontend/ + teamate/P5-PAWISH/.
```

---

## P1 — Data Engineer

```
You’re P1 (Data Engineer).

Repo: https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy
Clone it, open in your AI coding agent, then paste the FULL file:
prompts/PROMPT_1_Data_Engineer.md

Tell the agent:
“Scan this repo. I am P1. Only edit backend/app/pipeline/* and backend/tests/test_pipeline.py. Raw data is in data/raw/. Fill the TODO stubs. Follow the prompt exactly. Create teamate/P1-<YOURNAME>/ and log each step like teamate/P5-PAWISH/.”

Attach docs/design_reference.png if useful. Do not touch frontend/ or analysis/.
```

---

## P2 — Detective Analyst

```
You’re P2 (Detective Analyst).

Repo: https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy
Clone it, open in your AI coding agent, then paste the FULL file:
prompts/PROMPT_2_Detective_Analyst.md

Tell the agent:
“Scan this repo. I am P2. Only edit backend/app/analysis/* and backend/tests/test_analysis.py. Wait for / build on P1’s CleanData. Fill TODO stubs. Follow the prompt. Create teamate/P2-<YOURNAME>/ and log each step like teamate/P5-PAWISH/.”

Do not edit pipeline/ or frontend/.
```

---

## P3 — Backend & Integration

```
You’re P3 (Backend & Integration Lead) — you own the contract + API.

Repo: https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy
Clone it, open in your AI coding agent, then paste the FULL file:
prompts/PROMPT_3_Backend_Lead.md

Tell the agent:
“Scan this repo. I am P3. Scaffold is already here. Implement models.py, config.py, main.py, export.py, tests/test_api.py, and keep frontend/src/types/case.ts + api/client.ts in sync. data/raw and docs are already on main — do not move them. Create teamate/P3-<YOURNAME>/ worklog. Follow Hour 0–1 in the prompt.”

Attach docs/design_reference.png.
```

---

## P4 — Front-end Game Lead

```
You’re P4 (Front-end Game Lead).

Repo: https://github.com/PawishrajhenAR/boyd-orr-burndown-conspiracy
Clone it, open in your AI coding agent, then paste the FULL file:
prompts/PROMPT_4_Front_end_Lead.md

Tell the agent:
“Scan this repo. I am P4. Vite app already exists under frontend/. P5 already built components/viz/* and Map/Timeline/Network pages — do not overwrite those. Own App shell, store, theme, content/story.ts, components/game/*, and game pages (Title, Briefing, Evidence, Board, Interrogation, HQ, Accuse, CaseClosed). Wire the router. Create teamate/P4-<YOURNAME>/ worklog. Match docs/design_reference.png.”

Attach docs/design_reference.png.
```

---

## Short “scan this repo” one-liner (any role)

```
Scan this GitHub repo, read prompts/00_START_HERE.md + OWNERS.md + my role prompt, then implement ONLY my owned files. Don’t push to main until I say so.
```
