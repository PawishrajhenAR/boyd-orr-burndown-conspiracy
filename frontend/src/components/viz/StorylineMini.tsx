import { useEffect, useMemo, useRef } from 'react'
import { select, line, curveMonotoneX } from 'd3'
import {
  useCaseStore,
  boardStudents,
  visitsFor,
} from '../../store/useCaseStore'
import { observeResize, timeScale, verdictColor, TOKENS } from './util'

/** Small static storyline preview for Case Closed / newspaper. */
export default function StorylineMini() {
  const caseData = useCaseStore((s) => s.case)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const students = useMemo(
    () => (caseData ? boardStudents(caseData).slice(0, 6) : []),
    [caseData],
  )

  const buildingOrder = useMemo(() => {
    if (!caseData) return [] as string[]
    const counts = new Map<string, number>()
    for (const v of caseData.visits) {
      counts.set(v.building_id, (counts.get(v.building_id) ?? 0) + 1)
    }
    return [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id)
  }, [caseData])

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg || !caseData) return

    const draw = () => {
      const width = wrap.clientWidth || 320
      const height = 160
      const pad = { t: 16, r: 8, b: 16, l: 8 }
      const innerW = width - pad.l - pad.r
      const innerH = height - pad.t - pad.b
      const tMin = caseData.meta.time_min
      const tMax = caseData.meta.time_max
      const x = timeScale(innerW, tMin, tMax)
      const rowH = innerH / Math.max(1, buildingOrder.length)

      const root = select(svg)
      root.selectAll('*').remove()
      root.attr('width', width).attr('height', height)

      const g = root
        .append('g')
        .attr('transform', `translate(${pad.l},${pad.t})`)

      g.append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('rx', 8)
        .attr('fill', TOKENS.panel)
        .attr('stroke', TOKENS.panelBorder)

      buildingOrder.forEach((_, i) => {
        g.append('line')
          .attr('x1', 0)
          .attr('x2', innerW)
          .attr('y1', i * rowH + rowH / 2)
          .attr('y2', i * rowH + rowH / 2)
          .attr('stroke', '#3b2c20')
          .attr('stroke-width', 1)
      })

      const pathLine = line<{ t: number; row: number }>()
        .x((d) => x(d.t))
        .y((d) => d.row * rowH + rowH / 2)
        .curve(curveMonotoneX)

      students.forEach((stu, si) => {
        const visits = visitsFor(caseData, stu.id).sort(
          (a, b) => a.start - b.start,
        )
        const pts: Array<{ t: number; row: number }> = []
        for (const v of visits) {
          const row = buildingOrder.indexOf(v.building_id)
          if (row < 0) continue
          pts.push({ t: v.start, row })
          pts.push({ t: v.end, row })
        }
        if (pts.length < 2) return
        const verdict =
          caseData.suspects.find((s) => s.student_id === stu.id)?.verdict ??
          'clear'
        const offset = (si - students.length / 2) * 2.5
        g.append('path')
          .attr(
            'd',
            pathLine(pts.map((p) => ({ ...p, row: p.row }))) ?? '',
          )
          .attr('transform', `translate(0,${offset})`)
          .attr('fill', 'none')
          .attr('stroke', verdictColor(verdict))
          .attr('stroke-width', 1.5)
          .attr('opacity', 0.85)
      })

      // Flag markers
      for (const f of caseData.flags.slice(0, 12)) {
        if (f.time == null || f.building_id == null) continue
        const row = buildingOrder.indexOf(f.building_id)
        if (row < 0) continue
        g.append('text')
          .attr('x', x(f.time))
          .attr('y', row * rowH + rowH / 2 + 3)
          .attr('text-anchor', 'middle')
          .attr('fill', TOKENS.pin)
          .attr('font-size', 9)
          .text('✗')
      }
    }

    draw()
    return observeResize(wrap, draw)
  }, [caseData, students, buildingOrder])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div
        style={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 600,
          fontSize: 12,
          color: TOKENS.accent,
          marginBottom: 2,
        }}
      >
        Storyline
      </div>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
    </div>
  )
}
