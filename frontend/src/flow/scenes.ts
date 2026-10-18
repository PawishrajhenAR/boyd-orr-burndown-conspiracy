import type { Case } from '../types/case'
// `.ts` extension so `node --test` can load this file directly (Vite accepts it too).
import type { Expression, Speaker } from './dialogue.ts'

/**
 * Story scenes: an ordered run of lines. Every line sets BOTH characters' expressions on purpose —
 * the speaker's delivery and the listener's reaction.
 */
export interface SceneLine {
  speaker: Speaker
  text: string
  mathew: Expression<'mathew'>
  morag: Expression<'morag'>
  /** A reveal: aura brightens, speed lines, camera shake, sting. */
  impact?: boolean
  /** Slow camera push-in on the speaker. */
  camera?: boolean
}

export interface Scene {
  id: string
  location: string
  lines: SceneLine[]
}

const BRIEFING: Scene = {
  id: 'briefing',
  location: 'Campus Security HQ · Case File #1105 · {day}',
  lines: [
    { speaker: 'morag', mathew: 'focus', morag: 'salute', text: 'Inspector Mathew. PC Morag, campus security. Thanks for coming in this late.' },
    { speaker: 'mathew', mathew: 'examining', morag: 'neutral', text: 'The tip says fireworks. Inside the Boyd Orr Building, on Bonfire Night.' },
    { speaker: 'morag', mathew: 'focus', morag: 'worried', text: 'All we have is one day of data: {visits} door swipes, {students} students, {statements} statements.' },
    { speaker: 'mathew', mathew: 'thinking', morag: 'curious', camera: true, text: 'Somebody planned this, and they are in that data. We start with the rules.' },
    { speaker: 'mathew', mathew: 'explaining', morag: 'curious', text: 'Rule-breakers leave marks: {flags} flags in the logs, and {lies} statements already contradict the door swipes.' },
    { speaker: 'morag', mathew: 'suspicious', morag: 'sceptical', text: 'And someone careful enough to keep their own record clean?' },
    { speaker: 'mathew', mathew: 'aha', morag: 'surprised', impact: true, text: 'A planner with a clean record still has to meet their team. Somewhere. At some time.' },
    { speaker: 'mathew', mathew: 'determined', morag: 'pointing', text: 'So we map every meeting. Every swipe, every room, every overlap.' },
    { speaker: 'morag', mathew: 'determined', morag: 'relieved', text: 'Then we open the register and start the first sweep.' },
    { speaker: 'mathew', mathew: 'determined', morag: 'salute', impact: true, text: 'Bring me everyone on file, Morag. Tonight, nobody hides.' },
  ],
}

export interface SceneVars {
  day: string
  students: number
  visits: number
  buildings: number
  statements: number
  flags: number
  lies: number
}

export function sceneVars(c: Case): SceneVars {
  return {
    day: c.meta.day_label,
    students: c.students.length,
    visits: c.visits.length,
    buildings: c.buildings.length,
    statements: c.statements.length,
    flags: c.flags.filter((f) => f.severity > 0).length,
    lies: c.flags.filter((f) => f.rule === 'statement_contradiction').length,
  }
}

function fill(text: string, vars: SceneVars): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) => (key in vars ? String(vars[key as keyof SceneVars]) : whole))
}

/** The briefing with every {placeholder} filled from the case. */
export function buildBriefing(c: Case): Scene {
  const vars = sceneVars(c)
  return {
    ...BRIEFING,
    location: fill(BRIEFING.location, vars),
    lines: BRIEFING.lines.map((line) => ({ ...line, text: fill(line.text, vars) })),
  }
}
