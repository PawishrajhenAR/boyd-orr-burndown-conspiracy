import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { movementAt } from '../flow/movement'
import { clock, getShortlist } from '../flow/shortlist'
import { useCaseStore } from '../store/useCaseStore'
import './register.css'

export default function MovementEvidencePage() {
  const c = useCaseStore((state) => state.case)
  const [selectedId, setSelectedId] = useState('')
  const [minute, setMinute] = useState<number | null>(null)
  const students = useMemo(() => c ? getShortlist(c).all : [], [c])
  if (!c) return <main className="page"><p role="status">Loading movement evidence…</p></main>
  const id = selectedId || students[0]?.id || ''
  const now = minute ?? c.meta.time_min
  const active = movementAt(c, id, now)
  const visits = c.visits.filter((visit) => visit.student_id === id).sort((a, b) => a.start - b.start)
  const span = Math.max(1, c.meta.time_max - c.meta.time_min)
  const place = (buildingId: string) => c.buildings.find((building) => building.id === buildingId)?.name ?? buildingId
  return <main className="page">
    <header className="register-header"><div><p className="eyebrow">LEVEL 3 · MOVEMENT EVIDENCE</p><h1>Follow the movement</h1></div><Link className="btn" to="/suspect-review">Back to suspects</Link></header>
    <div className="register-toolbar"><label htmlFor="movement-student">Student</label><select id="movement-student" value={id} onChange={(event) => setSelectedId(event.target.value)}>{students.map((student) => <option key={student.id} value={student.id}>{student.name} · {student.id}</option>)}</select></div>
    <label htmlFor="movement-time">Investigation time: {clock(now)}</label><input className="movement-slider" id="movement-time" type="range" min={c.meta.time_min} max={c.meta.time_max} value={now} onChange={(event) => setMinute(Number(event.target.value))} />
    <p role="status">{active.visits.length ? active.visits.map((visit) => place(visit.building_id)).join(' · ') : 'No recorded visit at this time.'} · {active.meetings.length} active meetings</p>
    <div className="panel"><h2>Recorded visits</h2><p className="caption">Each bar uses the same time scale. Select a visit to inspect its starting time. Times marked (+1) are after midnight.</p>
      {visits.map((visit) => <div className="movement-row" key={visit.id}><span>{place(visit.building_id)} · {clock(visit.start)}–{clock(visit.end)}</span><div className="movement-track"><button type="button" className="movement-bar" aria-label={`${place(visit.building_id)}, ${clock(visit.start)} to ${clock(visit.end)}`} style={{ left: `${100 * (visit.start - c.meta.time_min) / span}%`, width: `${100 * (visit.end - visit.start) / span}%` }} onClick={() => setMinute(visit.start)} /></div></div>)}
      {visits.length === 0 && <p>No visits recorded for this student.</p>}
    </div>
    <section className="panel"><h2>Meetings at {clock(now)}</h2>{active.meetings.length === 0 ? <p>No recorded meetings at this time.</p> : <ul>{active.meetings.map((meeting) => { const other = meeting.a === id ? meeting.b : meeting.a; return <li key={meeting.id}>{c.students.find((student) => student.id === other)?.name ?? other} · {place(meeting.building_id)} · {clock(meeting.start)}–{clock(meeting.end)} · {meeting.minutes} minutes</li> })}</ul>}</section>
    <div className="register-toolbar"><Link className="btn" to="/map">Campus map</Link><Link className="btn accent" to="/results">Review final results →</Link></div>
  </main>
}
