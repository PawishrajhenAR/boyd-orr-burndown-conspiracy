import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useCaseStore } from '../store/useCaseStore'
import './register.css'

export default function RegisterPage() {
  const c = useCaseStore((state) => state.case)
  const [query, setQuery] = useState('')
  const [allRevealed, setAllRevealed] = useState(false)
  const [overrides, setOverrides] = useState<Set<string>>(new Set())
  const students = useMemo(() => {
    const search = query.trim().toLowerCase()
    return [...(c?.students ?? [])]
      .sort((a, b) => a.id.localeCompare(b.id))
      .filter((student) => !search || student.id.toLowerCase().includes(search) || student.name.toLowerCase().includes(search))
  }, [c, query])

  function toggleStudent(id: string) {
    setOverrides((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return <main className="page register-page">
    <header className="register-header">
      <div><p className="eyebrow">CASE FILE #1105</p><h1>The Register</h1>
        <p>{c ? `${c.students.length} students on campus. Select a card to reveal its student.` : 'Loading the student register…'}</p>
      </div>
      <Link className="btn accent" to="/briefing">Begin investigation →</Link>
    </header>
    <div className="register-toolbar">
      <label htmlFor="register-search">Search ID or name</label>
      <input id="register-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search students…" />
      <button type="button" className="btn" aria-pressed={allRevealed} onClick={() => { setAllRevealed(!allRevealed); setOverrides(new Set()) }}>
        {allRevealed ? 'Hide all identities' : 'Reveal all identities'}
      </button>
      <span role="status">{students.length} shown</span>
    </div>
    <div className="register-grid">
      {students.map((student) => {
        const revealed = allRevealed !== overrides.has(student.id)
        return <button type="button" key={student.id} className="register-card" aria-pressed={revealed}
          aria-label={revealed ? `${student.name}, ${student.id}, ${student.subject}` : `Student ${student.id}, reveal identity`}
          onClick={() => toggleStudent(student.id)}>
          <span className="register-card-inner">
            <span className="register-card-face register-card-front" aria-hidden={revealed}>
              <small>STUDENT ID</small><strong>{student.id}</strong><small>Select to reveal</small>
            </span>
            <span className="register-card-face register-card-back" aria-hidden={!revealed}>
              <span className="register-initials" aria-hidden="true">{student.name.split(/\s+/).map((part) => part[0]).slice(0, 2).join('')}</span>
              <strong>{student.name}</strong><span>{student.id}</span><small>{student.subject}</small>
            </span>
          </span>
        </button>
      })}
    </div>
    {c && students.length === 0 && <p role="status">No student matches “{query}”.</p>}
    <p className="caption">This is everyone in the case file. Identities come from the case data; no verdicts are revealed here.</p>
  </main>
}
