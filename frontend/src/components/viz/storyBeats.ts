import type { Case, Flag } from '../../types/case'
import { hhmm } from './util'

/** Cinematic narration for the current replay minute — no hard-coded names. */
export function storyBeatAt(
  c: Case | null,
  t: number,
  opts: { judgeMode: boolean; revealedFlagIds: Set<string> },
): { phase: string; line: string; urgency: 'calm' | 'tense' | 'hot' } {
  if (!c) {
    return { phase: 'CASE FILE', line: 'Loading the day…', urgency: 'calm' }
  }

  const tMin = c.meta.time_min
  const tMax = c.meta.time_max
  const day = c.meta.day_label

  let phase: string
  let base: string
  let urgency: 'calm' | 'tense' | 'hot' = 'calm'

  if (t < 600) {
    phase = 'MORNING'
    base = `${day}! Campus wakes — every swipe is a breadcrumb. Swing into the day…`
  } else if (t < 720) {
    phase = 'MID-MORNING'
    base = 'Lecture halls fill. Empty seats? Wrong subjects? Something’s off…'
  } else if (t < 960) {
    phase = 'AFTERNOON'
    base = 'Meetings overlap — alibis start to SNAP! Watch the web tighten.'
    urgency = 'tense'
  } else if (t < 1260) {
    phase = 'EVENING'
    base = 'Buildings close. Anyone still inside is writing their own villain origin…'
    urgency = 'tense'
  } else if (t < 1440) {
    phase = 'NIGHT'
    base = 'Lights thin out. Age-gated venues. Late swipes. Cue the drama!'
    urgency = 'hot'
  } else {
    phase = 'AFTER MIDNIGHT'
    base = 'Past midnight — the plot thickens. Who’s still on the trail?!'
    urgency = 'hot'
  }

  const visible = (f: Flag) =>
    opts.judgeMode || opts.revealedFlagIds.has(f.id)

  const near = c.flags
    .filter((f) => f.time != null && visible(f) && Math.abs((f.time as number) - t) <= 40)
    .sort(
      (a, b) =>
        Math.abs((a.time as number) - t) - Math.abs((b.time as number) - t),
    )

  if (near.length > 0) {
    const f = near[0]
    const place =
      c.buildings.find((b) => b.id === f.building_id)?.name ?? 'campus'
    return {
      phase,
      line: `${hhmm(f.time!)} · ${place} — ${f.title}`,
      urgency: 'hot',
    }
  }

  const progress = Math.max(0, Math.min(1, (t - tMin) / Math.max(1, tMax - tMin)))
  if (progress > 0.92) {
    return {
      phase: 'CLOSING ARGUMENT',
      line: 'Final panel! Find who met everyone — with a clean record. REVEAL!',
      urgency: 'hot',
    }
  }

  return { phase, line: base, urgency }
}

export function chapterMeta(id: 'map' | 'timeline' | 'network' | 'lab') {
  switch (id) {
    case 'map':
      return {
        roman: 'I',
        label: 'PLACE',
        title: 'Where it happened',
        how: 'Satellite campus. Buildings rise with traffic. Red glow = flags near now. Dots = people inside. Click a building for the dossier.',
      }
    case 'timeline':
      return {
        roman: 'II',
        label: 'TIME',
        title: 'The day unfolds',
        how: 'Rows are buildings; lines are people. Hatched = closed. Thick = lecture. Red × = flags. Brush to zoom; gold rings = meetings with the selected student.',
      }
    case 'network':
      return {
        roman: 'III',
        label: 'PEOPLE',
        title: 'Who met whom',
        how: 'Edges appear as meetings start. Filter to flagged + contacts. Reveal the clean-record hub that touched every conspirator.',
      }
    case 'lab':
      return {
        roman: '∞',
        label: 'LAB',
        title: 'Evidence bench',
        how: 'Acceptance harness for every chart P4 hosts — Clock, timeline, heatmap, rule bars.',
      }
  }
}
