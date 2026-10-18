import type { Case } from '../types/case'
// `.ts` extension so `node --test` can load this file directly (Vite accepts it too).
import { RULE_LABEL, clock, conspirators, getShortlist, mastermind, type Shortlist } from './shortlist.ts'

/** The cast and every expression sprite they have (public/characters/<character>/<expression>.webp). */
export const EXPRESSIONS = {
  mathew: ['thinking', 'explaining', 'examining', 'focus', 'aha', 'suspicious', 'determined', 'case-closed'],
  morag: ['neutral', 'curious', 'worried', 'surprised', 'sceptical', 'pointing', 'relieved', 'salute'],
} as const

export type Character = keyof typeof EXPRESSIONS
export type Expression<C extends Character = Character> = (typeof EXPRESSIONS)[C][number]
export type Speaker = Character

export const SPEAKERS: Record<Speaker, { name: string; role: string }> = {
  mathew: { name: 'Inspector Mathew', role: 'Investigator' },
  morag: { name: 'PC Morag', role: 'Campus police' },
}

export function spriteUrl<C extends Character>(character: C, expression: Expression<C>): string {
  return `/characters/${character}/${expression}.webp`
}

export type ReactionId =
  | 'curious'
  | 'explaining'
  | 'inspecting'
  | 'discovery'
  | 'sceptical'
  | 'determined'
  | 'focused'
  | 'reassured'
  | 'resolved'

/** What both characters show for one beat: the speaker's expression and the listener's reaction. */
export interface CharacterReaction {
  mathew: Expression<'mathew'>
  morag: Expression<'morag'>
  /** A reveal: aura flare, speed lines, sting. */
  impact?: boolean
  /** A slow camera push-in on the speaker. */
  camera?: boolean
}

export interface EvidenceCue {
  eyebrow: string
  title: string
  items: { label: string; detail: string }[]
  note?: string
}

export const REACTIONS: Record<ReactionId, CharacterReaction> = {
  curious: { mathew: 'thinking', morag: 'curious' },
  explaining: { mathew: 'explaining', morag: 'curious' },
  inspecting: { mathew: 'examining', morag: 'curious', camera: true },
  discovery: { mathew: 'aha', morag: 'surprised', impact: true, camera: true },
  sceptical: { mathew: 'suspicious', morag: 'sceptical' },
  determined: { mathew: 'determined', morag: 'pointing' },
  focused: { mathew: 'focus', morag: 'worried' },
  reassured: { mathew: 'case-closed', morag: 'relieved' },
  resolved: { mathew: 'case-closed', morag: 'salute', impact: true },
}

export const FALLBACK_REACTION: CharacterReaction = { mathew: 'thinking', morag: 'neutral' }

/** One line of dialogue. `stage` tells the page which animation step to run when the line appears. */
export interface Line<S extends string = string> {
  speaker: Speaker
  text: string
  stage: S
  reaction: ReactionId
  /** Per-line override of either character's expression (speaker or listener), on top of the reaction. */
  expressions?: Partial<Pick<CharacterReaction, Character>>
  evidence?: EvidenceCue
}

/** The two sprites and effects to show for a line: reaction pair, then any per-line overrides. */
export function stagingFor(line: Pick<Line, 'reaction' | 'expressions'> | undefined): CharacterReaction {
  const base = (line && REACTIONS[line.reaction]) || FALLBACK_REACTION
  return { ...base, ...line?.expressions }
}

export type Level1Stage = 'all' | 'rules' | 'breakers' | 'hold' | 'contacts' | 'collapse'
export type Level2Stage = 'scores' | 'threshold' | 'six' | 'suspicious'
export type Level3Stage = 'play' | 'analyse' | 'reveal'
export type FinalStage = 'closing' | 'closed'

type Template<S extends string> = Line<S> & { when?: (v: ScriptVars) => boolean }

// ---- templates: every {placeholder} is filled from the case data ----

