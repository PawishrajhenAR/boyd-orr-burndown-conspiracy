import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useAnimationControls } from 'framer-motion'
import { CharacterSprite, Typed } from './cast'
import { SPEAKERS, stagingFor, type Line, type Speaker } from './dialogue'
import { play } from './sound'

export const AUTO_LINE_MS = 3400

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

/** Cinematic comic dialogue shared by every investigation stage. */
export default function Conversation({ lines, index, onAdvance, onSkip, auto, onToggleAuto, active, blocked = false, reducedMotion }: Props) {
  const atEnd = index >= lines.length - 1
  const current = lines[index]
  const [revealedIndex, setRevealedIndex] = useState(-1)
  const [doneIndex, setDoneIndex] = useState(reducedMotion ? index : -1)
  const [cueIndex, setCueIndex] = useState(-1)
  const previousSpeaker = useRef<Speaker | null>(null)
  const reaction = stagingFor(current)
  const shake = useAnimationControls()
  const evidence = current?.evidence
  const revealed = reducedMotion || revealedIndex === index
  const typingDone = reducedMotion || doneIndex === index
  const markTypingDone = useCallback(() => setDoneIndex(index), [index])

  useEffect(() => {
    if (!active || !current) return
    const switched = previousSpeaker.current !== null && previousSpeaker.current !== current.speaker
    previousSpeaker.current = current.speaker
    if (switched) play('swish', { volume: 0.34 })
    if (reaction.impact) {
      const timer = window.setTimeout(() => play('sting', { volume: 0.34 }), reducedMotion ? 0 : 170)
      return () => window.clearTimeout(timer)
    }
    return undefined
  }, [active, current, index, reaction.impact, reducedMotion])

  useEffect(() => {
    if (!active) previousSpeaker.current = null
  }, [active])

  // Reveal beat: a short camera shake as the line lands.
  useEffect(() => {
    if (!active || !reaction.impact || reducedMotion) return
    void shake.start({ x: [0, -4, 4, -2, 0], transition: { duration: 0.32, delay: 0.12 } })
  }, [active, index, reaction.impact, reducedMotion, shake])

  useEffect(() => {
    if (!active || !auto || atEnd || blocked || !typingDone) return
    const timer = window.setTimeout(onAdvance, AUTO_LINE_MS)
    return () => window.clearTimeout(timer)
  }, [active, auto, atEnd, blocked, index, onAdvance, typingDone])

  useEffect(() => {
    if (!active || !evidence || !typingDone) return
    const timer = window.setTimeout(() => setCueIndex(index), 3100)
    return () => window.clearTimeout(timer)
  }, [active, evidence, index, typingDone])

  const cueVisible = active && !!evidence && typingDone && cueIndex !== index

  const advanceOrReveal = useCallback(() => {
    if (!typingDone) {
      setRevealedIndex(index)
      setDoneIndex(index)
      return
    }
    if (!atEnd) onAdvance()
  }, [atEnd, index, onAdvance, typingDone])

  useEffect(() => {
    if (!active) return
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'BUTTON' || tag === 'A' || tag === 'SELECT' || event.altKey || event.ctrlKey || event.metaKey) return
      if ((event.key === ' ' || event.key === 'ArrowRight') && (!atEnd || !typingDone)) {
        event.preventDefault()
        event.stopImmediatePropagation()
        advanceOrReveal()
      }
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [active, advanceOrReveal, atEnd, typingDone])

  if (!current) return null
  const who = SPEAKERS[current.speaker]
  const impact = !!reaction.impact && !reducedMotion

  return (
    <motion.section
      className={`comic-conversation${reaction.impact ? ' is-impact' : ''}${reaction.camera ? ' is-focus' : ''}${active ? '' : ' is-idle'}`}
      aria-label="Investigator dialogue"
      animate={shake}
    >
      {impact && <span key={`burst-${index}`} className="impact-burst" aria-hidden="true" />}
      <CharacterSprite character="mathew" expression={reaction.mathew} speaking={current.speaker === 'mathew'} impact={!!reaction.impact} reducedMotion={reducedMotion} className="comic-character" />
      <div className="comic-conversation__center">
        <AnimatePresence mode="wait" initial={false}>
          <motion.article
            key={`${index}-${current.reaction}`}
            className={`comic-dialogue comic-dialogue--${current.speaker}`}
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: reaction.camera && !reducedMotion ? [1, 1.012, 1] : 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -8 }}
            transition={{ duration: reducedMotion ? 0 : 0.3, ease: 'easeOut' }}
            aria-live="polite"
            aria-atomic="true"
          >
            <div className="comic-dialogue__heading">
              <span className="comic-dialogue__speaker">{who.name}</span>
              <span className="comic-dialogue__role">{who.role}</span>
              {reaction.impact && <span className="comic-dialogue__cue" aria-hidden="true">LEAD FOUND</span>}
            </div>
            <p className="comic-dialogue__text">
              <Typed key={index} text={current.text} instant={reducedMotion || revealed} onComplete={markTypingDone} />
              {!typingDone && <span className="comic-dialogue__caret" aria-hidden="true" />}
            </p>
          </motion.article>
        </AnimatePresence>
        <AnimatePresence initial={false}>
          {evidence && cueVisible && (
            <motion.aside
              key={`${index}-evidence`}
              className="comic-evidence"
              aria-label="Case evidence"
              aria-live="polite"
              initial={reducedMotion ? false : { opacity: 0, y: 8, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={reducedMotion ? { opacity: 0 } : { opacity: 0, y: -5 }}
              transition={{ duration: reducedMotion ? 0 : 0.24, ease: 'easeOut' }}
            >
              <div className="comic-evidence__heading">
                <span>{evidence.eyebrow}</span>
                <strong>{evidence.title}</strong>
              </div>
              <ul>
                {evidence.items.map((item) => <li key={`${item.label}-${item.detail}`}><b>{item.label}</b><span>{item.detail}</span></li>)}
              </ul>
              {evidence.note && <p className="comic-evidence__note">{evidence.note}</p>}
            </motion.aside>
          )}
        </AnimatePresence>
        <div className="comic-controls">
          <button type="button" onClick={advanceOrReveal} disabled={atEnd && typingDone} className="comic-control comic-control--primary">
            {!typingDone ? 'Reveal line' : atEnd ? 'File complete' : 'Next line ▸'}
          </button>
          <button type="button" onClick={onToggleAuto} aria-pressed={auto} className="comic-control">
            {auto ? '❚❚ Auto' : '▶ Auto'}
          </button>
          <button type="button" onClick={onSkip} disabled={atEnd} className="comic-control comic-control--quiet">
            Skip ⏭
          </button>
          <span className="comic-progress">{Math.max(0, index + 1)} / {lines.length} <span>· Space / →</span></span>
        </div>
      </div>
      <CharacterSprite character="morag" expression={reaction.morag} speaking={current.speaker === 'morag'} impact={!!reaction.impact} reducedMotion={reducedMotion} className="comic-character" />
    </motion.section>
  )
}
