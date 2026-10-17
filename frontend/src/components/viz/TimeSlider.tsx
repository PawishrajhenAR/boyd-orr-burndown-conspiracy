import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3'
import { useCaseStore } from '../../store/useCaseStore'
import { hhmm, timeScale, useVisibleFlags, TOKENS } from './util'

const BAR_H = 88
const TRACK_H = 10
const PAD_X = 72

export default function TimeSlider() {
  const caseData = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const setReplayTime = useCaseStore((s) => s.setReplayTime)
  const isPlaying = useCaseStore((s) => s.isPlaying)
  const togglePlay = useCaseStore((s) => s.togglePlay)
  const flags = useVisibleFlags()
  const trackRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)

  const tMin = caseData?.meta.time_min ?? 0
  const tMax = caseData?.meta.time_max ?? 1440

  const flagTimes = useMemo(
    () => flags.map((f) => f.time).filter((t): t is number => t != null),
    [flags],
  )

  // Advance 5 min every 100 ms while playing
  useEffect(() => {
    if (!isPlaying || !caseData) return
    const id = window.setInterval(() => {
      const { replayTime: t, setReplayTime: setT, togglePlay: toggle } =
        useCaseStore.getState()
      const next = t + 5
      if (next >= caseData.meta.time_max) {
        setT(caseData.meta.time_max)
        if (useCaseStore.getState().isPlaying) toggle()
      } else {
        setT(next)
      }
    }, 100)
    return () => window.clearInterval(id)
  }, [isPlaying, caseData])

  useEffect(() => {
    const el = trackRef.current
    const svg = svgRef.current
    if (!el || !svg) return

    const draw = () => {
      const w = el.clientWidth
      const trackW = Math.max(40, w - PAD_X * 2)
      const x = timeScale(trackW, tMin, tMax)
      const midY = 36

      const root = select(svg)
      root.selectAll('*').remove()
      root.attr('width', w).attr('height', 64)

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
      }

      g.append('rect')
        .attr('x', 0)
        .attr('y', midY - TRACK_H / 2)
        .attr('width', trackW)
        .attr('height', TRACK_H)
        .attr('rx', TRACK_H / 2)
        .attr('fill', TOKENS.accent)
        .attr('opacity', 0.85)

      const thumbX = x(Math.min(tMax, Math.max(tMin, replayTime)))
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
    const ro = new ResizeObserver(draw)
    ro.observe(el)
    return () => ro.disconnect()
  }, [tMin, tMax, replayTime, flagTimes])

  const onPointer = (clientX: number) => {
    const el = trackRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const trackW = Math.max(40, rect.width - PAD_X * 2)
    const local = clientX - rect.left - PAD_X
    const x = timeScale(trackW, tMin, tMax)
    const t = Math.round(x.invert(Math.min(trackW, Math.max(0, local))))
    setReplayTime(Math.min(tMax, Math.max(tMin, t)))
  }

  return (
    <div
      className="time-slider"
      style={{
        height: BAR_H,
        background: TOKENS.panel,
        borderTop: `2px solid ${TOKENS.panelBorder}`,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '0 12px 4px',
        color: TOKENS.mutedSoft,
      }}
    >
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
          onClick={togglePlay}
          aria-label={isPlaying ? 'Pause' : 'Play'}
          style={{
            width: 40,
            height: 40,
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
            letterSpacing: '0.08em',
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
            onPointer(e.clientX)
          }}
          onPointerMove={(e) => {
            if (e.buttons === 1) onPointer(e.clientX)
          }}
        >
          <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
        </div>
      </div>
      <p
        style={{
          margin: 0,
          fontSize: 11,
          color: TOKENS.muted,
          textAlign: 'center',
        }}
      >
        Drag the thumb or press play to scrub the day. Red ticks mark when
        irregularities were flagged.
      </p>
    </div>
  )
}
