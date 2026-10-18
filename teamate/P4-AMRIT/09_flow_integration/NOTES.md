# Batch 6: complete investigation flow

Date: 2026-10-18
Branch: P4-AMRIT

## Delivered
- Made the complete investigation flow the home route: envelope story gate, register, first sweep, suspect review, movement analysis, and final results.
- Added animated identity cards, dialogue between Morag and Ember, chapter transitions, scroll navigation, progress controls, judge mode (?judge=1), replay, and printable case summary.
- Added Howler sound effects with mute persistence, gesture-based audio unlocking, rate limiting, and source credits in public/sfx/CREDITS.md.
- Added Tailwind and Framer Motion integration and retained the earlier incremental routes, plus /classic for the old title page.
- Loaded legacy styling only on legacy routes to prevent typography and style conflicts. Avoided duplicate legacy audio handling on the home flow.
- Added phone results scrolling and adaptive movement-axis labels, and derived the mastermind flag summary from case evidence.
- Retained all P3 data/API and P5 visualization files unchanged. The current bundled case has 9 students, while the reference workspace has a larger case; matching datasets requires a separate P3 export.

## Verification
- npm.cmd test: 11 logic tests passed, covering shortlist ranking, sparse data, verdict preservation, midnight intervals, meeting links, and data-driven dialogue.
- npm.cmd run build: passed; large bundle warning remains.
- npm.cmd run lint: passed with warnings in flow effects/exports and existing BoardPage/MapPage components.
- npm.cmd run e2e: Edge smoke coverage at 1280x800 and 390x844 with API failure forced to exercise bundled fallback. Covers invalid/valid envelope input, search, all five stages, movement scrub/analysis, replay, mute persistence, judge mode, horizontal overflow, and runtime errors.
- Screenshots saved locally under frontend/artifacts/flow (ignored by Git); desktop and phone screenshots inspected.
- npm audit reports an existing critical maplibre-gl advisory GHSA-jrc7-96c5-q579. The offered fix upgrades v4 to v6; deferred because it needs separate map compatibility validation.

## Running
From frontend: npm.cmd run dev. Open http://127.0.0.1:5173/ (story credentials are printed on the envelope), or /?judge=1 for direct review. With the server running, npm.cmd run e2e uses installed Microsoft Edge. npm.cmd test runs the logic tests.

## Scope status
The six planned frontend batches are implemented. This is not whole-repository equivalence: API, dataset exports, backend differences, and P5 visualization styling are outside this P4 batch. Prior incremental pages remain available for compatibility.
