import { useCallback, useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { SPEAKERS, type Line, type Speaker } from './dialogue'
import { play } from './sound'

export const AUTO_LINE_MS = 2500

/** Flat speaker avatars: Morag (police cap), Ember (detective hat). */
function SpeakerAvatar({ speaker }: { speaker: Speaker }) {
  return speaker === 'morag' ? (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      <circle cx="20" cy="22" r="9" fill="#d9b79a" />
      <rect x="9" y="9" width="22" height="7" rx="2" fill="#23324a" />
      <rect x="7" y="15" width="26" height="3" rx="1.5" fill="#1a2436" />
      <rect x="14" y="11" width="12" height="2" fill="#efe6d2" opacity="0.7" />
      <path d="M6 40 Q8 31 20 30 Q32 31 34 40 Z" fill="#23324a" />
    </svg>
  ) : (
    <svg viewBox="0 0 40 40" width="36" height="36" aria-hidden="true">
      <circle cx="20" cy="22" r="9" fill="#d9b79a" />
      <path d="M8 16 Q20 3 32 16 Z" fill="#6b4a2f" />
      <rect x="5" y="15" width="30" height="3" rx="1.5" fill="#4a3220" />
      <path d="M6 40 Q8 31 20 30 Q32 31 34 40 Z" fill="#8a5a2b" />
    </svg>
  )
}

function Typed({ text, instant }: { text: string; instant: boolean }) {
  const [n, setN] = useState(instant ? text.length : 0)
  useEffect(() => {
    if (instant) return
    const step = Math.max(10, Math.min(28, 1100 / text.length)) // whole line in ≈1.1 s
    const id = window.setInterval(() => setN((k) => (k >= text.length ? k : k + 1)), step)
    return () => clearInterval(id)
  }, [text, instant])
  return <>{instant ? text : text.slice(0, n)}</>
}

interface Props {
  lines: Line[]
  /** Index of the latest line shown (-1 = none yet). */
  index: number
  onAdvance: () => void
  onSkip: () => void
  auto: boolean
  onToggleAuto: () => void
  /** Only the active page listens to keys and runs auto-play. */
  active: boolean
  /** Pause auto-play (e.g. while the chart is still playing). */
  blocked?: boolean
  reducedMotion: boolean
}

/** Police ⇄ investigator speech strip. Each new line triggers the page's next animation stage. */
export default function Conversation({ lines, index, onAdvance, onSkip, auto, onToggleAuto, active, blocked = false, reducedMotion }: Props) {
  const atEnd = index >= lines.length - 1
  const current = lines[index]

  // Soft blip per line; Morag lower, Ember higher.
  useEffect(() => {
    if (active && current) play('blip', { rate: current.speaker === 'morag' ? 0.8 : 1.3 })
  }, [active, index, current])

  // Auto-play: one line every 2.5 s.
  useEffect(() => {
    if (!active || !auto || atEnd || blocked) return
    const t = window.setTimeout(onAdvance, AUTO_LINE_MS)
    return () => clearTimeout(t)
  }, [active, auto, atEnd, blocked, index, onAdvance])

  // Space / → advance the dialogue first; at the end of the script → falls through to page navigation.
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if ((e.key === ' ' || e.key === 'ArrowRight') && !atEnd) {
        e.preventDefault()
        e.stopImmediatePropagation()
        onAdvance()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [active, atEnd, onAdvance])

  const visible = lines.slice(Math.max(0, index - 1), index + 1) // max 2 lines at once
  const first = Math.max(0, index - 1)

  return (
    <div className="flex w-full max-w-2xl flex-col gap-2" aria-live="polite">
      <div className="flex min-h-[7.5rem] flex-col justify-end gap-2">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((line, i) => {
            const isCurrent = first + i === index
            const who = SPEAKERS[line.speaker]
            return (
              <motion.div
                key={first + i}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: isCurrent ? 1 : 0.8, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: reducedMotion ? 0 : 0.25 }}
                className="flex items-end gap-2"
              >
                <SpeakerAvatar speaker={line.speaker} />
                <div
                  className={`rounded-lg rounded-bl-none border px-3 py-2 text-sm ${
                    line.speaker === 'morag' ? 'border-paper/20 bg-[#1f2530]' : 'border-amber/40 bg-[#2a2116]'
                  }`}
                >
                  <p className="text-[10px] font-semibold tracking-widest text-paper/70 uppercase">
                    {who.name} <span className="font-normal normal-case tracking-normal text-paper/60">· {who.role}</span>
                  </p>
                  <p className="text-paper">
                    {isCurrent ? <Typed key={first + i} text={line.text} instant={reducedMotion} /> : line.text}
                  </p>
                </div>
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
      <div className="flex items-center gap-2 pl-11 text-xs">
        <button
          type="button"
          onClick={onAdvance}
          disabled={atEnd}
          className="rounded bg-amber px-3 py-1.5 font-semibold text-ink hover:brightness-110 disabled:opacity-40"
        >
          Next line ▸
        </button>
        <button
          type="button"
          onClick={onToggleAuto}
          aria-pressed={auto}
          className={`rounded border px-3 py-1.5 ${auto ? 'border-amber text-amber' : 'border-paper/30 text-paper/80'}`}
        >
          {auto ? '❚❚ Auto' : '▶ Auto'}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={atEnd}
          className="rounded border border-paper/30 px-3 py-1.5 text-paper/80 hover:border-amber disabled:opacity-40"
        >
          Skip ⏭
        </button>
        <span className="ml-1 font-mono text-paper/60">
          {Math.max(0, index + 1)}/{lines.length} · Space / →
        </span>
      </div>
    </div>
  )
}

/** Dialogue state for a page: index, auto, advance/skip/reset. */
export function useDialogue(length: number, active: boolean, autoDefault = true) {
  const [index, setIndex] = useState(-1)
  const [auto, setAuto] = useState(autoDefault)
  // First line appears when the page is first shown.
  if (active && index === -1 && length > 0) setIndex(0)
  // Stable callbacks, so auto-play timers aren't restarted by unrelated re-renders.
  const advance = useCallback(() => setIndex((i) => Math.min(length - 1, i + 1)), [length])
  const skip = useCallback(() => setIndex(length - 1), [length])
  const reset = useCallback(() => setIndex(0), [])
  const toggleAuto = useCallback(() => setAuto((a) => !a), [])
  return { index, auto, advance, skip, reset, toggleAuto }
}
