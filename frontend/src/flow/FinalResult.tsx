import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Meeting } from '../types/case'
import { StudentAvatar } from './avatars'
import Conversation, { useDialogue } from './Conversation'
import type { FinalStage, Line } from './dialogue'
import type { PageProps } from './Register'
import { clock, conspirators, mastermind } from './shortlist'
import { play } from './sound'
import { Caption } from './TitleCard'

interface Props extends Omit<PageProps, 'onNext'> {
  onReplay: () => void
  script: Line<FinalStage>[]
}

export default function FinalResult({ c, active, reducedMotion, onReplay, script }: Props) {
  const [started, setStarted] = useState(false)
  if (active && !started) setStarted(true)
  const dialogue = useDialogue(script.length, active)

  // Dramatic sting on the reveal, then the MASTERMIND stamp lands.
  useEffect(() => {
    if (!started) return
    play('sting')
    const t = window.setTimeout(() => play('stamp'), reducedMotion ? 0 : 650)
    return () => clearTimeout(t)
  }, [started, reducedMotion])

  const boss = useMemo(() => mastermind(c), [c])
  const six = useMemo(() => conspirators(c), [c])
  const places = useMemo(() => new Map(c.buildings.map((b) => [b.id, b.name])), [c.buildings])

  // For each conspirator: the longest meeting they had with the mastermind.
  const links = useMemo(() => {
    if (!boss) return []
    return six.map((s, i) => {
      const together = c.meetings.filter((m) => (m.a === boss.id && m.b === s.id) || (m.b === boss.id && m.a === s.id))
      const best = together.reduce<Meeting | null>((acc, m) => (!acc || m.minutes > acc.minutes ? m : acc), null)
      const angle = -Math.PI / 2 + (i * 2 * Math.PI) / six.length
      return { student: s, meeting: best, x: 50 + 42 * Math.cos(angle), y: 50 + 40 * Math.sin(angle), flags: c.flags.filter((f) => f.student_id === s.id && f.severity > 0) }
    })
  }, [boss, six, c.meetings, c.flags])

  const metAll = links.length > 0 && links.every((l) => l.meeting)
  const dur = (d: number) => (reducedMotion ? 0 : d)
  const show = started ? 'show' : 'hidden'

  if (!boss) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 px-6">
        <p className="font-type text-2xl text-paper/70">No single mastermind found in this case file.</p>
        <button type="button" onClick={onReplay} className="rounded border border-paper/30 px-4 py-2">Replay investigation</button>
        <Caption>The kingpin and how we know.</Caption>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col items-center px-6 pt-12 pb-12 md:px-12">
      <p className="font-mono text-xs tracking-[0.3em] text-paper/70">CASE CLOSED</p>

      <div className="result-network relative h-[min(50vh,520px)] w-[min(92vw,960px)] print:h-[480px]">
        {/* red lines to the centre, labelled with place + time */}
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
          {links.map((l, i) => (
            <motion.line
              key={l.student.id}
              x1={50}
              y1={50}
              x2={l.x}
              y2={l.y}
              stroke="#b3121b"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={started ? { pathLength: 1, opacity: 1 } : {}}
              transition={{ delay: dur(1 + i * 0.2), duration: dur(0.6) }}
            />
          ))}
        </svg>
        {links.map((l, i) =>
          l.meeting ? (
            <motion.span
              key={`label-${l.student.id}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded bg-night/90 px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-alarm"
              style={{ left: `${50 + (l.x - 50) * 0.6}%`, top: `${50 + (l.y - 50) * 0.62}%` }}
              initial={{ opacity: 0 }}
              animate={started ? { opacity: 1 } : {}}
              transition={{ delay: dur(1.4 + i * 0.2) }}
            >
              {places.get(l.meeting.building_id) ?? l.meeting.building_id} · {clock(l.meeting.start)}
            </motion.span>
          ) : null,
        )}

        {/* the six around the ring */}
        {links.map((l, i) => (
          <motion.div
            key={l.student.id}
            className="absolute flex w-32 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-md border border-red/70 bg-[#221d19] p-2 text-center"
            style={{ left: `${l.x}%`, top: `${l.y}%` }}
            initial="hidden"
            animate={show}
            variants={{ hidden: { opacity: 0, scale: 0.6 }, show: { opacity: 1, scale: 1 } }}
            transition={{ delay: dur(0.7 + i * 0.15), duration: dur(0.4) }}
          >
            <StudentAvatar student={l.student} size={36} />
            <p className="text-xs leading-tight font-semibold">{l.student.name}</p>
            <p className="font-mono text-[10px] text-paper/70">{l.student.id}</p>
          </motion.div>
        ))}

        {/* the mastermind in the centre */}
        <motion.div
          className="absolute top-1/2 left-1/2 flex w-48 -translate-x-1/2 -translate-y-1/2 flex-col items-center rounded-lg bg-paper p-3 text-center text-ink shadow-[0_0_40px_rgba(244,185,66,0.35)]"
          initial="hidden"
          animate={show}
          variants={{ hidden: { opacity: 0, scale: 0.8 }, show: { opacity: 1, scale: 1 } }}
          transition={{ duration: dur(0.5) }}
        >
          <StudentAvatar student={boss} size={56} />
          <p className="mt-1 text-lg font-bold">{boss.name}</p>
          <p className="font-mono text-xs text-ink/70">{boss.id}</p>
          <motion.span
            className="mt-2 border-4 border-oxblood px-3 py-0.5 font-type text-xl tracking-widest text-oxblood"
            initial={{ scale: reducedMotion ? 1 : 2.6, opacity: 0, rotate: -12 }}
            animate={started ? { scale: 1, opacity: 1, rotate: -12 } : {}}
            transition={{ type: 'spring', stiffness: 500, damping: 16, delay: dur(0.5) }}
          >
            MASTERMIND
          </motion.span>
        </motion.div>
      </div>

      <p className="mt-2 max-w-2xl text-center text-sm text-paper/80">
        {c.flags.some((flag) => flag.student_id === boss.id) ? 'Rule flags are recorded for the designated mastermind.' : 'No rule flags recorded for the designated mastermind.'}{' '}
        <b className="text-amber">
          {metAll ? `But met all ${six.length} conspirators.` : `But met ${links.filter((l) => l.meeting).length} of ${six.length} conspirators.`}
        </b>
      </p>

      <div className="result-details mt-3 flex min-h-0 w-full max-w-6xl flex-1 gap-4 overflow-hidden">
        <div className="no-print w-[26rem] shrink-0">
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
        <div className="min-h-0 flex-1 overflow-y-auto rounded border border-paper/10 bg-night/60 p-3 print:overflow-visible">
          <h4 className="mb-2 font-type tracking-widest text-amber">Other strange data</h4>
          <ul className="space-y-2">
            {c.oddities.map((o) => (
              <li key={o.id} className="text-xs">
                <b className="text-paper">{o.title}.</b> <span className="text-paper/70">{o.detail}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="no-print flex flex-col justify-start gap-2">
          <button type="button" onClick={onReplay} className="rounded border border-paper/30 px-4 py-2 text-sm hover:border-amber">
            ↺ Replay investigation
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded bg-amber px-4 py-2 font-type text-sm tracking-widest text-ink hover:brightness-110"
          >
            Download case summary
          </button>
        </div>
      </div>

      {/* print-only evidence summary */}
      <div className="hidden w-full max-w-4xl text-black print:block">
        <h3 className="mt-4 font-bold">Conspirators and evidence</h3>
        {links.map((l) => (
          <p key={l.student.id} className="text-xs">
            <b>{l.student.name}</b> ({l.student.id}): {l.flags.map((f) => f.title).join('; ')}
          </p>
        ))}
      </div>

      <Caption>The kingpin and how we know.</Caption>
    </div>
  )
}
