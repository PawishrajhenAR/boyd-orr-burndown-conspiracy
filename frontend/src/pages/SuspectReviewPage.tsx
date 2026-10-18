import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { buildSuspectReview } from '../flow/suspectReview'
import { clock, RULE_LABEL } from '../flow/shortlist'
import { useCaseStore } from '../store/useCaseStore'
import './register.css'

const PHASES = ['Suspicion scores', 'Conspirators', 'Watch list'] as const

export default function SuspectReviewPage() {
  const c = useCaseStore((state) => state.case)
  const [phase, setPhase] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const review = useMemo(() => c ? buildSuspectReview(c) : null, [c])
  if (!c || !review) return <main className="page"><p role="status">Loading suspect analysis…</p></main>
  const cards = phase === 0 ? review.ranked : phase === 1 ? review.conspirators : [...review.conspirators, ...review.watchList]
  const selected = cards.find(({ student }) => student.id === selectedId)
  const flags = c.flags.filter((flag) => flag.student_id === selectedId).sort((a, b) => b.severity - a.severity)

  function changePhase(next: number) { setPhase(next); setSelectedId(null) }

  return <main className="page">
    <header className="register-header"><div><p className="eyebrow">LEVEL 2 · SUSPECT REVIEW</p><h1>{PHASES[phase]}</h1></div><Link className="btn" to="/first-sweep">Back to first sweep</Link></header>
    <nav className="register-toolbar" aria-label="Suspect review stages">{PHASES.map((label, index) => <button type="button" key={label} className={`btn${phase === index ? ' accent' : ''}`} aria-current={phase === index ? 'step' : undefined} onClick={() => changePhase(index)}>{index + 1}. {label}</button>)}</nav>
    <p className="panel">Scores and ranks come from the case analysis. Review the rule evidence, then reveal the analysis verdicts. A close contact alone is not proof of involvement.</p>
    <p role="status">{cards.length} students shown{phase > 0 && ` · ${review.conspirators.length} conspirators`}{phase === 2 && ` · ${review.watchList.length} on the watch list`}</p>
    <div className="register-grid">{cards.map(({ student, suspect }) => <button type="button" key={student.id} className="panel sweep-card" aria-pressed={selectedId === student.id} onClick={() => setSelectedId(student.id)}>
      <strong>{student.name}</strong><span>{student.id}</span><span>Score {suspect?.score ?? 0} · Rank {suspect?.rank ?? 'unranked'}</span>
      <progress className="review-score" max={review.maxScore} value={Math.max(0, suspect?.score ?? 0)} aria-label={`Suspicion score for ${student.name}`} />
      {phase > 0 && <strong className={suspect?.verdict === 'conspirator' ? 'review-conspirator' : 'review-watch'}>{suspect?.verdict === 'conspirator' ? 'CONSPIRATOR' : 'WATCH LIST'}</strong>}
    </button>)}</div>
    {cards.length === 0 && <p>No students have this verdict in the available case analysis.</p>}
    {selected && <section className="panel" aria-label={`Rule evidence for ${selected.student.name}`}>
      <h2>{selected.student.name}</h2><p>{selected.student.subject} · Score {selected.suspect?.score ?? 0}</p>
      <h3>Rule evidence ({flags.length})</h3>
      {flags.length === 0 ? <p>No rule flags recorded for this student.</p> : <ul>{flags.map((flag) => <li key={flag.id}><strong>{RULE_LABEL[flag.rule] ?? flag.rule}: {flag.title}</strong><p>{flag.detail}</p><small>Severity {flag.severity}{flag.time != null && ` · ${clock(flag.time)}`}</small></li>)}</ul>}
      <div className="register-toolbar"><Link className="btn" to={`/student/${encodeURIComponent(selected.student.id)}`}>Open student file</Link><button type="button" className="btn" onClick={() => setSelectedId(null)}>Close evidence</button></div>
    </section>}
    <div className="register-toolbar">{phase > 0 && <button type="button" className="btn" onClick={() => changePhase(phase - 1)}>Previous stage</button>}{phase < 2 ? <button type="button" className="btn accent" onClick={() => changePhase(phase + 1)}>Reveal {phase === 0 ? 'conspirators' : 'watch list'} →</button> : <Link className="btn accent" to="/movement-evidence">Follow the movement →</Link>}</div>
  </main>
}