const LEVEL1: Template<Level1Stage>[] = [
  { speaker: 'morag', stage: 'all', reaction: 'curious', text: "We've got {total} students on the logs. Where do we even start?" },
  { speaker: 'mathew', stage: 'rules', reaction: 'explaining', text: 'With the rules. Lecture once, no out-of-hours access, and their story must match the logs.' },
  { speaker: 'mathew', stage: 'breakers', reaction: 'discovery', text: '{n_breakers} students broke a rule: {rule_chips}.' },
  { speaker: 'morag', stage: 'hold', reaction: 'curious', text: 'And the ones who look clean?' },
  { speaker: 'mathew', stage: 'contacts', reaction: 'sceptical', text: 'A clean record can hide a boss. Bring in the {n_contacts} who spent the most time with those {n_breakers}.' },
  { speaker: 'morag', stage: 'collapse', reaction: 'determined', text: 'That leaves {shortlist}. Everyone else goes home.' },
]

const LEVEL2: Template<Level2Stage>[] = [
  { speaker: 'mathew', stage: 'scores', reaction: 'explaining', text: 'Now we score them. Every kind of rule broken adds points: high 3, medium 2, low 1.' },
  { speaker: 'morag', stage: 'threshold', reaction: 'sceptical', text: "Who's above the line?" },
  { speaker: 'mathew', stage: 'six', reaction: 'discovery', text: 'The top {conspirator_count} with the strongest evidence: {six_names}.' },
  { speaker: 'morag', stage: 'suspicious', reaction: 'sceptical', text: 'And {seventh_name}?', when: (v) => !!v.seventh_name },
  { speaker: 'mathew', stage: 'suspicious', reaction: 'focused', text: 'Suspicious, but weaker evidence. We keep an eye on them.', when: (v) => !!v.seventh_name },
]

const LEVEL3: Template<Level3Stage>[] = [
  { speaker: 'morag', stage: 'play', reaction: 'focused', text: 'Six caught. Who gave the orders?' },
  { speaker: 'mathew', stage: 'analyse', reaction: 'inspecting', text: "The boss has a clean record. So let's watch who meets the six." },
  { speaker: 'mathew', stage: 'reveal', reaction: 'discovery', when: (v) => v.k === v.six && v.six > 0, text: '{mastermind} met all {six}: in {meet_places} different buildings, from {first_meet} to {last_meet}.' },
  { speaker: 'mathew', stage: 'reveal', reaction: 'sceptical', when: (v) => v.k !== v.six || v.six === 0, text: '{mastermind} met {k} of the {six}. Close, but not the whole team.' },
]

/** Asides on the movement graph when the user rewinds time (not part of the main script). */
const LEVEL3_REWIND: Template<Level3Stage> = { speaker: 'morag', stage: 'play', reaction: 'curious', text: "Oh wait — rewind. Let's watch that again." }
const LEVEL3_REPLAYED: Template<Level3Stage> = {
  speaker: 'mathew',
  stage: 'reveal',
  reaction: 'discovery',
  text: 'There it is again: {mastermind} reaches all {six}, one meeting at a time, from {first_meet} to {last_meet}.',
}

const FINAL: Template<FinalStage>[] = [
  { speaker: 'morag', stage: 'closing', reaction: 'curious', text: 'Case closed?' },
  { speaker: 'mathew', stage: 'closed', reaction: 'resolved', text: 'Case closed. {mastermind}: clean on paper, but at the centre of everything.' },
]

export interface ScriptVars {
  total: number
  n_breakers: number
  n_contacts: number
  shortlist: number
  rule_chips: string
  conspirator_count: number
  six: number
  six_names: string
  seventh_name: string
  mastermind: string
  k: number
  /** Distinct buildings where the mastermind met conspirators, and the first / last of those meetings. */
  meet_places: number
  first_meet: string
  last_meet: string
  /** Lowest score that still counts as suspicious (the "line" on Level 2). */
  threshold: number
}

