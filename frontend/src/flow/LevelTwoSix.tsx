import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, LayoutGroup, motion } from 'framer-motion'
import { StudentAvatar } from './avatars'
import Conversation from './Conversation'
import { useDialogue } from './useDialogue'
import type { Level2Stage, Line } from './dialogue'
import FilterBasis, { type BasisRow } from './FilterBasis'
import { StudentDrawer } from './LevelOneFilter'
import type { PageProps } from './Register'
import { RULE_LABEL, suspectMap, type Shortlist } from './shortlist'
import { play } from './sound'
import { Caption } from './TitleCard'

/** 0 = score bars · 1 = line drawn, below it dims · 2 = the six stamped · 3 = + the watch-list student */
type Phase = 0 | 1 | 2 | 3

const PHASE_OF: Record<Level2Stage, Phase> = { scores: 0, threshold: 1, six: 2, suspicious: 3 }
const STAMP_DELAY_S = 0.5
const STAMP_STEP_S = 0.12

interface Props extends PageProps {
  shortlist: Shortlist
  script: Line<Level2Stage>[]
  /** Lowest score that still counts as suspicious — the "line". */
  threshold: number
}

export default function LevelTwoSix({ c, active, reducedMotion, onNext, shortlist, script, threshold }: Props) {
  const dialogue = useDialogue(script.length, active)
  const line = script[dialogue.index]
  const phase: Phase = line ? PHASE_OF[line.stage] : 0
  const [openId, setOpenId] = useState<string | null>(null)

  const suspects = useMemo(() => suspectMap(c), [c])
  const ranked = useMemo(
    () => [...shortlist.all].sort((a, b) => (suspects.get(a.id)?.rank ?? 1e9) - (suspects.get(b.id)?.rank ?? 1e9)),
    [shortlist, suspects],
  )
  const verdictOf = (id: string) => suspects.get(id)?.verdict
  const scoreOf = (id: string) => suspects.get(id)?.score ?? 0
  const maxScore = Math.max(1, ...ranked.map((s) => scoreOf(s.id)))
  const sixIds = useMemo(() => new Set(c.suspects.filter((s) => s.verdict === 'conspirator').map((s) => s.student_id)), [c])
  const six = ranked.filter((s) => sixIds.has(s.id))
  const watch = ranked.filter((s) => verdictOf(s.id) === 'suspicious')
  const above = ranked.filter((s) => scoreOf(s.id) >= threshold)

  // Severity per rule, as found in the data (highest severity seen for that rule).
  const severities = useMemo(() => {
    const m = new Map<string, number>()
    for (const f of c.flags) m.set(f.rule, Math.max(m.get(f.rule) ?? 0, f.severity))
    return [...m.entries()].filter(([, s]) => s > 0).sort((a, b) => b[1] - a[1])
  }, [c.flags])

  const topFlags = (id: string) =>
    c.flags
      .filter((f) => f.student_id === id && f.severity > 0)
      .sort((a, b) => b.severity - a.severity)
      .slice(0, 2)

  // Sounds: whoosh when the line is drawn; one thud per CONSPIRATOR stamp as it lands
  // (also when Skip jumps straight past the "six" line).
  const prevPhase = useRef<Phase>(0)
  useEffect(() => {
    const from = prevPhase.current
    prevPhase.current = phase
    if (!active) return
    if (phase === 1) play('whoosh')
    if (!(phase >= 2 && from < 2)) return
    const timers = six.map((_, i) =>
      window.setTimeout(() => play('stamp'), (reducedMotion ? 0 : STAMP_DELAY_S + i * STAMP_STEP_S) * 1000 + 150),
    )
    return () => timers.forEach(clearTimeout)
  }, [phase, active])

  const cards = phase >= 2 ? [...six, ...(phase === 3 ? watch : [])] : ranked
  const dur = (d: number) => (reducedMotion ? 0 : d)
  const openStudent = openId ? (c.students.find((s) => s.id === openId) ?? null) : null

  const basisRows: BasisRow[] = [
    ...(phase >= 1
      ? [{ key: 'line', label: 'Score above the line', threshold: `score ≥ ${threshold}`, before: ranked.length, after: above.length, state: phase === 1 ? 'active' : 'done' } as BasisRow]
      : []),
    ...(phase >= 2
      ? [
          { key: 'top', label: `Top ${six.length} by score`, threshold: `rank ≤ ${six.length} above the line`, before: above.length, after: six.length, state: 'done' } as BasisRow,
          { key: 'result', label: 'Level 2 · the six', threshold: 'conspirators', before: ranked.length, after: six.length, state: phase === 2 ? 'active' : 'done' } as BasisRow,
        ]
      : []),
    ...(phase === 3 && watch.length
      ? [{ key: 'watch', label: 'Watch list', threshold: `above the line, outside the top ${six.length}`, before: above.length, after: watch.length, state: 'active' } as BasisRow]
      : []),
  ]

  return (
    <div className="flex h-auto min-h-full flex-col px-4 pt-14 pb-14 md:h-full md:px-12 md:pb-10">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-paper/70">LEVEL 2 · THE SIX</p>
          <h2 className="font-type text-2xl tracking-widest">
            {phase < 2 ? 'Suspicion score' : `${six.length} conspirators`}
          </h2>
          <p className="text-sm text-paper/70">Score = the sum of each distinct rule they broke.</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              setOpenId(null)
              dialogue.reset()
            }}
            className="rounded border border-paper/30 px-3 py-2 text-sm hover:border-amber"
          >
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
        <div className="relative min-h-[240px] min-w-0 flex-1 overflow-y-auto px-1 pt-3 pb-4 md:min-h-0">
          <LayoutGroup>
            <motion.div layout className={phase === 3 ? 'mx-auto grid max-w-5xl grid-cols-4 gap-3' : phase === 2 ? 'mx-auto grid max-w-4xl grid-cols-3 gap-4' : 'grid grid-cols-5 gap-2'}>
              <AnimatePresence mode="popLayout">
                {cards.map((s) => {
                  const score = scoreOf(s.id)
                  const isSix = sixIds.has(s.id)
                  const isWatch = phase === 3 && !isSix
                  const dim = phase === 1 && score < threshold
                  const big = phase >= 2
                  return (
                    <motion.button
                      type="button"
                      key={s.id}
                      layout
                      initial={false}
                      animate={{ opacity: dim ? 0.25 : 1 }}
                      exit={{ opacity: 0, x: 120, transition: { duration: dur(0.5) } }}
                      transition={{ duration: dur(0.4), layout: { duration: dur(0.7) } }}
                      onClick={() => setOpenId(s.id)}
                      className={`relative rounded-md border text-left ${big ? 'p-3' : 'p-2'} ${
                        isWatch ? 'border-amber bg-paper pb-12 text-ink' : big ? 'border-blood bg-paper pb-12 text-ink' : 'border-paper/15 bg-[#221d19]'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <StudentAvatar student={s} size={big ? 56 : 34} />
                        <div className="min-w-0">
                          <p className={`text-sm font-semibold ${big ? 'leading-tight' : 'truncate'}`}>{s.name}</p>
                          <p className={`font-mono text-[11px] ${big ? 'text-ink/70' : 'text-paper/70'}`}>{s.id}</p>
                        </div>
                      </div>
                      {/* score bar + the threshold line */}
                      <div className="mt-2 flex items-center gap-2">
                        <div className={`relative h-2 flex-1 rounded ${big ? 'bg-ink/10' : 'bg-paper/10'}`}>
                          <motion.div
                            className={`h-2 rounded ${isSix ? 'bg-red' : isWatch ? 'bg-amber' : 'bg-paper/50'}`}
                            initial={{ width: 0 }}
                            animate={{ width: active || dialogue.index >= 0 ? `${(score / maxScore) * 100}%` : 0 }}
                            transition={{ duration: dur(0.9), ease: 'easeOut' }}
                          />
                          {phase >= 1 && (
                            <motion.span
                              className="absolute -top-1 h-4 w-0.5 bg-amber"
                              style={{ left: `${(threshold / maxScore) * 100}%` }}
                              initial={{ scaleY: 0 }}
                              animate={{ scaleY: 1 }}
                              aria-hidden="true"
                            />
                          )}
                        </div>
                        <span className="w-5 text-right font-mono text-xs tabular-nums">{score}</span>
                      </div>
                      {big && (
                        <>
                          <ul className="mt-3 space-y-1 text-xs text-ink/80">
                            {topFlags(s.id).map((f) => (
                              <li key={f.id}>• {f.title}</li>
                            ))}
                          </ul>
                          <motion.span
                            className={`pointer-events-none absolute right-3 bottom-3 border-[3px] bg-paper/80 px-2 py-0.5 font-type text-sm tracking-widest ${
                              isWatch ? 'border-[#9a6a00] text-[#7a5200]' : 'border-blood text-blood'
                            }`}
                            initial={{ scale: reducedMotion ? 1 : 2.4, opacity: 0, rotate: -12 }}
                            animate={{ scale: 1, opacity: 1, rotate: -12 }}
                            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: dur(STAMP_DELAY_S + Math.max(0, six.indexOf(s)) * STAMP_STEP_S) }}
                          >
                            {isWatch ? 'WATCH' : 'CONSPIRATOR'}
                          </motion.span>
                        </>
                      )}
                    </motion.button>
                  )
                })}
              </AnimatePresence>
            </motion.div>
          </LayoutGroup>

          {phase >= 2 && (
            <motion.p
              className="mt-6 text-center font-type tracking-widest text-paper/70"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: dur(1.4) }}
            >
              Mastermind: data looks clean… for now.
            </motion.p>
          )}
        </div>

        <FilterBasis title="Filter basis" rows={basisRows} className="max-h-56 w-full md:max-h-none md:w-72">
          <div>
            <p className="mb-1 text-[11px] font-semibold tracking-widest text-paper/70 uppercase">Severity per rule (from the data)</p>
            <ul className="space-y-0.5 font-mono text-[11px] text-paper">
              {severities.map(([rule, sev]) => (
                <li key={rule} className="flex justify-between">
                  <span>{RULE_LABEL[rule] ?? rule}</span>
                  <span className="text-amber">{sev === 3 ? 'high 3' : sev === 2 ? 'med 2' : `low ${sev}`}</span>
                </li>
              ))}
            </ul>
          </div>
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

      <StudentDrawer c={c} student={openStudent} highlight={sixIds} onClose={() => setOpenId(null)} />
      <Caption>The six with the strongest rule-break evidence.</Caption>
    </div>
  )
}
