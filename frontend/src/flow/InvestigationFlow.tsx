import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'
import { loadCase } from '../api/client'
import type { Case } from '../types/case'
import Background from './Background'
import BriefingScene from './BriefingScene'
import { buildScripts } from './dialogue'
import CaseFileLogin from './CaseFileLogin'
import FinalResult from './FinalResult'
import LevelOneFilter from './LevelOneFilter'
import LevelTwoSix from './LevelTwoSix'
import MovementChart from './MovementChart'
import Register from './Register'
import { getShortlist } from './shortlist'
import { isMuted, onMuteChange, play, setMuted } from './sound'
import TitleCard from './TitleCard'

const STAGES = ['Register', 'Level 1', 'Level 2', 'Movement', 'Closed'] as const
const LAST_STEP = 5

/** Hidden judge flag: `?judge=1` skips the login and the title-card delays. */
function isJudge(): boolean {
  return new URLSearchParams(window.location.search).get('judge') === '1'
}

/** Speaker toggle (top-right); the choice is remembered in localStorage. */
function MuteButton() {
  const [muted, setLocal] = useState(isMuted)
  useEffect(() => onMuteChange(setLocal), [])
  return (
    <button
      type="button"
      onClick={() => setMuted(!muted)}
      aria-pressed={muted}
      aria-label={muted ? 'Unmute sound' : 'Mute sound'}
      title={muted ? 'Sound off' : 'Sound on'}
      className="no-print fixed top-2 right-3 z-50 flex h-9 w-9 items-center justify-center rounded-full border border-paper/20 bg-night/80 text-paper hover:border-amber"
    >
      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M4 9v6h4l5 4V5L8 9H4z" fill="currentColor" />
        {muted ? <path d="M17 9l5 6M22 9l-5 6" /> : <path d="M17 8.5a5 5 0 0 1 0 7M19.5 6a8.5 8.5 0 0 1 0 12" />}
      </svg>
    </button>
  )
}

