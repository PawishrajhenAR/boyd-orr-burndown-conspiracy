import { useEffect, type CSSProperties, type ReactNode } from 'react'
import { useCaseStore } from '../../store/useCaseStore'
import { fireComicBurst } from './ComicBurst'
import { playComicSfx } from './comicSfx'
import './viz-comic.css'

interface Props {
  children: ReactNode
  className?: string
  style?: CSSProperties
  /** Slam SFX when the page mounts */
  enterSfx?: 'whoosh' | 'slam' | 'thwip'
}

/** Wraps Map / Timeline / Network / Lab with comic skin + enter SFX. */
export default function ComicPageShell({
  children,
  className = '',
  style,
  enterSfx = 'whoosh',
}: Props) {
  const isPlaying = useCaseStore((s) => s.isPlaying)

  useEffect(() => {
    playComicSfx(enterSfx)
    fireComicBurst(enterSfx === 'slam' ? 'BAM' : 'THWIP', { x: 50, y: 18 })
  }, [enterSfx])

  return (
    <div
      className={`page comic-page${isPlaying ? ' is-playing' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      <div className="comic-speedlines" aria-hidden />
      {children}
    </div>
  )
}
