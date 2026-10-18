# Batch 2: searchable student register

Date: 2026-10-18
Branch: P4-AMRIT

## Changes
- Added /register as the first stop after Start case, followed by the existing briefing.
- Listed students from the loaded case in ID order, with case-insensitive name and ID search.
- Added identity cards with individual reveal and hide controls, plus a global reveal toggle.
- Added result counts, no-results feedback, keyboard focus styling, accessible card labels, and reduced-motion support.
- Implemented the register using existing React and CSS dependencies so later investigation stages can be introduced separately.

## Validation
- npm.cmd run build: passed with the existing large bundle warning.
- npm.cmd run lint: passed with warnings in unchanged BoardPage and MapPage.
- Browser interaction and visual checks were not performed.

## Next step
Introduce the first evidence-filtering stage and connect it to the register after its data rules are checked.
