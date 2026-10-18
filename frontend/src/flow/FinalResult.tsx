import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion } from 'framer-motion'
import type { Meeting } from '../types/case'
import { StudentAvatar } from './avatars'
import Conversation from './Conversation'
import { useDialogue } from './useDialogue'
import type { FinalStage, Line } from './dialogue'
import type { PageProps } from './Register'
import { clock, conspirators, getShortlist, mastermind } from './shortlist'
import { play } from './sound'
import { Caption } from './TitleCard'

interface Props extends Omit<PageProps, 'onNext'> {
  onReplay: () => void
  script: Line<FinalStage>[]
}

/** Reveal timeline (seconds after the page opens). */
const T = { cards: 0.3, cardStep: 0.18, strings: 1.7, stringStep: 0.35, stringDraw: 0.55, revealGap: 0.45 }
const ODDITIES_PREVIEW = 5

/** Number that counts up from 0 when it appears. */
function CountUp({ to, delay, reducedMotion }: { to: number; delay: number; reducedMotion: boolean }) {
  const [n, setN] = useState(reducedMotion ? to : 0)
  useEffect(() => {
    if (reducedMotion) return
    const c = animate(0, to, { duration: 0.9, delay, ease: 'easeOut', onUpdate: (v) => setN(Math.round(v)) })
    return () => c.stop()
  }, [to, delay, reducedMotion])
  return <>{n}</>
}

