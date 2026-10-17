import { useEffect, useMemo, useRef } from 'react'
import { select, arc } from 'd3'
import {
  useCaseStore,
  visitsFor,
  flagsFor,
  buildingById,
} from '../../store/useCaseStore'
import { hhmm, isOpenAt, observeResize, TOKENS } from './util'

interface Props {
  studentId: string
}

/** Minutes → radians, 00:00 at top, clockwise. */
function toAngle(min: number): number {
  const m = ((min % 1440) + 1440) % 1440
  return (m / 1440) * Math.PI * 2 - Math.PI / 2
}

/** Split a [start,end] span that may cross midnight into day-relative arcs. */
function daySegments(
  start: number,
  end: number,
): Array<{ a0: number; a1: number }> {
  const segs: Array<{ a0: number; a1: number }> = []
  let s = start
  while (s < end) {
    const day = Math.floor(s / 1440)
    const dayEnd = (day + 1) * 1440
    const e = Math.min(end, dayEnd)
    const a0 = toAngle(s)
    let a1 = toAngle(e === dayEnd ? dayEnd - 0.01 : e)
    // Ensure clockwise sweep
    if (a1 <= a0) a1 += Math.PI * 2
    segs.push({ a0, a1 })
    s = e
  }
  return segs
}

export default function Clock24({ studentId }: Props) {
  const caseData = useCaseStore((s) => s.case)
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
  const ruleBreaks = flags.filter((f) => f.severity >= 1).length

  const buildingIds = useMemo(() => {
    const ids: string[] = []
    const seen = new Set<string>()
    for (const v of visits) {
      if (!seen.has(v.building_id)) {
        seen.add(v.building_id)
        ids.push(v.building_id)
      }
    }
    return ids
  }, [visits])

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg || !caseData) return

    const draw = () => {
      const size = Math.min(wrap.clientWidth || 280, 320)
      const cx = size / 2
      const cy = size / 2
      const outerR = size * 0.42
      const ringGap = Math.min(14, (outerR - 36) / Math.max(1, buildingIds.length))

      const root = select(svg)
      root.selectAll('*').remove()
      root.attr('width', size).attr('height', size)

      const defs = root.append('defs')
      const glow = defs
        .append('filter')
        .attr('id', `pulse-${studentId}`)
        .attr('x', '-50%')
        .attr('y', '-50%')
        .attr('width', '200%')
        .attr('height', '200%')
      glow
        .append('feGaussianBlur')
        .attr('stdDeviation', 2)
        .attr('result', 'b')
      const merge = glow.append('feMerge')
      merge.append('feMergeNode').attr('in', 'b')
      merge.append('feMergeNode').attr('in', 'SourceGraphic')

      // Face
      root
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', outerR + 8)
        .attr('fill', TOKENS.panel)
        .attr('stroke', TOKENS.panelBorder)
        .attr('stroke-width', 2)

      // Hour marks
      for (let h = 0; h < 24; h++) {
        const a = toAngle(h * 60)
        const r0 = outerR + 2
        const r1 = outerR + (h % 6 === 0 ? 10 : 6)
        root
          .append('line')
          .attr('x1', cx + Math.cos(a) * r0)
          .attr('y1', cy + Math.sin(a) * r0)
          .attr('x2', cx + Math.cos(a) * r1)
          .attr('y2', cy + Math.sin(a) * r1)
          .attr('stroke', TOKENS.muted)
          .attr('stroke-width', h % 6 === 0 ? 2 : 1)
        if (h % 6 === 0) {
          root
            .append('text')
            .attr('x', cx + Math.cos(a) * (outerR + 20))
            .attr('y', cy + Math.sin(a) * (outerR + 20))
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', TOKENS.mutedSoft)
            .attr('font-size', 10)
            .attr('font-family', 'JetBrains Mono, monospace')
            .text(String(h).padStart(2, '0'))
        }
      }

      const arcGen = arc<{ startAngle: number; endAngle: number }>()
        .innerRadius(0)
        .outerRadius(0)
        .startAngle((d) => d.startAngle + Math.PI / 2)
        .endAngle((d) => d.endAngle + Math.PI / 2)

      // Opening-hour rings (one per building)
      buildingIds.forEach((bid, i) => {
        const b = buildingById(caseData, bid)
        if (!b) return
        const rOut = outerR - i * ringGap
        const rIn = rOut - ringGap + 2
        const ringArc = arcGen.innerRadius(rIn).outerRadius(rOut)

        // Dim full ring
        root
          .append('circle')
          .attr('cx', cx)
          .attr('cy', cy)
          .attr('r', (rIn + rOut) / 2)
          .attr('fill', 'none')
          .attr('stroke', '#3b2c20')
          .attr('stroke-width', rOut - rIn)

        if (b.always_open) {
          root
            .append('circle')
            .attr('cx', cx)
            .attr('cy', cy)
            .attr('r', (rIn + rOut) / 2)
            .attr('fill', 'none')
            .attr('stroke', '#2e8b57')
            .attr('stroke-opacity', 0.35)
            .attr('stroke-width', rOut - rIn)
        } else {
          const openStart = b.open_start
          const openEnd = b.open_end
          for (const seg of daySegments(openStart, openEnd)) {
            root
              .append('path')
              .attr(
                'd',
                ringArc({
                  startAngle: seg.a0,
                  endAngle: seg.a1,
                }) ?? '',
              )
              .attr('transform', `translate(${cx},${cy})`)
              .attr('fill', '#2e8b57')
              .attr('opacity', 0.28)
          }
        }
      })

      // Visit arcs
      visits.forEach((v) => {
        const bi = buildingIds.indexOf(v.building_id)
        if (bi < 0) return
        const rOut = outerR - bi * ringGap - 1
        const rIn = rOut - ringGap + 4
        const visitArc = arcGen.innerRadius(rIn).outerRadius(rOut)
        const b = buildingById(caseData, v.building_id)

        // Split into open vs out-of-hours portions (5-min samples)
        let t = v.start
        while (t < v.end) {
          const next = Math.min(t + 10, v.end)
          const ooh = b ? !isOpenAt(b, t) : false
          for (const seg of daySegments(t, next)) {
            const path = root
              .append('path')
              .attr(
                'd',
                visitArc({
                  startAngle: seg.a0,
                  endAngle: seg.a1,
                }) ?? '',
              )
              .attr('transform', `translate(${cx},${cy})`)
              .attr('fill', ooh ? TOKENS.pin : TOKENS.accent)
              .attr('opacity', ooh ? 0.95 : 0.8)
            if (ooh) {
              path.attr('filter', `url(#pulse-${studentId})`)
              path
                .append('animate')
                .attr('attributeName', 'opacity')
                .attr('values', '0.55;1;0.55')
                .attr('dur', '1.4s')
                .attr('repeatCount', 'indefinite')
            }
            path.append('title').text(
              `${b?.name ?? v.building_id} ${hhmm(v.start)}–${hhmm(v.end)}${ooh ? ' (out of hours)' : ''}`,
            )
          }
          t = next
        }

        // 18+ badge for age-restricted venues
        if (b?.min_age != null && b.min_age >= 18) {
          const mid = (v.start + v.end) / 2
          const a = toAngle(mid)
          const br = (rIn + rOut) / 2
          root
            .append('circle')
            .attr('cx', cx + Math.cos(a) * br)
            .attr('cy', cy + Math.sin(a) * br)
            .attr('r', 9)
            .attr('fill', TOKENS.warn)
            .attr('stroke', '#fbf7ee')
            .attr('stroke-width', 1)
          root
            .append('text')
            .attr('x', cx + Math.cos(a) * br)
            .attr('y', cy + Math.sin(a) * br)
            .attr('text-anchor', 'middle')
            .attr('dominant-baseline', 'middle')
            .attr('fill', '#fbf7ee')
            .attr('font-size', 8)
            .attr('font-weight', 700)
            .text('18+')
        }
      })

      // Centre: rule-break count
      root
        .append('circle')
        .attr('cx', cx)
        .attr('cy', cy)
        .attr('r', 28)
        .attr('fill', '#1a1410')
        .attr('stroke', TOKENS.accent)
        .attr('stroke-width', 2)
      root
        .append('text')
        .attr('x', cx)
        .attr('y', cy - 4)
        .attr('text-anchor', 'middle')
        .attr('fill', TOKENS.accent)
        .attr('font-size', 20)
        .attr('font-weight', 700)
        .attr('font-family', 'Fredoka, sans-serif')
        .text(String(ruleBreaks))
      root
        .append('text')
        .attr('x', cx)
        .attr('y', cy + 12)
        .attr('text-anchor', 'middle')
        .attr('fill', TOKENS.muted)
        .attr('font-size', 9)
        .text('breaks')
    }

    draw()
    return observeResize(wrap, draw)
  }, [caseData, studentId, visits, buildingIds, ruleBreaks])

  return (
    <div ref={wrapRef} style={{ width: '100%', maxWidth: 320 }}>
      <div
        style={{
          fontFamily: 'Fredoka, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          color: TOKENS.accent,
          marginBottom: 4,
        }}
      >
        24-hour clock
      </div>
      <svg ref={svgRef} style={{ display: 'block', margin: '0 auto' }} />
      <p style={{ margin: '4px 0 0', fontSize: 11, color: TOKENS.muted }}>
        Rings = building hours. Orange arcs = visits; pulsing red = out of
        hours. Centre counts rule breaks. Handles visits past midnight.
      </p>
    </div>
  )
}
