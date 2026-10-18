# P5 Frontend & Visualisation — Speaker Guide

## The short version

> “I built the investigator-facing frontend: it turns the structured case into a guided, interactive experience. The main route walks through the register, evidence filters, suspect review, movement replay, and case closure. The map, timeline, and network pages let me explore the same evidence from the angles of place, time, and relationships.”

This guide reflects the frontend as it is currently implemented. The primary experience is the five-stage flow at `/`; the dedicated `/map`, `/timeline`, and `/network` pages are additional analysis views. In particular, the main flow’s movement replay is its own D3 chart, separate from the standalone timeline explorer.

## What I implemented

My P5 work is the frontend presentation and interactive visualisation layer. It loads the case contract, translates case records into screens and visual encodings, and lets an investigator move through the evidence without editing source data. The UI does not create the original logs or independently prove a conclusion: it presents the case data and analysis supplied to it so the investigator can inspect and compare them.

The core frontend experience combines:

- A case-file opening, character briefing, stage navigation, and animated transitions.
- A searchable, interactive student register and progressively narrowed evidence views.
- A D3 movement replay with play, rewind, scrubbing, and staged evidence reveals.
- A final case dossier with supporting contact evidence, anomalies, replay, and print actions.
- Separate map, timeline, and relationship-network pages for deeper exploration.

## The main experience: `/`

The root route is a guided investigation, not a collection of unrelated dashboard pages. It loads the case and presents five named stages. A progress bar lets the investigator jump between stages after the case is unlocked; scrolling snaps to stage-sized sections, and the left/right arrow keys also navigate. Dialogue, title cards, sound, and motion are used to make each step feel like part of one investigation.

### Opening the case

The opening screen presents a physical-looking case file with an investigator access form. This is a story device, not account security. After the file opens, the briefing scene introduces Inspector Mathew and PC Morag through typed dialogue, character expressions, camera emphasis, and sound cues. The briefing can be skipped; Space, Enter, or the right arrow advances dialogue, and Escape skips the scene. A mute control is available, and reduced-motion preferences are respected.

### Stage 1 — The Register

The register displays students from the loaded case. I can search by name or ID, flip individual identity cards, or flip the cards together. This gives the investigator a human-readable index before the evidence filters begin.

### Stage 2 — Level 1: first sweep

The first sweep visualises how the candidate set is formed. Students with rule-break evidence are distinguished from other students; contacts are ranked using recorded meetings with rule-breakers. The cards then gather into a shortlist, with a filter-basis panel showing the steps and counts behind the transition.

Selecting a student opens a file drawer containing that student's flags and meeting records. This makes the filter explainable: the investigator can inspect why a card appears instead of seeing an unexplained result. The shortlist limit is applied by the implemented selection logic; it is not a hand-entered list of names.

### Stage 3 — Level 2: suspect review

This stage presents the ranked suspicion scores and the evidence supporting the leading candidates. A threshold line makes the filter visible, while cards show score bars, selected flags, and the resulting suspect/watch-list state. A second filter-basis panel explains the ranking steps. Student cards open the same kind of evidence drawer, so the investigator can check the source flags and meetings.

### Stage 4 — Level 3: movement replay

The main movement chart is a responsive D3 SVG. Time runs horizontally and building locations form the rows. Each student's path shows their recorded visits; dots mark arrivals, and hatched regions indicate when a building was closed. It is a compact answer to “where was each shortlisted person during the day?”

The investigator can play forward, rewind, pause, or scrub to a specific time. The **Replay analysis** action animates the evidence in stages: rule-break visits are highlighted, the identified conspirators are emphasized, and the mastermind's first recorded meetings with them are revealed in time order. A meeting counter shows how many relevant contacts have appeared by the current replay time. The reveal is derived from the case records; the movement chart does not make up meetings.

The chart resizes with its container. Resizing redraws the view from the data and current reveal state, so the analysis does not depend on a fixed screen size. When the day is rewound and replayed, the dialogue acknowledges the replay.

### Stage 5 — Case closed

The final screen brings the finding and its supporting contacts together. The mastermind is connected visually to the identified conspirators; available meeting details show where and when the recorded contact occurred. A verdict and method summary explain how the case was narrowed, while other recorded oddities can be expanded. The investigator can replay the case or print a clean case dossier.

The final contact count comes from the available meeting records. When explaining it, point to the displayed number and supporting contact details rather than memorising a claim that may not match another case file.

## The dedicated visualisation pages

These are separate routes alongside the main narrative. They use the same structured case data but provide more direct exploratory controls.

### `/map` — place

The campus map uses MapLibre GL and satellite tiles. Building footprints are drawn from case coordinates; their visual size reflects recorded visit volume. At the selected replay time, the map shows current occupants. Selecting a building opens its opening information, lectures, occupants, and nearby flags. Selecting a student can trace their visits.

If the interactive map cannot initialise, a campus schematic fallback keeps the locations and selection interactions usable. The satellite layer displays its imagery attribution. The legend distinguishes buildings, flagged places, and verdict categories.

**Explain it this way:** “The map answers where. I can choose a time and inspect who was in a building, then follow one student's route.”

### `/timeline` — time

This standalone D3 timeline uses buildings as rows and time as the horizontal axis. Student movement paths make it easier to compare the day across people. Filters switch between all students, flagged students, or the selected student's contacts. Selecting a path focuses that student; dragging across the chart brushes into a time window. The view adds context such as closed hours, lecture visits, flags, and meetings.

