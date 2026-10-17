import type { CSSProperties, ReactNode } from 'react'
import { useCaseStore } from '../../store/useCaseStore'
import { chapterMeta, storyBeatAt } from './storyBeats'
import { hhmm } from './util'
import './viz-story.css'

interface Props {
  chapter: 'map' | 'timeline' | 'network' | 'lab'
  subtitle?: string
  children?: ReactNode
  /** Extra toolbar under the beat line (filters, buttons). */
  toolbar?: ReactNode
  variant?: 'cork' | 'night'
}

export default function StoryChapter({
  chapter,
  subtitle,
  children,
  toolbar,
  variant = 'cork',
}: Props) {
  const c = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const judgeMode = useCaseStore((s) => s.judgeMode)
  const revealedFlagIds = useCaseStore((s) => s.revealedFlagIds)
  const meta = chapterMeta(chapter)
  const beat = storyBeatAt(c, replayTime, { judgeMode, revealedFlagIds })

  return (
    <header
      className={`story-chapter story-chapter--${variant}`}
      style={variant === 'night' ? ({ background: 'transparent' } satisfies CSSProperties) : {}}
    >
      <div className="story-chapter__top">
        <div className="story-chapter__badge" aria-hidden>
          <span className="story-chapter__roman">{meta.roman}</span>
          <span className="story-chapter__label">{meta.label}</span>
        </div>
        <div className="story-chapter__titles">
          <p className="story-chapter__eyebrow">
            CASE FILE · {c?.meta.day_label ?? '5 November'} · {hhmm(replayTime)}
          </p>
          <h2 className="story-chapter__title">
            {meta.title}
            {subtitle ? <small>{subtitle}</small> : null}
          </h2>
        </div>
      </div>

      <div
        className={`story-beat story-beat--${beat.urgency}`}
        role="status"
        aria-live="polite"
      >
        <span className="story-beat__phase">{beat.phase}</span>
        <span className="story-beat__line">
          {beat.urgency === 'hot'
            ? beat.line
            : 'Follow the replay bar — the story updates as the clock moves.'}
        </span>
      </div>

      <p className="story-chapter__how">{meta.how}</p>

      {toolbar ? <div className="story-chapter__toolbar">{toolbar}</div> : null}
      {children}
    </header>
  )
}