export default function FinalResult({ c, active, reducedMotion, onReplay, script }: Props) {
  const [started, setStarted] = useState(false)
  if (active && !started) setStarted(true)
  const dialogue = useDialogue(script.length, active)

  const boss = useMemo(() => mastermind(c), [c])
  const six = useMemo(() => conspirators(c), [c])
  const shortlistSize = useMemo(() => getShortlist(c).all.length, [c])
  const places = useMemo(() => new Map(c.buildings.map((b) => [b.id, b.name])), [c.buildings])

  // For each conspirator: the longest meeting they had with the mastermind.
  const links = useMemo(() => {
    if (!boss) return []
    // Fan the six out on both sides (wide stage): right side −45°…45°, left side 135°…225°.
    const right = Math.ceil(six.length / 2)
    const left = six.length - right
    const fan = (k: number, n: number, centre: number) => (n <= 1 ? centre : centre - 45 + (90 * k) / (n - 1))
    return six.map((s, i) => {
      const together = c.meetings.filter((m) => (m.a === boss.id && m.b === s.id) || (m.b === boss.id && m.a === s.id))
      const best = together.reduce<Meeting | null>((acc, m) => (!acc || m.minutes > acc.minutes ? m : acc), null)
      const k = Math.floor(i / 2)
      const deg = i % 2 === 0 ? fan(k, right, 0) : fan(k, left, 180)
      const angle = (deg * Math.PI) / 180
      return { student: s, meeting: best, cos: Math.cos(angle), sin: Math.sin(angle), flags: c.flags.filter((f) => f.student_id === s.id && f.severity > 0) }
    })
  }, [boss, six, c.meetings, c.flags])
  const metAll = links.length > 0 && links.every((l) => l.meeting)
  const metTotal = links.filter((l) => l.meeting).length

  // ---- the reveal sequence ----
  const [cardsIn, setCardsIn] = useState(reducedMotion)
  const [strung, setStrung] = useState(reducedMotion ? links.length : 0)
  const [revealed, setRevealed] = useState(reducedMotion)
  useEffect(() => {
    if (!started) return
    if (reducedMotion) {
      setCardsIn(true)
      setStrung(links.length)
      setRevealed(true)
      play('sting')
      return
    }
    const timers: number[] = []
    const at = (s: number, fn: () => void) => timers.push(window.setTimeout(fn, s * 1000))
    at(T.cards, () => setCardsIn(true))
    links.forEach((_, i) => at(T.cards + i * T.cardStep + 0.15, () => play('flick')))
    links.forEach((_, i) =>
      at(T.strings + i * T.stringStep + T.stringDraw, () => {
        setStrung(i + 1)
        play('nodetick')
      }),
    )
    const revealAt = T.strings + links.length * T.stringStep + T.stringDraw + T.revealGap
    at(revealAt, () => {
      setRevealed(true)
      play('sting')
    })
    at(revealAt + 0.55, () => play('stamp'))
    return () => timers.forEach(clearTimeout)
  }, [started, reducedMotion, links])

  // ---- stage size, so the strings are drawn in real pixels (no stretching, no broken dashes) ----
  const stageRef = useRef<HTMLDivElement>(null)
  const [stage, setStage] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = stageRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setStage({ w: e.contentRect.width, h: e.contentRect.height }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  const cx = stage.w / 2
  const cy = stage.h / 2
  const rx = stage.w * 0.41
  const ry = stage.h * 0.44
  const pos = (l: (typeof links)[number]) => ({ x: cx + rx * l.cos, y: cy + ry * l.sin })
  /** Corkboard string: a slight sag below the straight line. */
  const stringPath = (l: (typeof links)[number]) => {
    const p = pos(l)
    const mx = (p.x + cx) / 2
    const my = (p.y + cy) / 2 + Math.min(40, Math.hypot(p.x - cx, p.y - cy) * 0.12)
    return `M${p.x},${p.y} Q${mx},${my} ${cx},${cy}`
  }


  const [showAllOdd, setShowAllOdd] = useState(false)
  const oddities = showAllOdd ? c.oddities : c.oddities.slice(0, ODDITIES_PREVIEW)
  const dur = (d: number) => (reducedMotion ? 0 : d)
  const bossFlags = boss ? c.flags.filter((f) => f.student_id === boss.id).length : 0

  if (!boss) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <p className="font-type text-2xl text-paper/70">No single mastermind found in this case file.</p>
        <button type="button" onClick={onReplay} className="rounded border border-paper/30 px-4 py-2">Replay investigation</button>
        <Caption>The kingpin and how we know.</Caption>
      </div>
    )
  }

  const funnel = [
    { label: 'Students on campus', n: c.students.length, colour: '#efe6d2' },
    { label: 'Level 1 shortlist', n: shortlistSize, colour: '#f4b942' },
    { label: 'Conspirators', n: six.length, colour: '#e05252' },
    { label: 'Mastermind', n: 1, colour: '#b3121b' },
  ]

  return (
    <div className="case-result grid h-full grid-cols-1 gap-6 px-6 pt-14 pb-12 md:px-12 lg:grid-cols-[1.45fr_1fr]">
      {/* ================= left: the reveal ================= */}
      <div className="flex min-h-0 flex-col">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="font-type text-[clamp(28px,4.2vh,44px)] tracking-[0.25em] text-paper" aria-label="Case closed">
              {'CASE CLOSED'.split('').map((ch, i) => (
                <motion.span
                  key={i}
                  initial={{ opacity: 0, y: -10 }}
                  animate={started ? { opacity: 1, y: 0 } : {}}
                  transition={{ delay: dur(i * 0.05), duration: dur(0.2) }}
                >
                  {ch}
                </motion.span>
              ))}
            </h2>
            <p className="font-mono text-xs tracking-[0.25em] text-paper/70">CASE FILE #1105 · {c.meta.day_label.toUpperCase()}</p>
          </div>
          <motion.p
            className="rounded-full border border-amber/50 bg-amber/10 px-3 py-1 font-mono text-sm text-amber"
            initial={{ opacity: 0 }}
            animate={started ? { opacity: 1 } : {}}
            transition={{ delay: dur(T.strings) }}
            data-testid="final-met-counter"
          >
            met {strung} / {six.length}
          </motion.p>
        </div>

        <div ref={stageRef} className="result-network relative mt-2 min-h-[340px] flex-1 print:h-[460px]">
          {/* spotlight behind the centre */}
          <motion.div
            className="pointer-events-none absolute top-1/2 left-1/2 h-[70%] w-[55%] -translate-x-1/2 -translate-y-1/2 rounded-full"
            style={{ background: 'radial-gradient(closest-side, rgba(244,185,66,0.28), transparent)' }}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={started ? (revealed && !reducedMotion ? { opacity: [0.7, 1, 0.7], scale: [1, 1.08, 1] } : { opacity: 0.5, scale: 1 }) : {}}
            transition={revealed && !reducedMotion ? { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } : { duration: dur(1) }}
          />

          {/* red strings (real pixels) + gold pulses travelling to the centre */}
          {stage.w > 0 && (
            <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" viewBox={`0 0 ${stage.w} ${stage.h}`} aria-hidden="true">
              {links.map((l, i) => (
                <g key={l.student.id}>
                  <motion.path
                    id={`final-string-${i}`}
                    d={stringPath(l)}
                    fill="none"
                    stroke="#b3121b"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={started ? { pathLength: 1, opacity: 1 } : {}}
                    transition={{ delay: dur(T.strings + i * T.stringStep), duration: dur(T.stringDraw), ease: 'easeInOut' }}
                  />
                  {revealed && !reducedMotion && (
                    <circle r={4} fill="#f4b942">
                      <animateMotion dur="1.8s" begin={`${i * 0.3}s`} repeatCount="indefinite" keyPoints="0;1" keyTimes="0;1" calcMode="linear">
                        <mpath href={`#final-string-${i}`} />
                      </animateMotion>
                    </circle>
                  )}
                </g>
              ))}
            </svg>
          )}

          {/* the six: pinned cards dropping in */}
          {stage.w > 0 &&
            links.map((l, i) => {
              const p = pos(l)
              return (
                <motion.div
                  key={l.student.id}
                  className="absolute z-[3] flex w-[clamp(128px,10vw,160px)] -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-md border border-red/60 bg-[#221d19] px-2 pt-3 pb-2 text-center shadow-[0_10px_24px_rgba(0,0,0,0.5)]"
                  style={{ left: p.x, top: p.y }}
                  initial={{ opacity: 0, y: -60, rotate: 0 }}
                  animate={cardsIn ? { opacity: 1, y: 0, rotate: i % 2 ? 3 : -3 } : { opacity: 0, y: -60, rotate: 0 }}
                  transition={reducedMotion ? { duration: 0 } : { delay: i * T.cardStep, type: 'spring', stiffness: 260, damping: 18 }}
                >
                  <span className="absolute -top-1.5 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-[#d62828] shadow" aria-hidden="true" />
                  <StudentAvatar student={l.student} size={52} />
                  <p className="mt-1 text-xs leading-tight font-semibold">{l.student.name}</p>
                  <p className="font-mono text-[10px] text-paper/70">{l.student.id}</p>
                  <p className="mt-0.5 text-[10px] tracking-widest text-paper/70 uppercase">conspirator</p>
                  {l.meeting && (
                    <motion.span
                      className="mt-1 flex w-full flex-col rounded border border-red/40 bg-red/10 px-1 py-0.5 font-mono text-[10px] leading-tight text-alarm"
                      initial={{ opacity: 0, y: 4 }}
                      animate={started ? { opacity: 1, y: 0 } : {}}
                      transition={{ delay: dur(T.strings + i * T.stringStep + T.stringDraw), duration: dur(0.3) }}
                      title={`Met ${boss.name} here`}
                    >
                      <span className="truncate">⇄ {places.get(l.meeting.building_id) ?? l.meeting.building_id}</span>
                      <span>{clock(l.meeting.start)}</span>
                    </motion.span>
                  )}
                </motion.div>
              )
            })}

          {/* the mastermind: a mystery card that flips to reveal the face */}
          <div className="absolute top-1/2 left-1/2 z-[4] h-[clamp(200px,30vh,250px)] w-[clamp(160px,12vw,190px)] -translate-x-1/2 -translate-y-1/2" style={{ perspective: 1000 }}>
            <motion.div
              className="relative h-full w-full"
              style={{ transformStyle: 'preserve-3d' }}
              initial={false}
              animate={{ rotateY: revealed ? 180 : 0, scale: started ? 1 : 0.85 }}
              transition={{ duration: dur(0.8), ease: [0.65, 0, 0.35, 1] }}
            >
              {/* mystery side */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-lg border-2 border-dashed border-amber/60 bg-[#1b1714] text-center shadow-[0_0_40px_rgba(244,185,66,0.25)]"
                style={{ backfaceVisibility: 'hidden' }}
              >
                <span className="font-type text-7xl text-amber/80">?</span>
                <p className="mt-2 px-3 font-type text-sm tracking-widest text-paper/80">WHO GAVE THE ORDERS?</p>
              </div>
              {/* revealed side */}
              <div
                className="absolute inset-0 flex flex-col items-center justify-center rounded-lg bg-paper p-3 text-center text-ink shadow-[0_0_60px_rgba(244,185,66,0.45)]"
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
              >
                <StudentAvatar student={boss} size={84} />
                <p className="mt-1 text-lg leading-tight font-bold">{boss.name}</p>
                <p className="font-mono text-xs text-ink/70">{boss.id}</p>
                <motion.span
                  className="mt-2 border-4 border-oxblood px-3 py-0.5 font-type text-xl tracking-widest text-oxblood"
                  initial={false}
                  animate={revealed ? { scale: 1, opacity: 1, rotate: -12 } : { scale: reducedMotion ? 1 : 2.6, opacity: 0, rotate: -12 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 16, delay: dur(0.55) }}
                >
                  MASTERMIND
                </motion.span>
              </div>
            </motion.div>
          </div>
        </div>

        <div className="no-print mt-2">
          <Conversation
            lines={script}
            index={dialogue.index}
            onAdvance={dialogue.advance}
            onSkip={dialogue.skip}
            auto={dialogue.auto}
            onToggleAuto={dialogue.toggleAuto}
            active={active}
            reducedMotion={reducedMotion}
          />
        </div>
      </div>

      {/* ================= right: the case summary ================= */}
      <div className="result-details flex min-h-0 flex-col gap-4 overflow-y-auto pr-1">
        {/* verdict */}
        <motion.section
          className="rounded-lg border border-amber/40 bg-[#1b1714]/90 p-4"
          initial={{ opacity: 0, x: 30 }}
          animate={started ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: dur(0.3), duration: dur(0.5) }}
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-paper/70">VERDICT</p>
          <p className="mt-1 text-sm text-paper">
            {bossFlags === 0 ? 'No rule flags on record for the mastermind.' : `${bossFlags} minor flag${bossFlags === 1 ? '' : 's'} on record for the mastermind.`}{' '}
            <b className="text-amber">{metAll ? `But met all ${six.length} conspirators.` : `But met ${metTotal} of ${six.length} conspirators.`}</b>
          </p>
        </motion.section>

        {/* funnel: how we narrowed it down */}
        <motion.section
          className="rounded-lg border border-paper/15 bg-[#1b1714]/90 p-4"
          initial={{ opacity: 0, x: 30 }}
          animate={started ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: dur(0.5), duration: dur(0.5) }}
        >
          <p className="mb-3 font-type text-sm tracking-[0.25em] text-amber">HOW WE GOT HERE</p>
          <ol className="space-y-2.5">
            {funnel.map((f, i) => (
              <li key={f.label}>
                <div className="mb-1 flex justify-between text-xs text-paper/80">
                  <span>{f.label}</span>
                  <span className="font-mono text-paper">
                    <CountUp to={f.n} delay={started ? 0.8 + i * 0.35 : 99} reducedMotion={reducedMotion} />
                  </span>
                </div>
                <div className="h-2.5 rounded-full bg-paper/10">
                  <motion.div
                    className="h-2.5 rounded-full"
                    style={{ background: f.colour }}
                    initial={{ width: 0 }}
                    animate={started ? { width: `${Math.max(3, (f.n / funnel[0].n) * 100)}%` } : {}}
                    transition={{ delay: dur(0.8 + i * 0.35), duration: dur(0.8), ease: 'easeOut' }}
                  />
                </div>
              </li>
            ))}
          </ol>
        </motion.section>

        {/* other strange data */}
        <motion.section
          className="flex min-h-0 flex-1 flex-col rounded-lg border border-paper/15 bg-[#1b1714]/90 p-4 print:overflow-visible"
          initial={{ opacity: 0, x: 30 }}
          animate={started ? { opacity: 1, x: 0 } : {}}
          transition={{ delay: dur(0.7), duration: dur(0.5) }}
        >
          <div className="mb-2 flex items-center justify-between">
            <p className="font-type text-sm tracking-[0.25em] text-amber">OTHER STRANGE DATA</p>
            <span className="font-mono text-xs text-paper/70">{c.oddities.length} found</span>
          </div>
          <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
            <AnimatePresence initial={false}>
              {oddities.map((o, i) => (
                <motion.li
                  key={o.id}
                  className="rounded border-l-2 border-amber/70 bg-black/25 px-3 py-2"
                  initial={{ opacity: 0, y: 10 }}
                  animate={started ? { opacity: 1, y: 0 } : {}}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: dur(showAllOdd ? 0 : 1.2 + i * 0.12), duration: dur(0.3) }}
                >
                  <p className="text-xs font-semibold text-paper">{o.title}</p>
                  <p className="text-xs text-paper/70">{o.detail}</p>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {c.oddities.length > ODDITIES_PREVIEW && (
            <button type="button" onClick={() => setShowAllOdd((v) => !v)} className="no-print mt-2 self-start text-xs text-amber underline-offset-2 hover:underline">
              {showAllOdd ? 'Show fewer' : `Show all ${c.oddities.length}`}
            </button>
          )}
        </motion.section>

        <div className="no-print flex gap-3">
          <button type="button" onClick={onReplay} className="flex-1 rounded border border-paper/30 px-4 py-2 text-sm hover:border-amber">
            ↺ Replay investigation
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 rounded bg-amber px-4 py-2 font-type text-sm tracking-widest text-ink hover:brightness-110"
          >
            Download case summary
          </button>
        </div>

      </div>

      <Caption>The kingpin and how we know.</Caption>

      <article className="case-dossier" aria-label="Printable case file summary">
        <header className="dossier-header">
          <div className="dossier-topline">
            <span>Campus Security Division</span>
            <span>Internal · Confidential</span>
          </div>
          <div className="dossier-title-row">
            <div>
              <p className="dossier-kicker">Investigation file / 1105</p>
              <h1>Case closed</h1>
              <p className="dossier-subtitle">{c.meta.case_name} <span>·</span> {c.meta.day_label}</p>
            </div>
            <div className="dossier-stamp" aria-label="Case status closed">Case<br />closed</div>
          </div>
        </header>

        <section className="dossier-verdict" aria-labelledby="dossier-verdict-title">
          <div className="dossier-verdict-mark" aria-hidden="true">✓</div>
          <div>
            <p className="dossier-section-label">Final finding</p>
            <h2 id="dossier-verdict-title">Mastermind identified</h2>
            <p><strong>{boss.name}</strong> ({boss.id}) has no hard-rule flags on record and met {metTotal} of {six.length} identified conspirators{metAll ? ' — all of them.' : '.'}</p>
          </div>
        </section>

        <section className="dossier-metrics" aria-label="Case figures">
          <div><strong>{c.students.length}</strong><span>students reviewed</span></div>
          <div><strong>{shortlistSize}</strong><span>initial shortlist</span></div>
          <div><strong>{six.length}</strong><span>conspirators identified</span></div>
          <div><strong>{c.oddities.length}</strong><span>other anomalies</span></div>
        </section>

        <section className="dossier-suspects" aria-labelledby="dossier-suspects-title">
          <div className="dossier-section-heading">
            <div><p className="dossier-section-label">Evidence register</p><h2 id="dossier-suspects-title">Conspirators &amp; contact evidence</h2></div>
            <span>{links.length} linked to the mastermind</span>
          </div>
          <div className="dossier-suspect-grid">
            {links.map((link, index) => (
              <section className="dossier-suspect" key={link.student.id}>
                <div className="dossier-suspect-heading">
                  <span className="dossier-index">{String(index + 1).padStart(2, '0')}</span>
                  <div><h3>{link.student.name}</h3><p>Student ID · {link.student.id}</p></div>
                  <span className="dossier-suspect-tag">Conspirator</span>
                </div>
                {link.meeting && (
                  <p className="dossier-contact"><strong>Mastermind contact</strong> {places.get(link.meeting.building_id) ?? link.meeting.building_id} · {clock(link.meeting.start)}–{clock(link.meeting.end)} · {link.meeting.minutes} min</p>
                )}
                <ul className="dossier-evidence">
                  {link.flags.length > 0 ? link.flags.map((flag) => (
                    <li key={flag.id}><strong>{flag.title}</strong><span>{flag.detail}</span></li>
                  )) : <li><span>No rule flags recorded.</span></li>}
                </ul>
              </section>
            ))}
          </div>
        </section>

        <section className="dossier-method" aria-label="Investigation funnel">
          <p className="dossier-section-label">How the case was narrowed</p>
          <div>{funnel.map((item, index) => <span key={item.label}><strong>{item.n}</strong> {item.label}{index < funnel.length - 1 && <i aria-hidden="true">→</i>}</span>)}</div>
        </section>

        <section className="dossier-oddities" aria-labelledby="dossier-oddities-title">
          <div className="dossier-section-heading">
            <div><p className="dossier-section-label">Supplementary notes</p><h2 id="dossier-oddities-title">Other strange data</h2></div>
            <span>{c.oddities.length} recorded</span>
          </div>
          <ol>{c.oddities.map((oddity) => (
            <li key={oddity.id}><strong>{oddity.title}</strong><span>{oddity.detail}</span></li>
          ))}</ol>
        </section>

        <footer className="dossier-footer">
          <span>Case File #1105 · {c.meta.day_label}</span>
          <span>Findings generated from the evidence and rules in this case file.</span>
        </footer>
      </article>
    </div>
  )
}
