import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3'
import {
  useCaseStore,
  visitsFor,
  flagsFor,
  buildingById,
  studentById,
} from '../../store/useCaseStore'
import { hhmm, isOpenAt, timeScale, TOKENS } from './util'

interface Props {
  studentId: string
}

const ROW_H = 28
const PAD = { top: 28, right: 12, bottom: 28, left: 110 }

export default function DayTimeline({ studentId }: Props) {
  const caseData = useCaseStore((s) => s.case)
  const setHint = useCaseStore((s) => s.setHint)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const visits = useMemo(
    () => (caseData ? visitsFor(caseData, studentId) : []),
    [caseData, studentId],
  )
  const flags = useMemo(
    () => (caseData ? flagsFor(caseData, studentId) : []),
    [caseData, studentId],
  )
  const student = caseData ? studentById(caseData, studentId) : undefined

  const buildingIds = useMemo(() => {
    const ids = new Set(visits.map((v) => v.building_id))
    if (student?.lecture_building_id) ids.add(student.lecture_building_id)
    return [...ids]
  }, [visits, student])

  const flaggedVisitIds = useMemo(() => {
    const s = new Set<string>()
    for (const f of flags) for (const id of f.visit_ids) s.add(id)
    return s
  }, [flags])

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg || !caseData) return

    const tMin = caseData.meta.time_min
    const tMax = caseData.meta.time_max

    const draw = () => {
      const width = wrap.clientWidth || 480
      const height = PAD.top + PAD.bottom + Math.max(1, buildingIds.length) * ROW_H
      const innerW = Math.max(40, width - PAD.left - PAD.right)
      const x = timeScale(innerW, tMin, tMax)

      const root = select(svg)
      root.selectAll('*').remove()
      root.attr('width', width).attr('height', height)

      // Hatch pattern for closed hours
      const defs = root.append('defs')
      const pat = defs
        .append('pattern')
        .attr('id', `closed-hatch-${studentId}`)
        .attr('width', 6)
        .attr('height', 6)
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('patternTransform', 'rotate(45)')
      pat
        .append('line')
        .attr('x1', 0)
        .attr('x2', 0)
        .attr('y1', 0)
        .attr('y2', 6)
        .attr('stroke', '#5a3a1e')
        .attr('stroke-width', 2)

      const g = root
        .append('g')
        .attr('transform', `translate(${PAD.left},${PAD.top})`)

      buildingIds.forEach((bid, i) => {
        const y = i * ROW_H
        const b = buildingById(caseData, bid)
        const name = b?.name ?? bid

        g.append('text')
          .attr('x', -8)
          .attr('y', y + ROW_H / 2)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .attr('fill', TOKENS.mutedSoft)
          .attr('font-size', 10)
          .text(name.length > 16 ? `${name.slice(0, 14)}…` : name)

        g.append('rect')
          .attr('x', 0)
          .attr('y', y + 2)
          .attr('width', innerW)
          .attr('height', ROW_H - 4)
          .attr('fill', '#3b2c20')
          .attr('rx', 3)

        // Closed-hour hatching in 5-min slices
        if (b && !b.always_open) {
          for (let t = tMin; t < tMax; t += 15) {
            if (!isOpenAt(b, t)) {
              const x0 = x(t)
              const x1 = x(Math.min(t + 15, tMax))
              g.append('rect')
                .attr('x', x0)
                .attr('y', y + 2)
                .attr('width', Math.max(0, x1 - x0))
                .attr('height', ROW_H - 4)
                .attr('fill', `url(#closed-hatch-${studentId})`)
                .attr('opacity', 0.7)
            }
          }
        }

        // Ghost lecture box
        if (
          student?.lecture &&
          student.lecture_building_id === bid
        ) {
          const lx0 = x(student.lecture.start)
          const lx1 = x(student.lecture.end)
          g.append('rect')
            .attr('x', lx0)
            .attr('y', y + 4)
            .attr('width', Math.max(2, lx1 - lx0))
            .attr('height', ROW_H - 8)
            .attr('fill', 'none')
            .attr('stroke', TOKENS.accent)
            .attr('stroke-width', 1.5)
            .attr('stroke-dasharray', '4 3')
            .attr('opacity', 0.7)
            .attr('rx', 2)
        }
      })

      // Visit bars
      visits.forEach((v) => {
        const row = buildingIds.indexOf(v.building_id)
        if (row < 0) return
        const y = row * ROW_H
        const x0 = x(v.start)
        const x1 = x(v.end)
        const flagged = flaggedVisitIds.has(v.id)

        g.append('rect')
          .attr('x', x0)
          .attr('y', y + 6)
          .attr('width', Math.max(2, x1 - x0))
          .attr('height', ROW_H - 12)
          .attr('rx', 3)
          .attr('fill', flagged ? '#c0392b' : '#ffb347')
          .attr('opacity', flagged ? 0.85 : 0.75)
          .attr('stroke', flagged ? TOKENS.pin : 'none')
          .attr('stroke-width', flagged ? 2 : 0)
          .style('cursor', 'pointer')
          .on('click', () => {
            setHint(`${hhmm(v.start)}–${hhmm(v.end)} · ${v.raw_location}`)
          })
          .append('title')
          .text(`${hhmm(v.start)}–${hhmm(v.end)}`)
      })

      // Axis
      const hourStart = Math.ceil(tMin / 60) * 60
      for (let t = hourStart; t <= tMax; t += 120) {
        g.append('text')
          .attr('x', x(t))
          .attr('y', buildingIds.length * ROW_H + 16)
          .attr('text-anchor', 'middle')
          .attr('fill', TOKENS.muted)
          .attr('font-size', 9)
          .attr('font-family', 'JetBrains Mono, monospace')
          .text(hhmm(t))
      }
    }

    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(wrap)
    return () => ro.disconnect()
  }, [
    caseData,
    studentId,
    buildingIds,
    visits,
    flaggedVisitIds,
    student,
    setHint,
  ])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div
        style={{
          fontFamily: 'Fredoka, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          color: TOKENS.accent,
          marginBottom: 4,
        }}
      >
        Day timeline
      </div>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      <p style={{ margin: '4px 0 0', fontSize: 11, color: TOKENS.muted }}>
        Rows are buildings. Solid bars are visits; dashed orange is the expected
        lecture; hatching means closed. Red outline = flagged.
      </p>
    </div>
  )
}
