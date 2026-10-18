import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { getShortlist, RULE_LABEL } from '../flow/shortlist'
import { useCaseStore } from '../store/useCaseStore'
import './register.css'

const STAGES = ['Everyone', 'Rule breaks', 'Close contacts', 'Shortlist'] as const

export default function FirstSweepPage() {
  const c = useCaseStore((state) => state.case)
  const [stage, setStage] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const shortlist = useMemo(() => c ? getShortlist(c) : null, [c])
  if (!c || !shortlist) return <main className="page"><p role="status">Loading evidence for the first sweep…</p></main>

  const ruleIds = new Set(shortlist.ruleBreakers.map((student) => student.id))
  const contactIds = new Set(shortlist.contacts.map((student) => student.id))
  const students = stage === 1 ? shortlist.ruleBreakers : stage === 2 ? shortlist.contacts : stage === 3 ? shortlist.all : c.students
  const selected = c.students.find((student) => student.id === selectedId)
  const flags = c.flags.filter((flag) => flag.student_id === selectedId)
  const stats = selectedId ? shortlist.stats.get(selectedId) : undefined

  return <main className="page">
    <header className="register-header"><div><p className="eyebrow">LEVEL 1 · FIRST SWEEP</p><h1>{STAGES[stage]}</h1></div><Link className="btn" to="/register">Back to register</Link></header>
    <nav className="register-toolbar" aria-label="Evidence filtering stages">
      {STAGES.map((label, index) => <button type="button" key={label} className={`btn${stage === index ? ' accent' : ''}`} aria-current={stage === index ? 'step' : undefined} onClick={() => { setStage(index); setSelectedId(null) }}>{index + 1}. {label}</button>)}
    </nav>
    <p className="panel">Keep every student with a positive analysis score. Fill the shortlist with their contacts, ranked by distinct flagged students met, then total meeting minutes, then name. Contact alone does not establish guilt. The target is 25 students; every rule-breaker is retained even if that exceeds the target.</p>
    <p role="status">{students.length} shown · {shortlist.ruleBreakers.length} rule-breakers · {shortlist.contacts.length} close contacts</p>
    <div className="register-grid">
      {students.map((student) => <button type="button" key={student.id} className="panel sweep-card" aria-pressed={selectedId === student.id} onClick={() => setSelectedId(student.id)}>
        <strong>{student.name}</strong><span>{student.id}</span>
        <small>{stage === 0 ? 'Student file' : ruleIds.has(student.id) ? 'Rule-break evidence' : contactIds.has(student.id) ? 'Close contact' : 'Student file'}</small>
      </button>)}
    </div>
    {students.length === 0 && <p>No students meet this stage’s criteria.</p>}
    {selected && <section className="panel" aria-label={`Evidence for ${selected.name}`}>
      <h2>{selected.name}</h2><p>{selected.id} · {selected.subject}</p>
      <h3>Rule evidence ({flags.length})</h3>
      {flags.length === 0 ? <p>No rule flags in this case file.</p> : <ul>{flags.map((flag) => <li key={flag.id}><strong>{RULE_LABEL[flag.rule] ?? flag.title}: {flag.title}</strong><p>{flag.detail}</p></li>)}</ul>}
      <h3>Contact evidence</h3><p>{stats?.met.length ?? 0} distinct rule-breakers met · {stats?.minutes ?? 0} total meeting minutes</p>
      <ul>{stats?.met.map((id) => <li key={id}>{c.students.find((student) => student.id === id)?.name ?? id}</li>)}</ul>
      <button type="button" className="btn" onClick={() => setSelectedId(null)}>Close evidence</button>
    </section>}
    <div className="register-toolbar">
      {stage > 0 && <button type="button" className="btn" onClick={() => { setStage(stage - 1); setSelectedId(null) }}>Previous stage</button>}
      {stage < 3 ? <button type="button" className="btn accent" onClick={() => { setStage(stage + 1); setSelectedId(null) }}>Next stage →</button> : <Link className="btn accent" to="/suspect-review">Review suspects →</Link>}
    </div>
  </main>
}
