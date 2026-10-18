import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { play } from './sound'

interface Props {
  /** Text to type; null hides the card. */
  text: string | null
  /** Total time on screen (ms). */
  duration?: number
  reducedMotion?: boolean
  onDone: () => void
}

/** One-line "what am I looking at" caption pinned to the bottom of every page. */
export function Caption({ children }: { children: string }) {
  return (
    <p className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-night via-night/90 to-transparent px-6 pt-6 pb-4 text-center text-sm text-paper/70">
      {children}
    </p>
  )
}

/** Black screen with typewriter text, shown between pages (≈1.5 s). */
export default function TitleCard({ text, duration = 1500, reducedMotion = false, onDone }: Props) {
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    if (!text) return
    setTyped(reducedMotion ? text.length : 0)
    // Type the text in the first ~60% of the time, hold for the rest.
    const perChar = reducedMotion ? 0 : Math.max(12, (duration * 0.6) / text.length)
    const timers: number[] = []
    if (!reducedMotion) {
      for (let i = 1; i <= text.length; i++) {
        timers.push(
          window.setTimeout(() => {
            setTyped(i)
            if (i % 2 === 0 && text[i - 1] !== ' ') play('key') // throttled: every 2nd letter
          }, perChar * i),
        )
      }
    }
    timers.push(window.setTimeout(onDone, duration))
    return () => timers.forEach(clearTimeout)
  }, [text, duration, reducedMotion, onDone])

  return (
    <AnimatePresence>
      {text && (
        <motion.div
          key={text}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2 }}
          onClick={onDone}
          role="status"
          aria-live="polite"
        >
          <p className="px-8 text-center font-type text-3xl tracking-[0.2em] text-paper md:text-5xl">
            {text.slice(0, typed)}
            <span className="caret text-amber">▌</span>
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
