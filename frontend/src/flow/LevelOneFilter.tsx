import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, animate, motion } from 'framer-motion'
import type { Case, Student } from '../types/case'
import { StudentAvatar } from './avatars'
import Conversation, { useDialogue } from './Conversation'
import type { Level1Stage, Line } from './dialogue'
import FilterBasis, { type BasisRow } from './FilterBasis'
import type { PageProps } from './Register'
import { RULE_LABEL, clock, type Shortlist } from './shortlist'
import { play } from './sound'
import { Caption } from './TitleCard'

/** 0 = everyone · 1 = who broke a rule · 2 = who met them · 3 = filter falls away · 4 = shortlist ready */
type Stage = 0 | 1 | 2 | 3 | 4

/** Which visual stage each dialogue line triggers. */
const STAGE_OF: Record<Level1Stage, Stage> = { all: 0, rules: 0, breakers: 1, hold: 1, contacts: 2, collapse: 3 }

const STAGE_TEXT: Record<Stage, [string, string]> = {
  0: ['Everyone on campus', 'Every card is one student from the security logs.'],
  1: ['Who broke a rule?', 'Red cards have at least one rule-break in the data.'],
  2: ['Who spent time with them?', 'Amber cards spent the most time with the rule-breakers.'],
  3: ['Filtering…', 'Everyone else falls away.'],
  4: ['Level 1 shortlist', 'Click a card to open their file.'],
}

