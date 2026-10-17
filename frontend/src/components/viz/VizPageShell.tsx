import type { CSSProperties, ReactNode } from 'react'
import { useCaseStore } from '../../store/useCaseStore'

interface Props {
  children: ReactNode
  className?: string
  style?: CSSProperties
}

/** Premium Amber Dark frame for Map / Timeline / Network / Lab. */
export default function VizPageShell({ children, className = '', style }: Props) {
  const isPlaying = useCaseStore((s) => s.isPlaying)

  return (
    <div
      className={`page viz-page${isPlaying ? ' is-playing' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </div>
  )
}
