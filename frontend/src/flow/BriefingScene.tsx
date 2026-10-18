import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import type { Case } from '../types/case'
import { CharacterSprite, Typed, preloadCast } from './cast'
import { SPEAKERS } from './dialogue'
import { buildBriefing } from './scenes'
import { play } from './sound'

interface Props {
  c: Case
  reducedMotion: boolean
  /** Called once the scene ends or is skipped. */
  onDone: () => void
}

/** Opening briefing: Inspector Mathew and PC Morag talk through the tip before the first sweep. */
export default function BriefingScene({ c, reducedMotion, onDone }: Props) {
  const scene = useMemo(() => buildBriefing(c), [c])
  const [lineIdx, setLineIdx] = useState(0)
  const [typed, setTyped] = useState(false)
  const [ending, setEnding] = useState(false)
  const lastSpeaker = useRef<string | null>(null)
  const camera = useAnimationControls()

  const line = scene.lines[lineIdx]
  const lineKey = String(lineIdx)

  useEffect(() => preloadCast(), [])

  const finish = useCallback(() => {
    if (ending) return
    setEnding(true)
    play('pageturn')
    window.setTimeout(onDone, reducedMotion ? 0 : 750)
  }, [ending, onDone, reducedMotion])

  // Each new line: speaker-change swish, and a camera beat for reveals / emphasis.
  useEffect(() => {
    if (lastSpeaker.current && lastSpeaker.current !== line.speaker) play('swish', { volume: 0.34 })
    lastSpeaker.current = line.speaker
    if (reducedMotion) return
    if (line.impact) {
      play('sting', { volume: 0.4 })
      void camera.start({ scale: [1, 1.045, 1.02], x: [0, -6, 6, -3, 0], transition: { duration: 0.5 } })
    } else if (line.camera) {
      void camera.start({ scale: 1.03, x: 0, transition: { duration: 2.4, ease: 'easeOut' } })
    } else {
      void camera.start({ scale: 1, x: 0, transition: { duration: 0.8, ease: 'easeOut' } })
    }
  }, [lineKey, line.speaker, line.impact, line.camera, reducedMotion, camera])

  const markTyped = useCallback(() => setTyped(true), [])

  const advance = useCallback(() => {
    if (ending) return
    if (!typed) {
      setTyped(true)
      return
    }
    if (lineIdx < scene.lines.length - 1) {
      setTyped(false)
      setLineIdx((i) => i + 1)
    } else finish()
  }, [ending, finish, lineIdx, scene.lines.length, typed])

  // Keyboard: Space / Enter / → continue; Esc skips.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
        return
      }
      const tag = (e.target as HTMLElement | null)?.tagName
      if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return // let the focused button act
      if (e.key === ' ' || e.key === 'Enter' || e.key === 'ArrowRight') {
        e.preventDefault()
        e.stopImmediatePropagation()
        advance()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [advance, finish])

  const who = SPEAKERS[line.speaker]
  const ease = [0.22, 1, 0.36, 1] as const

  return (
    <motion.div
      className="briefing-scene"
      role="dialog"
      aria-modal="true"
      aria-label="Case briefing"
      initial={{ opacity: 0 }}
      animate={{ opacity: ending ? 0 : 1 }}
      transition={{ duration: reducedMotion ? 0 : ending ? 0.7 : 0.5 }}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('button')) return
        advance()
      }}
    >
      {/* cinematic letterbox */}
      <motion.div className="briefing-bar briefing-bar--top" initial={reducedMotion ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, ease }} />
      <motion.div className="briefing-bar briefing-bar--bottom" initial={reducedMotion ? false : { scaleY: 0 }} animate={{ scaleY: 1 }} transition={{ duration: 0.7, ease }} />

      <motion.p className="briefing-location" initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: reducedMotion ? 0 : 0.5, duration: 0.6 }}>
        {scene.location}
      </motion.p>
      <button type="button" className="briefing-skip" onClick={finish}>
        Skip scene ⏭
      </button>

      {/* the stage: both characters, lit by who is speaking; the camera moves this whole layer */}
      <motion.div className="briefing-stage" animate={camera}>
        <div className="briefing-spot" aria-hidden="true" />
        {line.impact && !reducedMotion && <span key={`burst-${lineKey}`} className="impact-burst briefing-burst" aria-hidden="true" />}
        <motion.div
          className="briefing-actor briefing-actor--mathew"
          animate={{ x: line.speaker === 'mathew' ? '2%' : '-2%' }}
          transition={{ duration: reducedMotion ? 0 : 0.6, ease }}
        >
          <CharacterSprite character="mathew" expression={line.mathew} speaking={line.speaker === 'mathew'} impact={line.impact} reducedMotion={reducedMotion} />
        </motion.div>
        <motion.div
          className="briefing-actor briefing-actor--morag"
          animate={{ x: line.speaker === 'morag' ? '-2%' : '2%' }}
          transition={{ duration: reducedMotion ? 0 : 0.6, ease }}
        >
          <CharacterSprite character="morag" expression={line.morag} speaking={line.speaker === 'morag'} impact={line.impact} reducedMotion={reducedMotion} />
        </motion.div>
      </motion.div>

      {/* dialogue box */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={lineKey}
          className={`briefing-box briefing-box--${line.speaker}${line.impact ? ' is-impact' : ''}`}
          initial={reducedMotion ? false : { opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
          transition={{ duration: reducedMotion ? 0 : 0.25, ease: 'easeOut' }}
        >
          <div className="briefing-box__plate">
            <span className="briefing-box__name">{who.name}</span>
            <span className="briefing-box__role">{who.role}</span>
          </div>
          <span className="briefing-box__count" aria-hidden="true">{lineIdx + 1} / {scene.lines.length}</span>
          <p className="briefing-box__text" aria-live="polite">
            <Typed key={lineKey} text={line.text} instant={reducedMotion || typed} onComplete={markTyped} msPerChar={22} />
          </p>
          {typed && <span className="briefing-box__next" aria-hidden="true">▼</span>}
        </motion.div>
      </AnimatePresence>
      <p className="briefing-help" aria-hidden="true">Click · Space · Enter to continue · Esc to skip</p>
    </motion.div>
  )
}
