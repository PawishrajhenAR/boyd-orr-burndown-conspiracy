# Batch 1: align the shared theme with SaSProject

Date: 2026-10-18
Branch: P4-AMRIT

## Comparison and scope
SaSProject includes a dark-and-amber shared theme, visualization changes, and a newer investigation flow with its own stylesheet and routing. This first batch copies only P4 shared styling, theme tokens, and the title-page cleanup. The current game routes stay available for incremental migration.

## Changes
- frontend/src/index.css: dark surfaces, amber accents, green success states, typography, shared cards and controls, and responsive layouts from SaSProject.
- frontend/src/theme/tokens.ts: matching dark-theme design tokens.
- frontend/src/pages/TitlePage.tsx: readable component layout and title copy matching SaSProject.

## Validation
- npm.cmd run build: passed (large bundle warning).
- npm.cmd run lint: passed with warnings in unchanged BoardPage and MapPage.
- No browser visual verification performed.

## Next batches
- Introduce the new investigation flow in coherent working stages.
- Integrate flow routing and sound assets when their dependencies are ready.
- Coordinate P5 visualization changes and P3 API changes with their owners.

SaSProject was read only. The existing untracked local workspace file was excluded from this commit.
