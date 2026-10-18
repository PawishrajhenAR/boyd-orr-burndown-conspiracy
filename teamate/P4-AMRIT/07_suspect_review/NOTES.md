# Batch 4: suspect review and verdict evidence

Date: 2026-10-18
Branch: P4-AMRIT

## Changes
- Added /suspect-review after the first-sweep shortlist.
- Introduced score bars, a conspirator reveal stage, and a separate watch-list reveal.
- Used analysis ranks, scores, and verdicts directly; no fixed student names, six-person selection, or invented score threshold.
- Added selectable evidence panels with rule labels, severity, time, and links to existing student files.
- Connected the final stage to the existing map until the movement stage is ready.
- Kept all modifications in P4 frontend files and this worklog.

## Validation
- node.exe --test tests/shortlist.test.mjs tests/suspectReview.test.mjs: 4 tests passed.
- Tests cover contact ranking, sparse data, verdict preservation independent of score order, unranked contacts, and empty analysis.
- npm.cmd run build: passed with the existing large bundle warning.
- npm.cmd run lint: passed with existing warnings in BoardPage and MapPage.
- Browser visual and interaction checks remain outstanding.

## Next batch
Movement evidence and final results, using the existing case contract.
