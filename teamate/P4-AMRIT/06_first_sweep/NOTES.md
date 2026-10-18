# Batch 3: first evidence sweep

Date: 2026-10-18
Branch: P4-AMRIT

- Added /first-sweep after the register, with Everyone, Rule breaks, Close contacts, and Shortlist stages.
- Retained all positive-score students, then ranked contacts by distinct rule-breakers met, total meeting minutes, and name. The 25-student target adapts to available evidence.
- Added student evidence panels showing flags and contact statistics without declaring contacts guilty.
- Continued to the existing briefing pending the next investigation stage.
- Kept changes within P4 frontend ownership; no case data or API edits.

Validation: node.exe --test tests/shortlist.test.mjs (2 passed), npm.cmd run build (passed; bundle-size warning), npm.cmd run lint (passed; existing BoardPage and MapPage warnings). Browser checks not performed.

The bundled case is smaller than the reference workspace case, so tests cover sparse data, retained rule-breakers, duplicate meetings, contact ordering, and shortlist limits instead of fixed student counts.