const firstName = (full: string) => full.split(' ')[0]

function joinNames(names: string[]): string {
  return names.length <= 1 ? names.join('') : `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`
}

export function scriptVars(c: Case, shortlist: Shortlist = getShortlist(c)): ScriptVars {
  const breakerIds = new Set(shortlist.ruleBreakers.map((s) => s.id))
  const ruleCounts = new Map<string, number>()
  for (const f of c.flags) {
    if (breakerIds.has(f.student_id) && f.severity > 0) ruleCounts.set(f.rule, (ruleCounts.get(f.rule) ?? 0) + 1)
  }
  const topRules = [...ruleCounts.entries()].sort((a, b) => b[1] - a[1])
  const chips = topRules.slice(0, 3).map(([r, n]) => `${(RULE_LABEL[r] ?? r).toLowerCase()} ×${n}`)
  const ruleChips = topRules.length > 3 ? `${chips.join(', ')} and more` : joinNames(chips)

  const six = conspirators(c)
  const boss = mastermind(c)
  const names = new Map(c.students.map((s) => [s.id, s.name]))
  const seventh = c.suspects.filter((s) => s.verdict === 'suspicious').sort((a, b) => a.rank - b.rank)[0]
  const sixIds = new Set(six.map((s) => s.id))
  const metSix = boss
    ? new Set(
        c.meetings
          .filter((m) => (m.a === boss.id && sixIds.has(m.b)) || (m.b === boss.id && sixIds.has(m.a)))
          .map((m) => (m.a === boss.id ? m.b : m.a)),
      ).size
    : 0
  const flagged = c.suspects.filter((s) => s.verdict === 'conspirator' || s.verdict === 'suspicious')
  const bossMeetings = boss
    ? c.meetings.filter((m) => (m.a === boss.id && sixIds.has(m.b)) || (m.b === boss.id && sixIds.has(m.a)))
    : []
  const starts = bossMeetings.map((m) => m.start)

  return {
    total: c.students.length,
    n_breakers: shortlist.ruleBreakers.length,
    n_contacts: shortlist.contacts.length,
    shortlist: shortlist.all.length,
    rule_chips: ruleChips,
    conspirator_count: six.length,
    six: six.length,
    six_names: joinNames(six.map((s) => firstName(s.name))),
    seventh_name: seventh ? (names.get(seventh.student_id) ?? '') : '',
    mastermind: boss?.name ?? 'Nobody',
    k: metSix,
    meet_places: new Set(bossMeetings.map((m) => m.building_id)).size,
    first_meet: starts.length ? clock(Math.min(...starts)) : '—',
    last_meet: starts.length ? clock(Math.max(...starts)) : '—',
    threshold: flagged.length ? Math.min(...flagged.map((s) => s.score)) : 0,
  }
}

/** Replace every `{key}` with the matching value; unknown keys are left visible so tests catch them. */
export function fillTemplate(text: string, vars: ScriptVars): string {
  return text.replace(/\{(\w+)\}/g, (whole, key: string) =>
    key in vars ? String(vars[key as keyof ScriptVars]) : whole,
  )
}

function fill<S extends string>(templates: Template<S>[], vars: ScriptVars): Line<S>[] {
  return templates
    .filter((t) => !t.when || t.when(vars))
    .map(({ speaker, stage, text, reaction, expressions }) => ({ speaker, stage, text: fillTemplate(text, vars), reaction, expressions }))
}

