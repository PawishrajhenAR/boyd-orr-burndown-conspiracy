# H6 — run_pipeline ready for P2

`main` now includes:
- Full `run_pipeline()` → CleanData (P1)
- P2 analysis from `Shraddha_Analytics`

Verified locally: `pytest tests/test_pipeline.py tests/test_analysis.py` → **36 passed** (including all 6 `test_real_*` acceptance tests).

## CleanData guarantees
- IDs uppercased (`id_format` issues where casing changed)
- `2912324G` → Jonny `2712324G`; `2656431B` → Oscar `2456431B` (by name)
- `Queen Maragret Building` → Queen Margaret Union
- Physics lecture inferred **540–600** (`source="inferred"`)
- Aliases include kelvingrove, kg, park, boydy, hive, medicine building, qmu, guu, the union → both unions; **no** bare `kelvin`
