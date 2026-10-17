import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3'
import type { RuleId } from '../../types/case'
import { useCaseStore } from '../../store/useCaseStore'
import { observeResize, useVisibleFlags, TOKENS } from './util'

const RULE_LABELS: Record<RuleId, string> = {
  missing_lecture: 'Missing lecture',
  multiple_lectures: 'Multiple lectures',
  left_lecture_early: 'Left lecture early',
  out_of_hours: 'Out of hours',
  impossible_overlap: 'Impossible overlap',
  age_restricted_venue: 'Age-restricted venue',
  id_mismatch: 'ID mismatch',
  id_format: 'ID format',
  statement_contradiction: 'Statement contradiction',
  statement_omission: 'Statement omission',
  false_society_claim: 'False society claim',
  subject_without_lecture: 'Subject without lecture',
}

function severityColor(avg: number): string {
  if (avg >= 2.5) return TOKENS.pin
  if (avg >= 1.5) return TOKENS.warn
  if (avg >= 0.5) return TOKENS.accent
  return TOKENS.muted
}

export default function RuleBars() {
  const caseData = useCaseStore((s) => s.case)
  const setHint = useCaseStore((s) => s.setHint)
  const flags = useVisibleFlags()
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const rows = useMemo(() => {
    const map = new Map<RuleId, { count: number; sevSum: number }>()
    for (const f of flags) {
      const cur = map.get(f.rule) ?? { count: 0, sevSum: 0 }
      cur.count += 1
      cur.sevSum += f.severity
      map.set(f.rule, cur)
    }
    return [...map.entries()]
      .map(([rule, v]) => ({
        rule,
        label: RULE_LABELS[rule] ?? rule,
        count: v.count,
        avgSeverity: v.count ? v.sevSum / v.count : 0,
      }))
      .sort((a, b) => b.count - a.count)
  }, [flags])

  const maxCount = Math.max(1, ...rows.map((r) => r.count))

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg) return

    const draw = () => {
      const width = wrap.clientWidth || 400
      const rowH = 26
      const left = 150
      const right = 36
      const barMax = Math.max(40, width - left - right)
      const height = Math.max(56, 28 + Math.max(rows.length, 1) * rowH)

      const root = select(svg)
      root.selectAll('*').remove()
      root.attr('width', width).attr('height', height)

      const g = root.append('g').attr('transform', 'translate(0,20)')

      rows.forEach((row, i) => {
        const y = i * rowH
        const bw = (row.count / maxCount) * barMax
        const color = severityColor(row.avgSeverity)

        g.append('text')
          .attr('x', left - 8)
          .attr('y', y + rowH / 2 - 2)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .attr('fill', TOKENS.mutedSoft)
          .attr('font-size', 11)
          .text(row.label)

        g.append('rect')
          .attr('x', left)
          .attr('y', y + 4)
          .attr('width', bw)
          .attr('height', rowH - 10)
          .attr('rx', 4)
          .attr('fill', color)
          .attr('opacity', 0.9)
          .style('cursor', 'pointer')
          .on('click', () => setHint(row.label))
          .append('title')
          .text(
            `${row.label}: ${row.count} flags · avg severity ${row.avgSeverity.toFixed(1)}`,
          )

        g.append('text')
          .attr('x', left + bw + 6)
          .attr('y', y + rowH / 2 - 2)
          .attr('dominant-baseline', 'middle')
          .attr('fill', TOKENS.muted)
          .attr('font-size', 11)
          .attr('font-family', 'JetBrains Mono, monospace')
          .text(String(row.count))
      })

      if (rows.length === 0) {
        g.append('text')
          .attr('x', width / 2)
          .attr('y', 20)
          .attr('text-anchor', 'middle')
          .attr('fill', TOKENS.muted)
          .attr('font-size', 12)
          .text(caseData ? 'No flags revealed yet' : 'Load a case to see rules')
      }
    }

    draw()
    return observeResize(wrap, draw)
  }, [rows, maxCount, setHint, caseData])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div
        style={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 600,
          fontSize: 13,
          color: TOKENS.accent,
          marginBottom: 4,
        }}
      >
        Rules that cracked the cover story
      </div>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      <p style={{ margin: '4px 0 0', fontSize: 11, color: TOKENS.muted }}>
        Longer bar = more flags. Colour = average severity. Click a rule to pin
        it as the investigation hint.
      </p>
    </div>
  )
}