function evidenceForLine<S extends string>(c: Case, line: Line<S>): EvidenceCue | undefined {
  if (line.stage === 'breakers') {
    const flagged = c.flags.filter((flag) => flag.severity > 0)
    const counts = new Map<string, number>()
    for (const flag of flagged) counts.set(flag.rule, (counts.get(flag.rule) ?? 0) + 1)
    const topRules = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3)
    return {
      eyebrow: 'Evidence scan',
      title: `${flagged.length} rule flags across ${new Set(flagged.map((flag) => flag.student_id)).size} students`,
      items: topRules.map(([rule, count]) => ({ label: RULE_LABEL[rule] ?? rule, detail: `${count} record${count === 1 ? '' : 's'}` })),
    }
  }

  if (line.stage === 'six') {
    const suspects = conspirators(c)
    return {
      eyebrow: 'Evidence register',
      title: `${suspects.length} suspects meet the threshold`,
      items: suspects.map((student) => {
        const flags = c.flags.filter((flag) => flag.student_id === student.id && flag.severity > 0).length
        const score = c.suspects.find((suspect) => suspect.student_id === student.id)?.score ?? 0
        return { label: student.name, detail: `${flags} flags · score ${score}` }
      }),
    }
  }

  if (line.stage === 'reveal') {
    const boss = mastermind(c)
    if (!boss) return undefined
    const suspects = conspirators(c)
    const places = new Map(c.buildings.map((building) => [building.id, building.name]))
    const contacts = suspects.flatMap((student) => {
      const meeting = c.meetings
        .filter((item) => (item.a === boss.id && item.b === student.id) || (item.b === boss.id && item.a === student.id))
        .reduce<(typeof c.meetings)[number] | null>((best, item) => !best || item.minutes > best.minutes ? item : best, null)
      return meeting ? [{ student, meeting }] : []
    })
    const confirmed = new Set(contacts.map(({ student }) => student.id)).size
    return {
      eyebrow: 'Meeting ledger',
      title: `${confirmed} of ${suspects.length} suspect links confirmed`,
      items: contacts.slice(0, 4).map(({ student, meeting }) => ({
        label: student.name,
        detail: `${places.get(meeting.building_id) ?? meeting.building_id} · ${clock(meeting.start)} · ${meeting.minutes} min`,
      })),
      note: contacts.length > 4 ? `Plus ${contacts.length - 4} further confirmed contact${contacts.length - 4 === 1 ? '' : 's'} in the case file.` : undefined,
    }
  }

  if (line.stage === 'suspicious' && line.speaker === 'mathew') {
    const watch = c.suspects.filter((suspect) => suspect.verdict === 'suspicious').sort((a, b) => a.rank - b.rank)[0]
    const student = watch && c.students.find((person) => person.id === watch.student_id)
    if (!watch || !student) return undefined
    return {
      eyebrow: 'Watch list',
      title: `${student.name} remains under review`,
      items: [{ label: `${watch.flag_count} flagged rule${watch.flag_count === 1 ? '' : 's'}`, detail: `Score ${watch.score} · below the conspirator threshold` }],
    }
  }

  return undefined
}

function addEvidence<S extends string>(c: Case, lines: Line<S>[]): Line<S>[] {
  return lines.map((line) => ({ ...line, evidence: evidenceForLine(c, line) }))
}

export interface Scripts {
  vars: ScriptVars
  level1: Line<Level1Stage>[]
  level2: Line<Level2Stage>[]
  level3: Line<Level3Stage>[]
  /** Spoken when time is rewound on the movement graph, and when it reaches the end again. */
  level3Asides: { rewind: Line<Level3Stage>; replayed: Line<Level3Stage> }
  final: Line<FinalStage>[]
}

export function buildScripts(c: Case, shortlist: Shortlist = getShortlist(c)): Scripts {
  const vars = scriptVars(c, shortlist)
  return {
    vars,
    level1: addEvidence(c, fill(LEVEL1, vars)),
    level2: addEvidence(c, fill(LEVEL2, vars)),
    level3: addEvidence(c, fill(LEVEL3, vars)),
    level3Asides: { rewind: fill([LEVEL3_REWIND], vars)[0], replayed: addEvidence(c, fill([LEVEL3_REPLAYED], vars))[0] },
    final: addEvidence(c, fill(FINAL, vars)),
  }
}
