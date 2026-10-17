import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3'
import { useCaseStore } from '../../store/useCaseStore'
import { storyBeatAt } from './storyBeats'
import { playComicSfx } from './comicSfx'
import ComicBurstLayer, { fireComicBurst } from './ComicBurst'
import { hhmm, observeResize, timeScale, useVisibleFlags, TOKENS } from './util'
import './viz-story.css'
import './viz-comic.css'

const BAR_H = 96
const TRACK_H = 10
const PAD_X = 72

export default function TimeSlider() {
  const caseData = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const setReplayTime = useCaseStore((s) => s.setReplayTime)
  const isPlaying = useCaseStore((s) => s.isPlaying)
  const togglePlay = useCaseStore((s) => s.togglePlay)
  const judgeMode = useCaseStore((s) => s.judgeMode)
  const revealedFlagIds = useCaseStore((s) => s.revealedFlagIds)
  const flags = useVisibleFlags()
  const trackRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const tMin = caseData?.meta.time_min ?? 0
  const tMax = caseData?.meta.time_max ?? 1440

  const flagTimes = useMemo(
    () => flags.map((f) => f.time).filter((t): t is number => t != null),
    [flags],
  )

  const beat = useMemo(
    () => storyBeatAt(caseData, replayTime, { judgeMode, revealedFlagIds }),
    [caseData, replayTime, judgeMode, revealedFlagIds],
  )

  const lastHotRef = useRef('')

  useEffect(() => {
    if (!isPlaying || !caseData) return
    let ticks = 0
    const id = window.setInterval(() => {
      const { replayTime: t, setReplayTime: setT, togglePlay: toggle } =
        useCaseStore.getState()
      const next = t + 5
      ticks += 1
      if (ticks % 10 === 0) playComicSfx('tick')
      if (next >= caseData.meta.time_max) {
        setT(caseData.meta.time_max)
        if (useCaseStore.getState().isPlaying) toggle()
        playComicSfx('bam')
        fireComicBurst('BOOM')
      } else {
        setT(next)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [isPlaying, caseData])

  useEffect(() => {
    if (beat.urgency !== 'hot') return
    if (lastHotRef.current === beat.line) return
    lastHotRef.current = beat.line
    playComicSfx('flag')
    fireComicBurst('CLUE', { x: 70, y: 82 })
  }, [beat.urgency, beat.line])

  useEffect(() => {
    const el = trackRef.current
    const svg = svgRef.current
    if (!el || !svg) return

    const draw = () => {
      const w = el.clientWidth
      const trackW = Math.max(40, w - PAD_X * 2)
      const x = timeScale(trackW, tMin, tMax)
      const midY = 36
      const tClamped = Math.min(tMax, Math.max(tMin, replayTime))
      const thumbX = x(tClamped)

      const root = select(svg)
      root.selectAll('*').remove()
      root.attr('width', w).attr('height', 64)

      const defs = root.append('defs')
      const grad = defs
        .append('linearGradient')
        .attr('id', 'replay-track')
        .attr('x1', '0%')
        .attr('x2', '100%')
      grad.append('stop').attr('offset', '0%').attr('stop-color', '#c07828')
      grad.append('stop').attr('offset', '100%').attr('stop-color', TOKENS.accent)

      const g = root.append('g').attr('transform', `translate(${PAD_X},0)`)

      const hourStart = Math.ceil(tMin / 60) * 60
      for (let t = hourStart; t <= tMax; t += 60) {
        const px = x(t)
        g.append('line')
          .attr('x1', px)
          .attr('x2', px)
          .attr('y1', midY + TRACK_H / 2 + 4)
          .attr('y2', midY + TRACK_H / 2 + 10)
          .attr('stroke', TOKENS.muted)
          .attr('stroke-opacity', 0.45)
          .attr('stroke-width', 1)
        if (t % 120 === 0) {
          g.append('text')
            .attr('x', px)
            .attr('y', midY + TRACK_H / 2 + 22)
            .attr('text-anchor', 'middle')
            .attr('fill', TOKENS.muted)
            .attr('font-size', 9)
            .attr('font-family', 'JetBrains Mono, monospace')
            .text(hhmm(t))
        }
      }

      for (const ft of flagTimes) {
        if (ft < tMin || ft > tMax) continue
        g.append('line')
          .attr('x1', x(ft))
          .attr('x2', x(ft))
          .attr('y1', midY - TRACK_H / 2 - 8)
          .attr('y2', midY + TRACK_H / 2 + 2)
          .attr('stroke', TOKENS.pin)
          .attr('stroke-width', 2)
          .attr('stroke-linecap', 'round')
          .attr('opacity', 0.9)
      }

      // Unplayed track
      g.append('rect')
        .attr('x', 0)
        .attr('y', midY - TRACK_H / 2)
        .attr('width', trackW)
        .attr('height', TRACK_H)
        .attr('rx', TRACK_H / 2)
        .attr('fill', '#3b2c20')
        .attr('opacity', 0.95)

      // Elapsed fill
      g.append('rect')
        .attr('x', 0)
        .attr('y', midY - TRACK_H / 2)
        .attr('width', Math.max(0, thumbX))
        .attr('height', TRACK_H)
        .attr('rx', TRACK_H / 2)
        .attr('fill', 'url(#replay-track)')
        .attr('opacity', 0.95)

      // Thumb glow
      g.append('circle')
        .attr('cx', thumbX)
        .attr('cy', midY)
        .attr('r', 16)
        .attr('fill', TOKENS.accent)
        .attr('opacity', isPlaying ? 0.28 : 0.12)

      g.append('circle')
        .attr('cx', thumbX)
        .attr('cy', midY)
        .attr('r', 12)
        .attr('fill', '#fbf7ee')
        .attr('stroke', TOKENS.accent)
        .attr('stroke-width', 3)
        .style('cursor', 'grab')

      g.append('text')
        .attr('x', thumbX)
        .attr('y', midY - 18)
        .attr('text-anchor', 'middle')
        .attr('fill', TOKENS.accent)
        .attr('font-size', 12)
        .attr('font-weight', 600)
        .attr('font-family', 'Fredoka, sans-serif')
        .text(hhmm(replayTime))
    }

    draw()
    return observeResize(el, draw)
  }, [tMin, tMax, replayTime, flagTimes, isPlaying])

  const onPointer = (clientX: number, withClickSound = false) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const trackW = Math.max(40, rect.width - PAD_X * 2)
    const local = clientX - rect.left - PAD_X
    const x = timeScale(trackW, tMin, tMax)
    const t = Math.round(x.invert(Math.min(trackW, Math.max(0, local))))
    setReplayTime(Math.min(tMax, Math.max(tMin, t)))
    if (withClickSound) playComicSfx('thwip')
  }

  return (
    <div
      className={`time-slider story-replay${isPlaying ? ' is-playing' : ''}`}
      style={{
        height: BAR_H,
        flexShrink: 0,
        position: 'sticky',
        bottom: 0,
        zIndex: 30,
        borderTop: `2px solid ${TOKENS.panelBorder}`,
        boxShadow: '0 -10px 28px rgba(0,0,0,0.4)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 12px 4px',
        color: TOKENS.mutedSoft,
      }}
    >
      <ComicBurstLayer />
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          marginBottom: 2,
        }}
      >
        <button
          type="button"
          className={`time-slider__play${isPlaying ? ' is-on' : ''}`}
          onClick={() => {
            playComicSfx(isPlaying ? 'zap' : 'play')
            if (!isPlaying) fireComicBurst('THWIP', { x: 12, y: 88 })
            togglePlay()
          }}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          style={{
            width: 42,
            height: 42,
            borderRadius: '50%',
            border: `2px solid ${TOKENS.accent}`,
            background: '#3b2c20',
            color: TOKENS.accent,
            fontSize: 14,
            cursor: 'pointer',
            flexShrink: 0,
          }}
        >
          {isPlaying ? '❚❚' : '▶'}
        </button>
        <span
          style={{
            fontFamily: 'Fredoka, sans-serif',
            fontWeight: 600,
            fontSize: 13,
            letterSpacing: '0.1em',
            color: TOKENS.accent,
            whiteSpace: 'nowrap',
          }}
        >
          REPLAY THE DAY
        </span>
        <div
          ref={trackRef}
          style={{ flex: 1, position: 'relative', minWidth: 0 }}
          onPointerDown={(e) => {
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            onPointer(e.clientX, true)
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) onPointer(e.clientX)
          }}
        >
          <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
        </div>
      </div>
      <p className="time-slider__story">
        <strong>{beat.phase}</strong>
        {beat.line}
      </p>
    </div>
  )
}
