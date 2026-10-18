import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { EXPRESSIONS, spriteUrl, type Character, type Expression } from './dialogue'

/** Warm the browser cache with every sprite once, so expression changes never flash. */
let preloaded = false
export function preloadCast(): void {
  if (preloaded || typeof Image === 'undefined') return
  preloaded = true
  for (const character of Object.keys(EXPRESSIONS) as Character[]) {
    for (const expression of EXPRESSIONS[character]) {
      const img = new Image()
      img.decoding = 'async'
      img.src = spriteUrl(character, expression as Expression<typeof character>)
    }
  }
}

interface SpriteProps<C extends Character> {
  character: C
  expression: Expression<C>
  /** Speaking: lit, aura on, gentle breathing. Listening: dimmed and still. */
  speaking: boolean
  /** Reveal beat: aura flares. */
  impact?: boolean
  /** Hidden from view entirely (e.g. not in this scene yet). */
  present?: boolean
  reducedMotion: boolean
  className?: string
}

/**
 * One cast member: the expression sprite (cross-faded on change), a JJK-style aura behind the speaker,
 * and speaker/listener lighting. Sprites are 410x418 and anchored bottom-centre.
 */
export function CharacterSprite<C extends Character>({ character, expression, speaking, impact = false, present = true, reducedMotion, className = '' }: SpriteProps<C>) {
  const [failed, setFailed] = useState<string | null>(null)
  const src = spriteUrl(character, expression)
  useEffect(() => preloadCast(), [])

  return (
    <motion.div
      className={`cast-sprite cast-sprite--${character}${speaking ? ' is-speaking' : ' is-listening'}${impact && speaking ? ' is-impact' : ''} ${className}`}
      initial={reducedMotion ? false : { opacity: 0, y: 30 }}
      animate={{ opacity: present ? 1 : 0, y: present ? 0 : 30 }}
      transition={{ duration: reducedMotion ? 0 : 0.45, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden="true"
    >
      <span className="cast-aura" />
      <motion.div
        className="cast-body"
        animate={speaking && !reducedMotion ? { y: [0, -4, 0] } : { y: 0 }}
        transition={speaking && !reducedMotion ? { duration: 3.4, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
      >
        {failed === src ? (
          <span className="cast-fallback">{character === 'mathew' ? 'M' : 'P'}</span>
        ) : (
          <AnimatePresence initial={false}>
            <motion.img
              key={src}
              src={src}
              alt=""
              width={410}
              height={418}
              draggable={false}
              decoding="async"
              onError={() => setFailed(src)}
              initial={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 1.035 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: reducedMotion ? 0.12 : 0.28, ease: 'easeOut' }}
            />
          </AnimatePresence>
        )}
      </motion.div>
    </motion.div>
  )
}

/** Typewriter text. Calls `onComplete` once the whole line is visible. */
export function Typed({ text, instant, onComplete, msPerChar }: { text: string; instant: boolean; onComplete: () => void; msPerChar?: number }) {
  const [length, setLength] = useState(0)

  useEffect(() => {
    if (instant) {
      onComplete()
      return
    }
    let revealed = 0
    const stepMs = msPerChar ?? Math.max(10, Math.min(14, 680 / Math.max(text.length, 1)))
    const timer = window.setInterval(() => {
      revealed = Math.min(text.length, revealed + 1)
      setLength(revealed)
      if (revealed >= text.length) {
        window.clearInterval(timer)
        onComplete()
      }
    }, stepMs)
    return () => window.clearInterval(timer)
  }, [text, instant, onComplete, msPerChar])

  return <>{instant ? text : text.slice(0, length)}</>
}
