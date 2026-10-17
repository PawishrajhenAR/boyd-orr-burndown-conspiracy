import { useState, type ButtonHTMLAttributes, type ReactNode, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import type { Student, Verdict } from '../../types/case'
import { soundIsMuted, toggleSound } from './audio'

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>{children}</section>
}

export function Button({ children, variant = 'accent', ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'accent' | 'danger' }) {
  return <button className={`btn ${variant}`} {...props}>{children}</button>
}

export function Character({ variant = 'ember', student }: { variant?: 'ember' | 'morag' | 'pip' | 'student'; student?: Student }) {
  const hair = student?.hair_colour || ({ ember: '#5b3522', morag: '#6d4028', pip: '#efb35d' } as Record<string, string>)[variant] || '#4b2f25'
  const shirt = student ? ({ Computing: '#4361ee', Engineering: '#d35400', Physics: '#457b9d' }[student.subject] ?? '#2e8b57') : ({ ember: '#ca3c35', morag: '#315f8a', pip: '#f4a261' } as Record<string, string>)[variant] || '#777'
  return <svg className="character" viewBox="0 0 100 120" aria-label={student?.name ?? variant}>
    <circle cx="50" cy="38" r="24" fill="#d79b73" /><path d="M27 38Q30 8 50 12Q73 10 75 38" fill={hair} />
    <circle cx="42" cy="40" r="2.5" /><circle cx="59" cy="40" r="2.5" /><path d="M43 51Q50 56 58 51" fill="none" stroke="#552d25" strokeWidth="2" />
    <path d="M18 116V82Q50 64 82 82V116" fill={shirt} /><path d="M38 70H62L58 85H42Z" fill="#f3e5d7" />
  </svg>
}

const labels: Record<Verdict, string> = { clear: 'CLEARED', suspicious: 'WATCH', conspirator: 'CONSPIRATOR', mastermind: 'MASTERMIND' }
export function Stamp({ verdict }: { verdict: Verdict }) { return <span className={`stamp ${verdict}`}>{labels[verdict]}</span> }

export function Polaroid({ student, status, verdict, onClick }: { student: Student; status: string; verdict?: Verdict; onClick?: () => void }) {
  return <button className="polaroid" data-card-id={student.id} onClick={onClick} style={{ '--tilt': `${((student.id.charCodeAt(0) + student.id.length * 3) % 9) - 4}deg` } as CSSProperties}>
    <i className="pin-dot" /><Character variant="student" student={student} /><strong>{student.name}</strong><small>{student.subject}</small><em>{status}</em>{verdict && verdict !== 'clear' && <Stamp verdict={verdict} />}
  </button>
}

export function SpeechBubble({ speaker, children }: { speaker: string; children: ReactNode }) { return <div className="speech"><b>{speaker}</b><p>{children}</p></div> }
export function StickyNote({ children }: { children: ReactNode }) { return <aside className="sticky">{children}</aside> }
export function NavRail() { const [muted, setMuted] = useState(soundIsMuted()); return <nav className="nav-rail"><Link to="/board">Board</Link><Link to="/hq">HQ</Link><Link to="/map">Map</Link><Link to="/timeline">Timeline</Link><Link to="/network">Network</Link><Link to="/evidence">Evidence</Link><button className="sound-toggle" onClick={() => setMuted(toggleSound())} aria-label={muted ? 'Enable sound' : 'Mute sound'}>{muted ? 'Sound off' : 'Sound on'}</button></nav> }
