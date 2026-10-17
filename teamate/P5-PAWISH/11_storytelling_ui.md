# 11 — Storytelling UI polish (pre–P2 live data)

Date: 2026-10-17

## Direction
Cork-noir **case file** chapters on top of the existing P4 shell — judges get a narrative beat that
changes with `replayTime`, not a static dashboard caption.

## Added (P5 only)
- `StoryChapter` + `storyBeats.ts` + `viz-story.css` — chapters I PLACE / II TIME / III PEOPLE / ∞ LAB
- Live phase line (MORNING → AFTER MIDNIGHT) + nearest revealed flag headline
- Cinematic `TimeSlider` (elapsed fill, play glow, beat caption under the track)
- Map / Timeline / Network / Lab wired to StoryChapter; map dossier stamp; network reveal caption
- RedStrings glow filter on hot conspirator links (still non-blocking for clicks)

## Out of scope
- P4 shell / Title / Board layout (OWNERS)
- Waiting on P2 analysis upload — sample case stays the source of truth until main updates
