# Network page — who met whom

**Who:** Pawish  

## What was built

| Path | Role |
|------|------|
| `frontend/src/pages/NetworkPage.tsx` | Dark link-analysis force graph (default export) |
| `frontend/src/components/viz/util.ts` | `hhmm`, `verdictColor`, network colour tokens |
| `frontend/src/components/viz/TimeSlider.tsx` | Stub slider (store-wired); full polish later |

## Behaviour

- Background `#0b1020`; `d3.forceSimulation` + `d3.zoom`
- Nodes = students; optional building nodes via **Show places**
- Edges = meetings with `start ≤ replayTime` and `minutes ≥` min-minutes (default 1)
- Default filter: flagged (conspirator / suspicious / mastermind) + their contacts
- Node colours: conspirators `#ff4d5e`, mastermind `#ffd166`, others teal ring `#2ec4b6`, buildings `#9b5de5`
- Edge hover: `met at {building} {hhmm}`
- Controls: search (centre node), zoom +/− / fit, min-minutes, show-places, flagged filter
- Labelled rounded **Conspirators** group box
- **Reveal mastermind**: jumps replay to `time_max`, pins mastermind to centre, gold edges to conspirators they met, caption `Clean record · met N/N` (from case verdicts — not hard-coded names)
- Right panel: collapsible Profile / Flags / Meetings / Societies
- `TimeSlider` at bottom; title + how-to-read caption

## Performance

- `useMemo` builds topology from `minMinutes` / flagged / show-places
- Force simulation reheats only when topology key changes — **not** on every `replayTime` tick
- Replay time only toggles link `display` / gold styling via a lightweight applicator

## Acceptance

On sample/real case data: Reveal selects the mastermind verdict (Scott Johnston `2453876J` in the challenge set) and shows gold links to all 6 conspirators listed in `conspirators_met` / `meeting_ids_with_conspirators`.

## Run

```bash
cd frontend && npm run dev
# open /network
```
