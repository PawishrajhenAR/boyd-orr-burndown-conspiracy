import type { Case } from '../types/case'
import { conspirators, mastermind } from './shortlist.ts'

export function movementAt(c: Case, studentId: string, minute: number) {
  return {
    visits: c.visits.filter((visit) => visit.student_id === studentId && visit.start <= minute && minute < visit.end),
    meetings: c.meetings.filter((meeting) => (meeting.a === studentId || meeting.b === studentId) && meeting.start <= minute && minute < meeting.end),
  }
}

export function resultEvidence(c: Case) {
  const boss = mastermind(c)
  const links = conspirators(c).map((student) => ({
    student,
    meetings: boss ? c.meetings.filter((meeting) => (meeting.a === boss.id && meeting.b === student.id) || (meeting.b === boss.id && meeting.a === student.id)).sort((a, b) => b.minutes - a.minutes || a.start - b.start) : [],
  }))
  return { boss, links, metAll: !!boss && links.length > 0 && links.every((link) => link.meetings.length > 0) }
}
