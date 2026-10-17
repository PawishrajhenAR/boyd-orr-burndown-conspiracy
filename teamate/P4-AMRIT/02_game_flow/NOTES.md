# 02 — Case game UI

- Added P4 shared game components: panels, buttons, characters, polaroids, stamps, speech bubbles, sticky notes, and navigation rail.
- Built the P4 title, briefing, evidence, board, interrogation, HQ, accusation, and case-closed pages.
- Board Polaroids have the required `data-card-id` attribute so P5's RedStrings overlay can connect them.
- Mounted P5's existing `TimeSlider`, `RedStrings`, `DayTimeline`, `Clock24`, `FlagHeatmap`, `RuleBars`, `StorylineMini`, and `NetworkMini` in the P4-owned hosts.
- Used the shared sample Case data; no suspect identities or IDs are hard-coded in game logic.

Commit: `eb8cbb5` — `p4: build case game flow and shell`.
