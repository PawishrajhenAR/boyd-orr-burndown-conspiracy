import type { Case, Student, Suspect } from '../types/case'

/** How many students survive Level 1 (rule-breakers + their closest contacts). */
export const SHORTLIST_SIZE = 25

export interface ContactStats {
  /** Distinct rule-breakers this student met. */
  met: string[]
  /** Total minutes spent with rule-breakers. */
  minutes: number
}

export interface Shortlist {
  ruleBreakers: Student[]
  contacts: Student[]
  all: Student[]
  /** Contact stats for every student (rule-breakers included). */
  stats: Map<string, ContactStats>
}

/**
 * Level 1 filter:
 * 1. every student with score > 0 (a rule-breaker),
 * 2. then the students who met the most distinct rule-breakers
 *    (tie-break: most minutes together, then name) until SHORTLIST_SIZE is reached.
 */
export function getShortlist(c: Case, size: number = SHORTLIST_SIZE): Shortlist {
  const byId = new Map(c.students.map((s) => [s.id, s]))
  const ruleBreakerIds = new Set(c.suspects.filter((s) => s.score > 0).map((s) => s.student_id))

  const met = new Map<string, Set<string>>()
  const minutes = new Map<string, number>()
  const add = (who: string, other: string, mins: number) => {
    if (!ruleBreakerIds.has(other)) return
    if (!met.has(who)) met.set(who, new Set())
    met.get(who)!.add(other)
    minutes.set(who, (minutes.get(who) ?? 0) + mins)
  }
  for (const m of c.meetings) {
    add(m.a, m.b, m.minutes)
    add(m.b, m.a, m.minutes)
  }

  const stats = new Map<string, ContactStats>()
  for (const s of c.students) {
    stats.set(s.id, { met: [...(met.get(s.id) ?? [])], minutes: minutes.get(s.id) ?? 0 })
  }

  const ruleBreakers = c.suspects
    .filter((s) => ruleBreakerIds.has(s.student_id))
    .sort((a, b) => a.rank - b.rank)
    .map((s) => byId.get(s.student_id))
    .filter((s): s is Student => !!s)

  const contacts = c.students
    .filter((s) => !ruleBreakerIds.has(s.id) && stats.get(s.id)!.met.length > 0)
    .sort((a, b) => {
      const sa = stats.get(a.id)!
      const sb = stats.get(b.id)!
      return sb.met.length - sa.met.length || sb.minutes - sa.minutes || a.name.localeCompare(b.name)
    })
    .slice(0, Math.max(0, size - ruleBreakers.length))

  return { ruleBreakers, contacts, all: [...ruleBreakers, ...contacts], stats }
}

export function suspectMap(c: Case): Map<string, Suspect> {
  return new Map(c.suspects.map((s) => [s.student_id, s]))
}

export function conspirators(c: Case): Student[] {
  const byId = new Map(c.students.map((s) => [s.id, s]))
  return c.suspects
    .filter((s) => s.verdict === 'conspirator')
    .sort((a, b) => a.rank - b.rank)
    .map((s) => byId.get(s.student_id))
    .filter((s): s is Student => !!s)
}

export function mastermind(c: Case): Student | undefined {
  const sus = c.suspects.find((s) => s.verdict === 'mastermind')
  return sus ? c.students.find((s) => s.id === sus.student_id) : undefined
}

/** Minutes from midnight → "HH:MM", with " (+1)" after midnight. */
export function clock(min: number): string {
  const day = Math.floor(min / 1440)
  const r = ((min % 1440) + 1440) % 1440
  const label = `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
  return day > 0 ? `${label} (+${day})` : label
}

/** Human labels for flag rules (used for chips). */
export const RULE_LABEL: Record<string, string> = {
  missing_lecture: 'Missed lecture',
  multiple_lectures: 'Two lectures',
  left_lecture_early: 'Left lecture early',
  out_of_hours: 'After hours',
  impossible_overlap: 'In two places at once',
  age_restricted_venue: 'Under-age venue',
  id_mismatch: 'Wrong ID',
  id_format: 'ID typo',
  statement_contradiction: 'Statement lie',
  statement_omission: 'Left out of statement',
  false_society_claim: 'Fake society',
  subject_without_lecture: 'No lecture for subject',
}
