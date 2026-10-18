import type { Case } from '../types/case'
// `.ts` extension so `node --test` can load this file directly (Vite accepts it too).
import { RULE_LABEL, conspirators, getShortlist, mastermind, type Shortlist } from './shortlist.ts'

export type Speaker = 'morag' | 'ember'

export const SPEAKERS: Record<Speaker, { name: string; role: string }> = {
  morag: { name: 'PC Morag', role: 'Campus police' },
  ember: { name: 'Inspector Ember', role: 'Investigator' },
}

/** One line of dialogue. `stage` tells the page which animation step to run when the line appears. */
export interface Line<S extends string = string> {
  speaker: Speaker
  text: string
  stage: S
}

export type Level1Stage = 'all' | 'rules' | 'breakers' | 'hold' | 'contacts' | 'collapse'
export type Level2Stage = 'scores' | 'threshold' | 'six' | 'suspicious'
export type Level3Stage = 'play' | 'analyse' | 'reveal'
export type FinalStage = 'closing' | 'closed'

type Template<S extends string> = Line<S> & { when?: (v: ScriptVars) => boolean }

// ---- templates: every {placeholder} is filled from the case data ----

const LEVEL1: Template<Level1Stage>[] = [
  { speaker: 'morag', stage: 'all', text: "We've got {total} students on the logs. Where do we even start?" },
  { speaker: 'ember', stage: 'rules', text: 'With the rules. Lecture once, no out-of-hours access, and their story must match the logs.' },
  { speaker: 'ember', stage: 'breakers', text: '{n_breakers} students broke a rule: {rule_chips}.' },
  { speaker: 'morag', stage: 'hold', text: 'And the ones who look clean?' },
  { speaker: 'ember', stage: 'contacts', text: 'A clean record can hide a boss. Bring in the {n_contacts} who spent the most time with those {n_breakers}.' },
  { speaker: 'morag', stage: 'collapse', text: 'That leaves {shortlist}. Everyone else goes home.' },
]

const LEVEL2: Template<Level2Stage>[] = [
  { speaker: 'ember', stage: 'scores', text: 'Now we score them. Every kind of rule broken adds points: high 3, medium 2, low 1.' },
  { speaker: 'morag', stage: 'threshold', text: "Who's above the line?" },
  { speaker: 'ember', stage: 'six', text: 'The top {conspirator_count} with the strongest evidence: {six_names}.' },
  { speaker: 'morag', stage: 'suspicious', text: 'And {seventh_name}?', when: (v) => !!v.seventh_name },
  { speaker: 'ember', stage: 'suspicious', text: 'Suspicious, but weaker evidence. We keep an eye on them.', when: (v) => !!v.seventh_name },
]

const LEVEL3: Template<Level3Stage>[] = [
  { speaker: 'morag', stage: 'play', text: 'Six caught. Who gave the orders?' },
  { speaker: 'ember', stage: 'analyse', text: "The boss has a clean record. So let's watch who meets the six." },
  { speaker: 'ember', stage: 'reveal', text: '{mastermind} met {k} of {six}. Same place, same time, every one of them.' },
]

const FINAL: Template<FinalStage>[] = [
  { speaker: 'morag', stage: 'closing', text: 'Case closed?' },
  { speaker: 'ember', stage: 'closed', text: 'Case closed. {mastermind}: clean on paper, but at the centre of everything.' },
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
    .map(({ speaker, stage, text }) => ({ speaker, stage, text: fillTemplate(text, vars) }))
}

export interface Scripts {
  vars: ScriptVars
  level1: Line<Level1Stage>[]
  level2: Line<Level2Stage>[]
  level3: Line<Level3Stage>[]
  final: Line<FinalStage>[]
}

export function buildScripts(c: Case, shortlist: Shortlist = getShortlist(c)): Scripts {
  const vars = scriptVars(c, shortlist)
  return {
    vars,
    level1: fill(LEVEL1, vars),
    level2: fill(LEVEL2, vars),
    level3: fill(LEVEL3, vars),
    final: fill(FINAL, vars),
  }
}