export default function InvestigationFlow() {
  const [judge] = useState(isJudge)
  const reducedMotion = useReducedMotion() ?? false
  const [c, setCase] = useState<Case | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [unlocked, setUnlocked] = useState(judge)
  const [step, setStep] = useState(judge ? 1 : 0)
  const [title, setTitle] = useState<string | null>(null)
  const [replayKey, setReplayKey] = useState(0)
  const seen = useRef(new Set<number>())
  // Pages whose title card has been triggered (state, so the "active" check re-renders).
  const [introduced, setIntroduced] = useState<number[]>([])
  /** The opening briefing scene plays once, right after the case file opens (skipped in judge mode). */
  const [briefing, setBriefing] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const sections = useRef(new Map<number, HTMLElement>())
  const programmatic = useRef(0)

  useEffect(() => {
    loadCase()
      .then(setCase)
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [])

  const shortlist = useMemo(() => (c ? getShortlist(c) : null), [c])
  const scripts = useMemo(() => (c && shortlist ? buildScripts(c, shortlist) : null), [c, shortlist])

  // Judge mode always starts with sound on (master volume 0.4), without overwriting the saved choice.
  useEffect(() => {
    if (judge) setMuted(false, false)
  }, [judge])

  // Page-turn sound whenever the page changes.
  const lastStep = useRef(step)
  useEffect(() => {
    if (step !== lastStep.current && step >= 1) play('pageturn')
    lastStep.current = step
  }, [step])

  const titleFor = useCallback(
    (s: number): string | null => {
      if (!c) return null
      return (
        {
          1: `THE REGISTER · ${c.students.length} STUDENTS ON CAMPUS`,
          2: 'LEVEL 1 · FIRST SWEEP',
          3: 'LEVEL 2 · THE SIX',
          4: 'LEVEL 3 · FOLLOW THE MOVEMENT',
          5: 'CASE CLOSED',
        }[s] ?? null
      )
    },
    [c],
  )

  // Show the title card the first time each page is reached.
  useEffect(() => {
    if (!c || step === 0 || briefing || seen.current.has(step)) return
    seen.current.add(step)
    setIntroduced((prev) => [...prev, step])
    if (!judge) setTitle(titleFor(step))
  }, [step, c, judge, titleFor, briefing])

  const goTo = useCallback(
    (s: number) => {
      if (!unlocked) return
      const next = Math.max(1, Math.min(LAST_STEP, s))
      setStep(next)
      const el = sections.current.get(next)
      if (el) {
        // ignore scroll-observer updates while we scroll on purpose
        window.clearTimeout(programmatic.current)
        programmatic.current = window.setTimeout(() => (programmatic.current = 0), 900)
        el.scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth', block: 'start' })
      }
    },
    [unlocked, reducedMotion],
  )

  // Scrolling by hand also changes the step (scroll-snap lands on whole pages).
  useEffect(() => {
    if (!unlocked || !scroller.current) return
    const io = new IntersectionObserver(
      (entries) => {
        if (programmatic.current) return
        for (const e of entries) {
          if (e.isIntersecting) setStep(Number((e.target as HTMLElement).dataset.step))
        }
      },
      { root: scroller.current, threshold: 0.6 },
    )
    sections.current.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [unlocked, c, replayKey])

  // Keyboard ← →
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') goTo(step + 1)
      if (e.key === 'ArrowLeft') goTo(step - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [goTo, step])

  const closeTitle = useCallback(() => setTitle(null), [])

  const unlock = () => {
    setUnlocked(true)
    setStep(1)
    if (!judge) setBriefing(true)
  }
  const endBriefing = useCallback(() => setBriefing(false), [])

  const replay = () => {
    seen.current.clear()
    setIntroduced([])
    setReplayKey((k) => k + 1)
    setStep(1)
    requestAnimationFrame(() => scroller.current?.scrollTo({ top: 0, behavior: 'auto' }))
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-type text-2xl text-alarm">The case file could not be opened.</p>
        <pre className="max-w-2xl font-mono text-xs whitespace-pre-wrap text-paper/60">{error}</pre>
        <p className="text-sm text-paper/60">Start the API (port 8000) or make sure public/case.json exists, then reload.</p>
      </div>
    )
  }
  if (!c || !shortlist || !scripts) {
    return <div className="flex h-full items-center justify-center font-type text-xl tracking-widest text-paper/60">Opening case file…</div>
  }

  // A page is active once its title card has been shown and closed (judge mode has no title cards).
  const pageActive = (s: number) => step === s && !title && !briefing && introduced.includes(s)
  const ref = (s: number) => (el: HTMLElement | null) => {
    if (el) sections.current.set(s, el)
    else sections.current.delete(s)
  }
  const common = { c, reducedMotion }

  return (
    <>
      <Background step={step} />
      <MuteButton />
      {/* progress bar: 5 stages */}
      {unlocked && (
        <nav className="no-print fixed inset-x-0 top-0 z-40 flex gap-1 bg-night/80 py-2 pr-16 pl-4 backdrop-blur" aria-label="Investigation progress">
          {STAGES.map((label, i) => {
            const s = i + 1
            return (
              <button
                key={label}
                type="button"
                onClick={() => goTo(s)}
                className="group flex flex-1 flex-col gap-1 text-left"
                aria-current={step === s ? 'step' : undefined}
              >
                <span className={`h-1 rounded-full transition-colors ${s <= step ? 'bg-amber' : 'bg-paper/15'}`} />
                <span className={`text-[10px] tracking-[0.2em] uppercase ${s === step ? 'text-amber' : 'text-paper/60 group-hover:text-paper/80'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </nav>
      )}

      <div ref={scroller} className="snap-flow relative z-10">
        {!unlocked && (
          <section className="snap-page">
            <CaseFileLogin c={c} onUnlock={unlock} reducedMotion={reducedMotion} />
          </section>
        )}
        {unlocked && (
          <div key={replayKey}>
            <section ref={ref(1)} data-step={1} className="snap-page">
              <Register {...common} active={pageActive(1)} onNext={() => goTo(2)} />
            </section>
            <section ref={ref(2)} data-step={2} className="snap-page">
              <LevelOneFilter {...common} shortlist={shortlist} script={scripts.level1} active={pageActive(2)} onNext={() => goTo(3)} />
            </section>
            <section ref={ref(3)} data-step={3} className="snap-page">
              <LevelTwoSix {...common} shortlist={shortlist} script={scripts.level2} threshold={scripts.vars.threshold} active={pageActive(3)} onNext={() => goTo(4)} />
            </section>
            <section ref={ref(4)} data-step={4} className="snap-page">
              <MovementChart {...common} shortlist={shortlist} script={scripts.level3} asides={scripts.level3Asides} active={pageActive(4)} onNext={() => goTo(5)} />
            </section>
            <section ref={ref(5)} data-step={5} className="snap-page print-me">
              <FinalResult {...common} script={scripts.final} active={pageActive(5)} onReplay={replay} />
            </section>
          </div>
        )}
      </div>

      {briefing && <BriefingScene c={c} reducedMotion={reducedMotion} onDone={endBriefing} />}
      <TitleCard text={title} duration={1500} reducedMotion={reducedMotion} onDone={closeTitle} />
    </>
  )
}
