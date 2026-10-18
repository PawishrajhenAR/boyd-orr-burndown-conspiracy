import { Link } from 'react-router-dom'
import { resultEvidence } from '../flow/movement'
import { clock } from '../flow/shortlist'
import { useCaseStore } from '../store/useCaseStore'
import './register.css'

export default function ResultsPage() {
  const c = useCaseStore((state) => state.case)
  if (!c) return <main className="page"><p role="status">Loading case results…</p></main>
  const { boss, links, metAll } = resultEvidence(c)
  const bossFlags = c.flags.filter((flag) => flag.student_id === boss?.id)
  return <main className="page">
    <header className="register-header"><div><p className="eyebrow">FINAL RESULTS</p><h1>The case findings</h1></div><Link className="btn" to="/movement-evidence">Back to movement</Link></header>
    <section className="panel"><h2>{boss ? `Analysis-designated mastermind: ${boss.name}` : 'No mastermind designated in this case'}</h2>
      {boss && <p>{boss.id} · {bossFlags.length} rule flags recorded</p>}
      <p>{metAll ? 'Recorded meetings connect the designated mastermind to every conspirator.' : 'The available meeting evidence does not establish a link from a designated mastermind to every conspirator.'}</p>
    </section>
    <h2>Conspirators and meeting evidence ({links.length})</h2>
    <div className="register-grid">{links.map(({ student, meetings }) => <section className="panel" key={student.id}><h3>{student.name}</h3><p>{student.id}</p><p>{c.flags.filter((flag) => flag.student_id === student.id).length} rule flags</p>
      {meetings[0] ? <p>Longest meeting with the designated mastermind: {c.buildings.find((building) => building.id === meetings[0].building_id)?.name ?? meetings[0].building_id} · {clock(meetings[0].start)}–{clock(meetings[0].end)} · {meetings[0].minutes} minutes</p> : <p>No meeting link recorded.</p>}
      <Link className="btn" to={`/student/${encodeURIComponent(student.id)}`}>Student file</Link>
    </section>)}</div>
    {links.length === 0 && <p>No conspirator verdicts in the available case.</p>}
    <div className="register-toolbar"><Link className="btn" to="/suspect-review">Review rule evidence</Link><Link className="btn accent" to="/register">Restart review</Link></div>
  </main>
}