/** Side drawer: one student's flags and meetings. Reused on Level 2. */
export function StudentDrawer({
  c,
  student,
  highlight,
  onClose,
}: {
  c: Case
  student: Student | null
  /** Partner IDs to highlight in red (e.g. rule-breakers). */
  highlight: Set<string>
  onClose: () => void
}) {
  const names = useMemo(() => new Map(c.students.map((s) => [s.id, s.name])), [c.students])
  const places = useMemo(() => new Map(c.buildings.map((b) => [b.id, b.name])), [c.buildings])
  const flags = student ? c.flags.filter((f) => f.student_id === student.id) : []
  const meetings = student
    ? c.meetings
        .filter((m) => m.a === student.id || m.b === student.id)
        .map((m) => ({ ...m, other: m.a === student.id ? m.b : m.a }))
        .sort((a, b) => Number(highlight.has(b.other)) - Number(highlight.has(a.other)) || a.start - b.start)
    : []

  return (
    <AnimatePresence>
      {student && (
        <motion.aside
          key={student.id}
          className="absolute top-12 right-0 z-30 flex h-[calc(100%-3rem)] w-[min(400px,90vw)] flex-col border-l border-paper/15 bg-[#1b1714] shadow-2xl"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={{ type: 'tween', duration: 0.3 }}
          aria-label={`File for ${student.name}`}
        >
          <div className="flex items-center gap-3 border-b border-paper/10 p-5">
            <StudentAvatar student={student} size={56} />
            <div className="flex-1">
              <p className="text-lg font-semibold">{student.name}</p>
              <p className="font-mono text-xs text-paper/60">
                {student.id} · {student.subject} · {student.age}
              </p>
            </div>
            <button type="button" onClick={onClose} className="px-2 text-2xl text-paper/60 hover:text-paper" aria-label="Close">
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-5">
            <h4 className="mb-2 font-type tracking-widest text-alarm">Flags ({flags.length})</h4>
            {flags.length === 0 && <p className="mb-4 text-sm text-paper/70">No rule broken.</p>}
            <ul className="mb-6 space-y-3">
              {flags.map((f) => (
                <li key={f.id} className="border-l-2 border-red pl-3">
                  <p className="text-sm font-semibold">
                    {f.title}
                    {f.time != null && <span className="ml-2 font-mono text-xs text-paper/70">{clock(f.time)}</span>}
                  </p>
                  <p className="text-xs text-paper/70">{f.detail}</p>
                </li>
              ))}
            </ul>
            <h4 className="mb-2 font-type tracking-widest text-amber">Meetings ({meetings.length})</h4>
            <ul className="space-y-1 font-mono text-xs">
              {meetings.map((m) => (
                <li key={m.id} className={highlight.has(m.other) ? 'text-alarm' : 'text-paper/60'}>
                  {clock(m.start)}–{clock(m.end)} · {places.get(m.building_id) ?? m.building_id} · {names.get(m.other) ?? m.other}
                </li>
              ))}
            </ul>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
  )
}

interface Props extends PageProps {
  shortlist: Shortlist
  script: Line<Level1Stage>[]
}

export default function LevelOneFilter({ c, active, reducedMotion, onNext, shortlist, script }: Props) {
  const dialogue = useDialogue(script.length, active)
  const line = script[dialogue.index]
  const base: Stage = line ? STAGE_OF[line.stage] : 0
  const [settled, setSettled] = useState(false) // stage 3 → 4 once the cards have flown together
  const stage: Stage = base === 3 && settled ? 4 : base
  const [count, setCount] = useState(c.students.length)
  const [openId, setOpenId] = useState<string | null>(null)
  if (base < 3 && settled) setSettled(false)

  const ruleIds = useMemo(() => new Set(shortlist.ruleBreakers.map((s) => s.id)), [shortlist])
  const contactIds = useMemo(() => new Set(shortlist.contacts.map((s) => s.id)), [shortlist])

  const ruleChips = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of c.flags) if (ruleIds.has(f.student_id)) counts.set(f.rule, (counts.get(f.rule) ?? 0) + 1)
    return [...counts.entries()].sort((a, b) => b[1] - a[1])
  }, [c.flags, ruleIds])

  const allRuleCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const f of c.flags) counts.set(f.rule, (counts.get(f.rule) ?? 0) + 1)
    return Object.keys(RULE_LABEL).map((r) => [r, counts.get(r) ?? 0] as const)
  }, [c.flags])

  // Each new stage: a soft whoosh (plus ticking for the counter drop).
  useEffect(() => {
    if (!active || base === 0) return
    play('whoosh')
    if (base === 3) play('ticking')
  }, [base, active])

  // Stage 3 → 4 after the fall-away / fly-together animation.
  useEffect(() => {
    if (base !== 3) return
    const t = window.setTimeout(() => setSettled(true), reducedMotion ? 100 : 1600)
    return () => clearTimeout(t)
  }, [base, reducedMotion])

  // Big counter 163 → 25 when the filter drops.
  useEffect(() => {
    if (stage !== 3) return
    const controls = animate(c.students.length, shortlist.all.length, {
      duration: reducedMotion ? 0 : 1.4,
      ease: 'easeOut',
      onUpdate: (v) => setCount(Math.round(v)),
    })
    return () => controls.stop()
  }, [stage, c.students.length, shortlist.all.length, reducedMotion])

  const replay = () => {
    setOpenId(null)
    dialogue.reset()
  }

  // Filter basis: rule · threshold · before → after, one row per step reached so far.
  const total = c.students.length
  const basisRows: BasisRow[] = [
    ...(base >= 1
      ? [{ key: 'breakers', label: 'Broke at least one rule', threshold: 'suspicion score > 0', before: total, after: shortlist.ruleBreakers.length, state: base === 1 ? 'active' : 'done' } as BasisRow]
      : []),
    ...(base >= 2
      ? [{
          key: 'contacts',
          label: 'Most time with rule-breakers',
          threshold: `top ${shortlist.contacts.length} · ranked by rule-breakers met, then minutes together`,
          before: total - shortlist.ruleBreakers.length,
          after: shortlist.contacts.length,
          state: base === 2 ? 'active' : 'done',
        } as BasisRow]
      : []),
    ...(base >= 3
      ? [{ key: 'shortlist', label: 'Level 1 shortlist', threshold: 'rule-breakers + their closest contacts', before: total, after: shortlist.all.length, state: 'active' } as BasisRow]
      : []),
  ]

  // Cards in view: everyone (sorted by ID) until the drop, then only survivors in shortlist order.
  const cards = useMemo(() => {
    if (stage >= 3) return shortlist.all
    return [...c.students].sort((a, b) => a.id.localeCompare(b.id))
  }, [stage, c.students, shortlist])

  // ---- connection lines (stage 2): measured from the card DOM positions ----
  const gridRef = useRef<HTMLDivElement>(null)
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const [centres, setCentres] = useState<Map<string, { x: number; y: number }>>(new Map())
  const measure = useCallback(() => {
    const grid = gridRef.current
    if (!grid) return
    const box = grid.getBoundingClientRect()
    const next = new Map<string, { x: number; y: number }>()
    cardRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect()
      next.set(id, { x: r.left - box.left + r.width / 2, y: r.top - box.top + grid.scrollTop + r.height / 2 })
    })
    setCentres(next)
  }, [])
  useLayoutEffect(() => {
    if (stage !== 2) return
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [stage, measure])

  const lines = useMemo(() => {
    if (stage !== 2) return []
    const out: { key: string; x1: number; y1: number; x2: number; y2: number }[] = []
    for (const contact of shortlist.contacts) {
      const from = centres.get(contact.id)
      if (!from) continue
      for (const rb of shortlist.stats.get(contact.id)?.met ?? []) {
        const to = centres.get(rb)
        if (to) out.push({ key: `${contact.id}-${rb}`, x1: from.x, y1: from.y, x2: to.x, y2: to.y })
      }
    }
    return out
  }, [stage, centres, shortlist])

  const [title, sub] = STAGE_TEXT[stage]
  const openStudent = openId ? (c.students.find((s) => s.id === openId) ?? null) : null
  const dur = (d: number) => (reducedMotion ? 0 : d)

  return (
    <div className="flex h-full flex-col px-6 pt-14 pb-10 md:px-12">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-paper/70">LEVEL 1 · FIRST SWEEP</p>
          <h2 className="font-type text-2xl tracking-widest">{title}</h2>
          <p className="text-sm text-paper/60">{sub}</p>
        </div>
        <div className="flex items-center gap-6">
          <div className="text-right">
            <p className="font-type text-5xl text-amber tabular-nums">{stage < 3 ? c.students.length : count}</p>
            <p className="text-xs tracking-widest text-paper/70 uppercase">students</p>
          </div>
          <button type="button" onClick={replay} className="rounded border border-paper/30 px-3 py-2 text-sm hover:border-amber">
            ↺ Replay
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded bg-amber px-4 py-2 font-type tracking-widest text-ink hover:brightness-110"
          >
            Next →
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 gap-4">
      <div className="flex min-w-0 flex-1 flex-col">
      {/* caption bar: the rules found, per rule */}
      <div className="mb-2 flex min-h-8 flex-wrap gap-2">
        {stage === 1 &&
          ruleChips.map(([rule, n], i) => (
            <motion.span
              key={rule}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: dur(i * 0.08) }}
              className="rounded-full border border-red/60 bg-red/10 px-3 py-1 text-xs text-alarm"
            >
              {RULE_LABEL[rule] ?? rule} ×{n}
            </motion.span>
          ))}
        {stage === 2 && (
          <span className="rounded-full border border-amber/60 bg-amber/10 px-3 py-1 text-xs text-amber">
            {shortlist.contacts.length} most-connected contacts · {shortlist.ruleBreakers.length} rule-breakers
          </span>
        )}
        {stage >= 3 && (
          <span className="rounded-full border border-paper/30 px-3 py-1 text-xs text-paper/70">
            {shortlist.ruleBreakers.length} rule-breakers + {shortlist.contacts.length} contacts = {shortlist.all.length}
          </span>
        )}
      </div>

      <div ref={gridRef} className="relative flex-1 overflow-y-auto px-1 pt-2 pb-10">
        <LayoutGroup>
          <motion.div
            layout
            className={
              stage >= 3
                ? 'mx-auto grid max-w-5xl grid-cols-5 gap-2'
                : 'grid grid-cols-[repeat(auto-fill,minmax(66px,1fr))] gap-1'
            }
          >
            <AnimatePresence mode="popLayout">
              {cards.map((s) => {
                const isRule = ruleIds.has(s.id)
                const isContact = contactIds.has(s.id)
                const red = stage >= 1 && isRule
                const amber = stage >= 2 && isContact
                const dim = stage === 2 && !isRule && !isContact
                const met = shortlist.stats.get(s.id)?.met.length ?? 0
                return (
                  <motion.div
                    key={s.id}
                    layout
                    ref={(el) => {
                      if (el) cardRefs.current.set(s.id, el)
                      else cardRefs.current.delete(s.id)
                    }}
                    initial={false}
                    animate={{
                      opacity: dim ? 0.35 : 1,
                      y: red && stage < 3 ? -3 : 0,
                      scale: red && stage < 3 ? 1.06 : 1,
                    }}
                    exit={{ opacity: 0, scale: 0.4, y: 60, transition: { duration: dur(0.6) } }}
                    transition={{ duration: dur(0.5), layout: { duration: dur(0.8), ease: 'easeInOut' } }}
                    className={[
                      'relative rounded border text-center',
                      stage >= 4 ? 'cursor-pointer' : '',
                      red
                        ? 'border-red bg-red/15 shadow-[0_0_14px_rgba(224,82,82,0.55)]'
                        : amber
                          ? 'border-amber bg-amber/10 shadow-[0_0_12px_rgba(244,185,66,0.45)]'
                          : 'border-paper/15 bg-[#221d19]',
                    ].join(' ')}
                    onClick={() => stage >= 4 && setOpenId(s.id)}
                  >
                    {stage >= 4 ? (
                      <div className="flex items-center gap-2 p-2 text-left">
                        <StudentAvatar student={s} size={36} />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{s.name}</p>
                          <p className="font-mono text-[11px] text-paper/60">{s.id}</p>
                          <span
                            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[9px] font-semibold whitespace-nowrap ${
                              isRule ? 'bg-alarm text-ink' : 'bg-amber text-ink'
                            }`}
                          >
                            {isRule ? 'Rule-breaker' : `Met ${met} rule-breaker${met === 1 ? '' : 's'}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="block px-1 py-1 font-mono text-[10px] text-paper/80">{s.id}</span>
                    )}
                    {stage === 2 && isContact && (
                      <span className="absolute -top-2 -right-2 z-10 rounded-full bg-amber px-1.5 text-[10px] font-bold text-ink">
                        {met}
                      </span>
                    )}
                  </motion.div>
                )
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>

        {/* thin animated lines: contacts → the rule-breakers they met */}
        {stage === 2 && (
          <svg className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
            {lines.map((l, i) => (
              <motion.path
                key={l.key}
                d={`M${l.x1},${l.y1} L${l.x2},${l.y2}`}
                stroke="#f4b942"
                strokeOpacity={0.45}
                strokeWidth={1}
                fill="none"
                initial={{ pathLength: 0 }}
                animate={{ pathLength: 1 }}
                transition={{ duration: dur(0.8), delay: dur((i % 40) * 0.02) }}
              />
            ))}
          </svg>
        )}
      </div>
      </div>

      <FilterBasis title="Filter basis" rows={basisRows}>
        {dialogue.index >= 1 && (
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-widest text-paper/70 uppercase">Rule checks · flags found</p>
            <ul className="space-y-0.5 font-mono text-[11px]">
              {allRuleCounts.map(([rule, n]) => (
                <li key={rule} className={`flex justify-between ${n ? 'text-paper' : 'text-paper/60'}`}>
                  <span>{RULE_LABEL[rule]}</span>
                  <span className={n ? 'text-alarm' : ''}>{n}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </FilterBasis>
      </div>

      <div className="mt-2">
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

      <StudentDrawer c={c} student={openStudent} highlight={ruleIds} onClose={() => setOpenId(null)} />
      <Caption>We keep anyone who broke a rule, plus the people they spent the most time with.</Caption>
    </div>
  )
}
