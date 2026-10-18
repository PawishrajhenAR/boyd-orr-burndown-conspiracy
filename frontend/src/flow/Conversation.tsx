import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { FALLBACK_REACTION, REACTIONS, SPEAKERS, type CharacterReaction, type Line, type ReactionId, type Speaker } from './dialogue'
import { play } from './sound'

export const AUTO_LINE_MS = 3400

const REACTION_IDS = new Set<string>(Object.keys(REACTIONS))

function reactionFor(id: ReactionId | string | undefined): CharacterReaction {
  return id && REACTION_IDS.has(id) ? REACTIONS[id as ReactionId] : FALLBACK_REACTION
}

function CharacterSprite({ character, expression, speaker, active, reducedMotion }: {
  character: 'mathew' | 'morag'
  expression: string
  speaker: boolean
  active: boolean
  reducedMotion: boolean
}) {
  const [failed, setFailed] = useState(false)
  const safeExpression = /^[a-z-]+$/.test(expression) ? expression : 'neutral'
  const src = `/characters/${character}/${safeExpression}.webp`

  return (
    <motion.div
      className={`conversation-character conversation-character--${character}${speaker ? ' is-speaking' : ' is-listening'}`}
      initial={reducedMotion ? false : { opacity: 0, y: 24, scale: 0.96 }}
      animate={{ opacity: active ? 1 : 0.54, y: 0, scale: speaker ? 1.025 : 0.97 }}
      transition={{ duration: reducedMotion ? 0 : 0.36, ease: 'easeOut' }}
      aria-hidden="true"
    >
      {!failed ? (
        <AnimatePresence mode="wait" initial={false}>
          <motion.img
            key={src}
            src={src}
            alt=""
            draggable={false}
            onError={() => setFailed(true)}
            initial={reducedMotion ? false : { opacity: 0.72, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: reducedMotion ? 0 : 0.22 }}
          />
        </AnimatePresence>
      ) : (
        <span className="conversation-character__fallback">{character === 'mathew' ? 'M' : 'P'}</span>
      )}
    </motion.div>
  )
}

function Typed({ text, instant, onComplete }: { text: string; instant: boolean; onComplete: () => void }) {
  const [length, setLength] = useState(0)

  useEffect(() => {
    if (instant) {
      onComplete()
      return
    }
    let revealed = 0
    const stepMs = Math.max(10, Math.min(14, 680 / Math.max(text.length, 1)))
    const timer = window.setInterval(() => {
      revealed = Math.min(text.length, revealed + 1)
      setLength(revealed)
      if (revealed >= text.length) {
        window.clearInterval(timer)
        onComplete()
      }
    }, stepMs)
    return () => window.clearInterval(timer)
  }, [text, instant, onComplete])

  return <>{instant ? text : text.slice(0, length)}</>
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

/** Cinematic comic dialogue shared by every investigation stage. */
export default function Conversation({ lines, index, onAdvance, onSkip, auto, onToggleAuto, active, blocked = false, reducedMotion }: Props) {
  const atEnd = index >= lines.length - 1
  const current = lines[index]
  const [revealedIndex, setRevealedIndex] = useState(-1)
  const [doneIndex, setDoneIndex] = useState(reducedMotion ? index : -1)
  const [cueIndex, setCueIndex] = useState(-1)
  const previousSpeaker = useRef<Speaker | null>(null)
  const reaction = reactionFor(current?.reaction)
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
  const speakerCharacter = current.speaker === 'morag' ? 'morag' : 'mathew'
  const listenerCharacter = speakerCharacter === 'morag' ? 'mathew' : 'morag'
  const speakerExpression = speakerCharacter === 'morag' ? reaction.morag : reaction.mathew
  const listenerExpression = listenerCharacter === 'morag' ? reaction.morag : reaction.mathew
  const who = SPEAKERS[current.speaker]

  return (
    <section className={`comic-conversation${reaction.impact ? ' is-impact' : ''}${reaction.camera ? ' is-focus' : ''}`} aria-label="Investigator dialogue">
      <CharacterSprite key={`mathew-${reaction.mathew}`} character="mathew" expression={reaction.mathew} speaker={speakerCharacter === 'mathew'} active={active} reducedMotion={reducedMotion} />
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
      <CharacterSprite key={`morag-${reaction.morag}`} character="morag" expression={listenerCharacter === 'morag' ? listenerExpression : speakerExpression} speaker={speakerCharacter === 'morag'} active={active} reducedMotion={reducedMotion} />
    </section>
  )
}
