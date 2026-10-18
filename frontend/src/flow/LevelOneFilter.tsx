import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, animate, motion } from 'framer-motion'
import type { Case, Student } from '../types/case'
import { StudentAvatar } from './avatars'
import Conversation from './Conversation'
import { useDialogue } from './useDialogue'
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
  0: ['Everyone on campus', 'Every face is one student from the security logs. Hover for name and ID.'],
  1: ['Who broke a rule?', 'Glowing red: students with at least one rule-break in the data.'],
  2: ['Who spent time with them?', 'Glowing amber: the students who met the most rule-breakers.'],
  3: ['Filtering…', 'Everyone else goes home. Rule-breakers move up, their contacts below.'],
  4: ['Level 1 shortlist', 'A line = they met. Hover to trace, click to open a file.'],
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
            <StudentAvatar student={student} size={64} />
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

  // ---- layout: stages 0–2 = every student as a face tile sized to fit; 3–4 = two tiers ----
  const areaRef = useRef<HTMLDivElement>(null)
  const [area, setArea] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setArea({ w: Math.floor(e.contentRect.width), h: Math.floor(e.contentRect.height) }))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Largest square tile that fits every student on screen without scrolling.
  const TILE_GAP = 6
  const tile = useMemo(() => {
    const n = c.students.length
    for (let s = 112; s > 34; s--) {
      const cols = Math.floor((area.w + TILE_GAP) / (s + TILE_GAP))
      const rows = Math.floor((area.h + TILE_GAP) / (s + TILE_GAP))
      if (cols * rows >= n) return s
    }
    return 34
  }, [area, c.students.length])

  const tiers = stage >= 3
  const compact = area.h > 0 && area.h < 560 // shorter screens: smaller faces + gap so 3 rows fit
  const everyone = useMemo(() => [...c.students].sort((a, b) => a.id.localeCompare(b.id)), [c.students])
  const cards = tiers ? shortlist.all : everyone
  const contactRank = useMemo(() => new Map(shortlist.contacts.map((s, i) => [s.id, i])), [shortlist])

  // ---- connection curves (stage 4): contact (top edge) → rule-breaker (bottom edge) ----
  const cardRefs = useRef(new Map<string, HTMLElement>())
  const [anchors, setAnchors] = useState<Map<string, { x: number; top: number; bottom: number }>>(new Map())
  const [focusId, setFocusId] = useState<string | null>(null)
  useLayoutEffect(() => {
    if (stage !== 4) return
    const box = areaRef.current?.getBoundingClientRect()
    if (!box) return
    const scrollTop = areaRef.current!.scrollTop
    const next = new Map<string, { x: number; top: number; bottom: number }>()
    cardRefs.current.forEach((el, id) => {
      const r = el.getBoundingClientRect()
      next.set(id, { x: r.left - box.left + r.width / 2, top: r.top - box.top + scrollTop, bottom: r.bottom - box.top + scrollTop })
    })
    setAnchors(next)
  }, [stage, area])

  const links = useMemo(() => {
    if (stage !== 4) return []
    const out: { key: string; from: string; to: string; d: string; rank: number }[] = []
    for (const contact of shortlist.contacts) {
      const a = anchors.get(contact.id)
      if (!a) continue
      for (const rb of shortlist.stats.get(contact.id)?.met ?? []) {
        const b = anchors.get(rb)
        if (!b) continue
        const midY = (a.top + b.bottom) / 2
        out.push({
          key: `${contact.id}-${rb}`,
          from: contact.id,
          to: rb,
          d: `M${a.x},${a.top} C${a.x},${midY} ${b.x},${midY} ${b.x},${b.bottom}`,
          rank: contactRank.get(contact.id) ?? 0,
        })
      }
    }
    return out
  }, [stage, anchors, shortlist, contactRank])

  // Who is linked to the hovered card (to highlight both ends).
  const linkedToFocus = useMemo(() => {
    if (!focusId) return null
    const ids = new Set<string>([focusId])
    for (const l of links) if (l.from === focusId || l.to === focusId) ids.add(l.from === focusId ? l.to : l.from)
    return ids
  }, [focusId, links])

  const [title, sub] = STAGE_TEXT[stage]
  const openStudent = openId ? (c.students.find((s) => s.id === openId) ?? null) : null
  const dur = (d: number) => (reducedMotion ? 0 : d)

  return (
    <div className="flex h-auto min-h-full flex-col px-4 pt-14 pb-14 md:h-full md:px-12 md:pb-10">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-paper/70">LEVEL 1 · FIRST SWEEP</p>
          <h2 className="font-type text-2xl tracking-widest">{title}</h2>
          <p className="text-sm text-paper/70">{sub}</p>
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

      <div className="flex min-h-[420px] flex-1 flex-col gap-4 md:min-h-0 md:flex-row">
      <div className="flex min-h-[240px] min-w-0 flex-1 flex-col md:min-h-0">
      {/* caption bar: what the colours mean right now */}
      <div className="mb-2 flex min-h-8 flex-wrap items-center gap-2">
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
          <>
            <span className="rounded-full border border-red/60 bg-red/10 px-3 py-1 text-xs text-alarm">● {shortlist.ruleBreakers.length} rule-breakers</span>
            <span className="rounded-full border border-amber/60 bg-amber/10 px-3 py-1 text-xs text-amber">
              ● {shortlist.contacts.length} who met them most · badge = how many of them they met
            </span>
          </>
        )}
        {stage >= 3 && (
          <span className="rounded-full border border-paper/30 px-3 py-1 text-xs text-paper/80">
            {shortlist.ruleBreakers.length} rule-breakers (top) + {shortlist.contacts.length} contacts (below) = {shortlist.all.length}
            {stage === 4 && ' · hover a card to trace who they met'}
          </span>
        )}
      </div>

      <div ref={areaRef} className="relative min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
        <LayoutGroup>
          <motion.div
            layout
            className={tiers ? 'flex flex-wrap content-start justify-center gap-[10px] px-1 pt-2' : 'grid content-start justify-center'}
            style={tiers ? undefined : { gridTemplateColumns: `repeat(auto-fill, ${tile}px)`, gap: TILE_GAP }}
          >
            <AnimatePresence mode="popLayout">
              {cards.flatMap((s, i) => {
                const isRule = ruleIds.has(s.id)
                const isContact = contactIds.has(s.id)
                const red = stage >= 1 && isRule
                const amber = stage >= 2 && isContact
                const dim = (stage === 1 && !isRule) || (stage === 2 && !isRule && !isContact)
                const met = shortlist.stats.get(s.id)?.met.length ?? 0
                const faded = !!linkedToFocus && !linkedToFocus.has(s.id)
                const card = (
                  <motion.div
                    key={s.id}
                    layout
                    ref={(el: HTMLDivElement | null) => {
                      if (el) cardRefs.current.set(s.id, el)
                      else cardRefs.current.delete(s.id)
                    }}
                    initial={false}
                    animate={{ opacity: dim ? 0.28 : faded ? 0.35 : 1, scale: !tiers && red ? 1.08 : 1 }}
                    exit={{ opacity: 0, scale: 0.3, y: 80, transition: { duration: dur(0.55), ease: 'easeIn' } }}
                    transition={{ duration: dur(0.45), layout: { duration: dur(0.9), ease: [0.22, 1, 0.36, 1] } }}
                    title={`${s.name} · ${s.id}`}
                    onMouseEnter={() => stage === 4 && setFocusId(s.id)}
                    onMouseLeave={() => setFocusId(null)}
                    onClick={() => stage >= 4 && setOpenId(s.id)}
                    style={
                      tiers
                        ? { width: isRule ? 'calc((100% - 60px) / 7)' : 'calc((100% - 80px) / 9)' }
                        : { width: tile, height: tile }
                    }
                    className={[
                      'relative rounded-lg border',
                      stage >= 4 ? 'cursor-pointer' : '',
                      red
                        ? 'z-[1] border-red bg-red/20 shadow-[0_0_18px_rgba(224,82,82,0.6)]'
                        : amber
                          ? 'z-[1] border-amber bg-amber/15 shadow-[0_0_16px_rgba(244,185,66,0.5)]'
                          : 'border-paper/10 bg-[#221d19]',
                    ].join(' ')}
                  >
                    {tiers ? (
                      <div className={`flex flex-col items-center text-center ${compact ? 'gap-1 p-1.5' : 'gap-2 p-2'}`}>
                        <StudentAvatar student={s} size={compact ? (isRule ? 40 : 30) : isRule ? 52 : 40} />
                        <div className="w-full min-w-0">
                          <p className="truncate text-[13px] leading-tight font-semibold">{s.name}</p>
                          <p className="font-mono text-[10px] text-paper/70">{s.id}</p>
                          <span
                            className={`mt-1 inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold whitespace-nowrap ${
                              isRule ? 'bg-alarm text-ink' : 'bg-amber text-ink'
                            }`}
                          >
                            {isRule ? 'Rule-breaker' : `Met ${met}`}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="flex h-full w-full items-center justify-center">
                        <StudentAvatar student={s} size={Math.max(24, tile - 10)} />
                      </div>
                    )}
                    {stage === 2 && isContact && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: dur((contactRank.get(s.id) ?? 0) * 0.05), type: 'spring', stiffness: 400, damping: 18 }}
                        className="absolute -top-2 -right-2 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-amber px-1 text-[11px] font-bold text-ink"
                      >
                        {met}
                      </motion.span>
                    )}
                  </motion.div>
                )
                // a full-width spacer between the rule-breaker row and the contacts: room for the curves
                return tiers && i === shortlist.ruleBreakers.length - 1
                  ? [card, <div key="tier-gap" className={`basis-full ${compact ? 'h-[clamp(36px,7vh,64px)]' : 'h-[clamp(48px,12vh,110px)]'}`} aria-hidden="true" />]
                  : [card]
              })}
            </AnimatePresence>
          </motion.div>
        </LayoutGroup>

        {/* curves: each contact → every rule-breaker they met */}
        {stage === 4 && (
          <svg className="pointer-events-none absolute inset-0 z-0 h-full w-full overflow-visible" aria-hidden="true">
            {links.map((l) => {
              const on = !focusId || l.from === focusId || l.to === focusId
              return (
                <motion.path
                  key={l.key}
                  d={l.d}
                  fill="none"
                  stroke="#f4b942"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: focusId ? (on ? 0.95 : 0.06) : 0.4, strokeWidth: focusId && on ? 2.2 : 1.2 }}
                  transition={{ pathLength: { duration: dur(0.7), delay: dur(l.rank * 0.07), ease: 'easeOut' }, opacity: { duration: dur(0.25) } }}
                />
              )
            })}
          </svg>
        )}
      </div>
      </div>

      <FilterBasis title="Filter basis" rows={basisRows} className="max-h-56 w-full md:max-h-none md:w-72">
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
