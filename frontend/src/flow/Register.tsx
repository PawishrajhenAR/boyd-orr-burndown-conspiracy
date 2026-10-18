import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import type { Case, Student } from '../types/case'
import { StudentAvatar } from './avatars'
import { play } from './sound'
import { Caption } from './TitleCard'

const APPEAR_STAGGER_S = 0.015
const WAVE_STAGGER_S = 0.006 // ≈1 s across 163 tiles, + 250 ms flip ≈ 1.25 s
const WAVE_FLIP_S = 0.25

export interface PageProps {
  c: Case
  active: boolean
  reducedMotion: boolean
  onNext: () => void
}

/** ID card that flips (rotateY) to reveal the person behind the ID. */
export function StudentCard({
  student,
  flipped,
  onFlip,
  delay = 0,
  reducedMotion = false,
}: {
  student: Student
  flipped: boolean
  onFlip: () => void
  /** Wave delay in seconds (reading order × 6 ms); 0 for a single click. */
  delay?: number
  reducedMotion?: boolean
}) {
  const transition = { duration: delay ? WAVE_FLIP_S : 0.3, ease: 'easeOut' as const, delay }
  return (
    <button
      type="button"
      onClick={onFlip}
      className="flip h-44 w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-amber"
      aria-pressed={flipped}
      aria-label={flipped ? `${student.name}, ${student.id}` : `Student ${student.id} — click to reveal`}
    >
      <motion.div
        className="flip-inner relative h-full w-full"
        initial={false}
        animate={{ rotateY: reducedMotion ? 0 : flipped ? 180 : 0 }}
        transition={transition}
      >
        {/* front: only the ID (reduced motion: cross-fade instead of rotating) */}
        <motion.div
          className="flip-face absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-md border border-paper/15 bg-[#221d19]"
          initial={false}
          animate={{ opacity: reducedMotion && flipped ? 0 : 1 }}
          transition={reducedMotion ? { duration: 0.2 } : { duration: 0 }}
        >
          <span className="text-[10px] tracking-[0.3em] text-paper/60 uppercase">Student ID</span>
          <span className="font-mono text-base text-paper">{student.id}</span>
        </motion.div>
        {/* back: avatar, name, ID, subject */}
        <motion.div
          className="flip-face absolute inset-0 flex flex-col items-center justify-center rounded-md bg-paper px-2 text-ink"
          style={{ transform: reducedMotion ? undefined : 'rotateY(180deg)' }}
          initial={false}
          animate={{ opacity: reducedMotion && !flipped ? 0 : 1 }}
          transition={reducedMotion ? { duration: 0.2 } : { duration: 0 }}
        >
          <StudentAvatar student={student} size={72} />
          <span className="mt-1 text-center text-sm leading-tight font-semibold">{student.name}</span>
          <span className="font-mono text-[11px] text-ink/70">{student.id}</span>
          <span className="text-[10px] text-ink/70">{student.subject}</span>
        </motion.div>
      </motion.div>
    </button>
  )
}

export default function Register({ c, active, reducedMotion, onNext }: PageProps) {
  const [query, setQuery] = useState('')
  // A tile is flipped when `allFlipped` XOR the user clicked it (`overrides`).
  const [allFlipped, setAllFlipped] = useState(false)
  const [overrides, setOverrides] = useState<Set<string>>(new Set())
  const [waving, setWaving] = useState(false)
  const [started, setStarted] = useState(false)
  if (active && !started) setStarted(true)

  const runWave = (toBack: boolean) => {
    setOverrides(new Set())
    setAllFlipped(toBack)
    setWaving(true)
    play('shuffle') // one sound for the whole wave
  }

  // Once every tile has appeared, flip them all in a fast wave.
  const total = c.students.length
  useEffect(() => {
    if (!started) return
    const appear = (reducedMotion ? 0 : total * APPEAR_STAGGER_S * 1000) + 350
    const t = window.setTimeout(() => runWave(true), appear)
    return () => clearTimeout(t)
  }, [started, total, reducedMotion])

  useEffect(() => {
    if (!waving) return
    const t = window.setTimeout(() => setWaving(false), (total * WAVE_STAGGER_S + WAVE_FLIP_S) * 1000 + 100)
    return () => clearTimeout(t)
  }, [waving, total])

  const students = useMemo(() => {
    const q = query.trim().toLowerCase()
    const sorted = [...c.students].sort((a, b) => a.id.localeCompare(b.id))
    return q ? sorted.filter((s) => s.id.toLowerCase().includes(q) || s.name.toLowerCase().includes(q)) : sorted
  }, [c.students, query])

  const toggle = (id: string) => {
    play('flick')
    setOverrides((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div className="flex h-full flex-col px-6 pt-14 pb-12 md:px-12">
      <header className="mb-4 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="font-type text-3xl tracking-widest text-paper">The Register</h2>
          <p className="text-sm text-paper/60">
            {c.students.length} students on campus · click a card to see who it is
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search ID or name…"
            aria-label="Search students by ID or name"
            className="w-56 rounded border border-paper/20 bg-black/30 px-3 py-2 font-mono text-sm text-paper outline-none focus:border-amber"
          />
          <button
            type="button"
            onClick={() => runWave(!allFlipped)}
            aria-pressed={allFlipped}
            className="rounded border border-paper/30 px-3 py-2 text-sm hover:border-amber"
          >
            ⟲ Flip all
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded bg-amber px-4 py-2 font-type tracking-widest text-ink hover:brightness-110"
          >
            Begin investigation →
          </button>
        </div>
      </header>

      <motion.div
        className="grid flex-1 auto-rows-min grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3 overflow-y-auto pr-2 pb-10"
        initial="hidden"
        animate={started ? 'show' : 'hidden'}
        variants={{ hidden: {}, show: { transition: { staggerChildren: reducedMotion ? 0 : APPEAR_STAGGER_S } } }}
      >
        {students.map((s, i) => (
          <motion.div
            key={s.id}
            variants={{ hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } }}
            transition={{ duration: reducedMotion ? 0 : 0.25 }}
          >
            <StudentCard
              student={s}
              flipped={allFlipped !== overrides.has(s.id)}
              onFlip={() => toggle(s.id)}
              delay={waving && !reducedMotion && !overrides.has(s.id) ? i * WAVE_STAGGER_S : 0}
              reducedMotion={reducedMotion}
            />
          </motion.div>
        ))}
        {students.length === 0 && <p className="col-span-full text-paper/70">No student matches “{query}”.</p>}
      </motion.div>

      <Caption>This is everyone the security logs know about.</Caption>
    </div>
  )
}
