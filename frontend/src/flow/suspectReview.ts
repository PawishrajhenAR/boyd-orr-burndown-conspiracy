import type { Case } from '../types/case'
import { getShortlist, suspectMap } from './shortlist.ts'

/** Review analysis results without deriving new verdicts in the client. */
export function buildSuspectReview(c: Case) {
  const byId = suspectMap(c)
  const ranked = getShortlist(c).all
    .map((student) => ({ student, suspect: byId.get(student.id) }))
    .sort((a, b) => (a.suspect?.rank ?? Infinity) - (b.suspect?.rank ?? Infinity) || a.student.id.localeCompare(b.student.id))
  return {
    ranked,
    conspirators: ranked.filter(({ suspect }) => suspect?.verdict === 'conspirator'),
    watchList: ranked.filter(({ suspect }) => suspect?.verdict === 'suspicious'),
    maxScore: Math.max(1, ...ranked.map(({ suspect }) => suspect?.score ?? 0)),
  }
}
