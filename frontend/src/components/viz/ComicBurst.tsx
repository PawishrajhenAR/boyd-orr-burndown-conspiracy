import { useEffect, useState } from 'react'
import './viz-comic.css'

export type BurstWord = 'POW' | 'BAM' | 'ZAP' | 'WHAM' | 'THWIP' | 'BOOM' | 'CLUE' | 'REVEAL'

interface Burst {
  id: number
  word: BurstWord
  x: number
  y: number
  rot: number
}

let seq = 0
const listeners = new Set<(b: Burst) => void>()

/** Fire a comic burst anywhere on the page (percent coords optional). */
export function fireComicBurst(
  word: BurstWord,
  at?: { x?: number; y?: number },
) {
  const burst: Burst = {
    id: ++seq,
    word,
    x: at?.x ?? 18 + Math.random() * 64,
    y: at?.y ?? 22 + Math.random() * 40,
    rot: -18 + Math.random() * 36,
  }
  listeners.forEach((fn) => fn(burst))
}

/** Mount once per comic page to render flying onomatopoeia. */
export default function ComicBurstLayer() {
  const [bursts, setBursts] = useState<Burst[]>([])

  useEffect(() => {
    const onBurst = (b: Burst) => {
      setBursts((prev) => [...prev.slice(-6), b])
      window.setTimeout(() => {
        setBursts((prev) => prev.filter((x) => x.id !== b.id))
      }, 900)
    }
    listeners.add(onBurst)
    return () => {
      listeners.delete(onBurst)
    }
  }, [])

  return (
    <div className="comic-burst-layer" aria-hidden>
      {bursts.map((b) => (
        <span
          key={b.id}
          className={`comic-burst comic-burst--${b.word.toLowerCase()}`}
          style={{
            left: `${b.x}%`,
            top: `${b.y}%`,
            transform: `translate(-50%, -50%) rotate(${b.rot}deg)`,
          }}
        >
          {b.word}!
        </span>
      ))}
    </div>
  )
}
