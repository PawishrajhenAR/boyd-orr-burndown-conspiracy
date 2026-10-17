import { Link, useParams } from 'react-router-dom'
import { Clock24, DayTimeline } from '../components/viz'
import { Button, Panel, Polaroid, Stamp } from '../components/game/GameKit'
import { flagsFor, meetingsUntil, studentById, useCaseStore, visitsFor } from '../store/useCaseStore'

export default function InterrogationPage() {
  const { id = '' } = useParams()
  const c = useCaseStore((s) => s.case)
  const reveal = useCaseStore((s) => s.revealForCheck)
  const examined = useCaseStore((s) => s.examined[id])
  if (!c) return null
  const person = studentById(c, id)
  if (!person) return <div className="page">Student not found.</div>
  const suspect = c.suspects.find((s) => s.student_id === id)
  const statement = c.statements.find((s) => s.student_id === id)
  const open = (check: 'lecture' | 'hours' | 'alibi' | 'profile') => reveal(id, check)
  return <div className="page"><div className="profile-head"><Polaroid student={person} status={person.subject}/><div><h2>{person.name}</h2><p>{person.age} years · Year {person.year} · {person.subject}</p><p>Societies: {person.societies.join(', ') || 'None recorded'}</p></div></div><div className="check-tabs">{(['lecture', 'hours', 'alibi', 'profile'] as const).map((check) => <Button key={check} onClick={() => open(check)}>{check} {examined?.[check] ? '✓' : ''}</Button>)}</div><div className="check-grid"><Panel><h3>Lecture check</h3><DayTimeline studentId={id}/></Panel><Panel><h3>Hours check</h3><Clock24 studentId={id}/></Panel><Panel><h3>Alibi check</h3><p className="quote">{statement?.text || 'No statement given.'}</p>{visitsFor(c, id).map((visit) => <code key={visit.id}>{visit.raw_time} · {c.buildings.find((b) => b.id === visit.building_id)?.name}<br/></code>)}</Panel><Panel><h3>Profile check</h3>{flagsFor(c, id).map((flag) => <p key={flag.id}>{flag.title}</p>)}<p>Meetings: {meetingsUntil(c, c.meta.time_max).filter((meeting) => meeting.a === id || meeting.b === id).length}</p></Panel></div>{examined?.lecture && examined?.hours && examined?.alibi && suspect && <div className="verdict"><Stamp verdict={suspect.verdict}/><b>Score: {suspect.score}</b></div>}<Link className="btn accent" to="/board">← Back to board</Link></div>
}
