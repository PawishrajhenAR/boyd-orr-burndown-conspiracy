# File ownership (do not edit outside your role)

| Path | Owner |
|------|-------|
| `data/raw/` | shared (read-only) |
| `docs/` | shared (read-only) |
| `prompts/` | shared (read-only) |
| `backend/app/pipeline/` + `tests/test_pipeline.py` | **P1** |
| `backend/app/analysis/` + `tests/test_analysis.py` | **P2** |
| `backend/app/main.py`, `models.py`, `config.py`, `export.py`, `requirements.txt`, `tests/test_api.py` | **P3** |
| `frontend/src/types/case.ts`, `frontend/src/api/client.ts`, `frontend/public/case.sample.json` | **P3** |
| `frontend/` shell: App, store, theme, content, `components/game/`, game pages | **P4** |
| `frontend/src/components/viz/`, Map/Timeline/Network pages | **P5** (Pawish — see `teamate/P5-PAWISH/`) |
| `teamate/P*-NAME/` | each person's local worklog |

Branch: `p<N>-<topic>` → PR into `main`.