This page is distinct from the narrated movement replay on `/`: the standalone timeline is an exploratory chart with filters and a brush, while the root flow's movement chart is an animated, step-by-step evidence reveal with play and rewind.

**Explain it this way:** “The timeline answers when. It lets me compare movement paths with schedules and evidence, and zoom in on a time range.”

### `/network` — relationships

The network page uses a D3 force-directed graph. A student node is connected to another student when a meeting record matches the current duration filter. Optional place nodes show where those meetings happened. The graph's layout helps reveal clusters; the node positions themselves are not evidence.

Controls adjust the minimum meeting duration, show or hide places, limit the graph to flagged people and their contacts, search for a student, and zoom or fit the graph. Selecting a student opens their profile, flags, meetings, and societies. Replay time filters which meeting links are visible without restarting the force layout, so the graph remains stable while the investigator moves through the day.

**Explain it this way:** “The network answers who met whom. It helps me find connections, then I check the actual time and place in the details panel.”

## How the frontend is put together

1. **Load:** the UI requests a typed case from `/api/case`, then tries an exported case file and a sample file as fallbacks.
2. **Prepare the view:** React components select the relevant students, flags, visits, buildings, and meetings from the case object.
3. **Draw the interaction:** React and Framer Motion handle the staged interface; D3 draws the movement and timeline charts and the force-directed graph; MapLibre renders the campus map.
4. **Keep controls coherent:** the dedicated map, timeline, and network routes share case and replay-time state through Zustand. The main narrative movement chart keeps its own playback state so its scripted replay can run independently.

The pages are responsive and observe their container size. The main route is loaded separately from the older/direct analysis pages, which are lazy-loaded by the router. This avoids downloading every page before the investigator needs it.

## Technology in plain language

- **React + TypeScript:** build the pages and describe the shape of the case data.
- **D3:** map data to marks, scales, axes, and interactive graph layouts.
- **MapLibre GL:** render and interact with the campus map; a schematic fallback remains available.
- **Zustand:** share selections and replay time across the standalone analysis views.
- **Framer Motion:** animate the case-file story and interactive transitions.
- **Howler:** play optional interface sound effects, with a visible mute control.

## A current demo path (about 90 seconds)

1. Open `/` and introduce the idea: “This is a guided way to inspect the case, rather than a static report.” Use the credentials shown on the case-file screen; they are a story gate, not real security.
2. Let the file open and show the briefing, or skip the scene to save time.
3. On **The Register**, search or flip a card, then begin the investigation.
4. On **Level 1**, point to the rule-breaker/contact distinction and the filter-basis panel. Open one student file to show supporting flags and meetings.
5. On **Level 2**, point to the score bar and threshold, then move on to the movement stage.
6. On **Movement**, run the analysis, scrub or rewind, and point out the building rows, time axis, closed-hours hatching, and meeting counter.
7. On **Case closed**, show the contact evidence and printable dossier. If time allows, finish with `/map`, `/timeline`, or `/network` to show a complementary exploratory view.

## Questions and answers

### What did you build for P5?

**Answer to say:** “I built the frontend presentation and visualisation layer: the guided five-stage investigation, its interactive evidence views, and the map, timeline, and network tools. I focused on making the case data understandable and explorable.”

### What is the main user journey?

**Answer to say:** “The main route moves from the register, through the first evidence filter and suspect review, into a movement replay, and ends with a case dossier. Each stage gives context for the next one.”

### Why are there two timeline-style views?

**Answer to say:** “The movement chart in the main story is a guided replay: it animates the evidence reveal and supports play, rewind, and scrubbing. The separate timeline page is an analysis tool with student filters and a brush for focusing on a time range.”

### What does the movement chart show?

**Answer to say:** “Time runs across the chart and buildings run down it. The paths show recorded visits; arrival dots, building opening hours, rule-break visits, and meeting markers add evidence context.”

### Does the network graph prove a conspiracy?

**Answer to say:** “No. A link means the case contains a meeting record that passes the current filter. The layout helps me explore connections, but I use the time, place, flags, and other records to evaluate what that connection means.”

### How do you avoid making up evidence in the frontend?

**Answer to say:** “The UI uses the structured case data it loads. The visualisations transform those records into paths, nodes, and labels, but the underlying meeting and visit details remain inspectable. I describe what the displayed data supports and avoid turning a visual pattern into proof by itself.”

### Why use D3 instead of only standard charts?

**Answer to say:** “The movement paths and relationship network need custom interactions and layouts. D3 gives me control over how the data maps to chart positions and how users explore it; React still handles the surrounding interface.”

### What happens if the map tiles fail?

**Answer to say:** “The map has a campus schematic fallback. It keeps the important building and selection interactions available even if the satellite map cannot initialise.”

### How does the interface handle different screens and motion preferences?

**Answer to say:** “The visualisations observe their container size and redraw responsively. The guided flow checks the reduced-motion preference, and the investigator can mute sound.”

### What would you improve next?

**Answer to say:** “I would keep testing the visual hierarchy with users, improve keyboard and screen-reader support across every chart interaction, and add more ways to move directly from a selected map or timeline item to its supporting evidence.”

## If you remember only one answer

> “My frontend makes the case explorable. The main route guides the investigator from the register to a data-backed movement replay and final dossier. The map, timeline, and network give additional views of place, time, and relationships. I use them to make evidence easier to inspect, not to replace checking the records.”
