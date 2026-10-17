# Guidance for AI coding agents

This repo is a **5-person hackathon build**. Each human pastes **one role prompt** from `prompts/` into their agent. Follow that prompt and this file.

## Before you write code

1. Read `prompts/00_START_HERE.md`.
2. Confirm which role you are helping (P1–P5) and open **only** that `prompts/PROMPT_*.md`.
3. Restate ownership: only create/edit files listed for that role. If another area must change, draft a short message for that teammate instead of editing their files.
4. Attach or open `docs/design_reference.png` for UI work (P4 / P5).

## Source of truth

| Thing | Location |
|-------|----------|
| Raw challenge data | `data/raw/*` only |
| UI visual target | `docs/design_reference.png` |
| Official brief | `docs/challenge-brief.pdf` |
| Shared API / Case contract | Owned by **P3** (`backend/app/models.py` + `frontend/src/types/case.ts` once created) |
| Role instructions | `prompts/PROMPT_N_*.md` (shared context sections must stay identical across roles) |

## Hard rules

- **Do not hard-code** conspirator / mastermind names or IDs in analysis logic — derive flags from rules (names OK in tests only).
- **Do not invent** extra raw CSVs or “fix” the dataset by hand outside the pipeline’s quality report.
- Prefer small commits on `p<N>-<topic>` branches with clear messages.
- Times in the contract are **minutes from midnight** (integers). Match field names in the prompt’s data contract exactly.
- Until `backend/` / `frontend/` exist, P3 scaffolds them first; other roles wait on that skeleton if their paths are missing.

## Suggested first reply pattern

When a human pastes their prompt, start by:

1. Five bullets: what you will build + which paths you own  
2. A short step plan for the next 1–2 hours of their timeline  
3. Then implement the first step only
