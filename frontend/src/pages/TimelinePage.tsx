import { useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import TimeSlider from '../components/viz/TimeSlider'
import StoryChapter from '../components/viz/StoryChapter'
import VizPageShell from '../components/viz/VizPageShell'
import { hhmm, observeResize } from '../components/viz/util'
import { useCaseStore } from '../store/useCaseStore'
import type { Building, Case, Meeting, Student, Visit } from '../types/case'
import '../components/viz/viz-story.css'

type FilterMode = 'all' | 'flagged' | 'contacts'

function closedIntervals(
  b: Building,
  t0: number,
  t1: number,
): [number, number][] {
  if (b.always_open) return []
  const openStart = b.open_start
  const openEnd = b.open_end // may be > 1440 for overnight
  const closed: [number, number][] = []
  if (t0 < openStart) closed.push([t0, Math.min(t1, openStart)])
  if (t1 > openEnd) closed.push([Math.max(t0, openEnd), t1])
  // If open window is empty relative to domain, hatch everything
  if (openEnd <= openStart && !b.always_open) {
    return [[t0, t1]]
  }
  return closed.filter(([a, b_]) => b_ > a)
}

function isLectureVisit(c: Case, v: Visit): boolean {
  const st = c.students.find((s) => s.id === v.student_id)
  if (!st?.lecture || !st.lecture_building_id) return false
  if (v.building_id !== st.lecture_building_id) return false
  return v.start < st.lecture.end && v.end > st.lecture.start
}

function statementSnippet(c: Case, studentId: string): string {
  const st = c.statements.find((s) => s.student_id === studentId)
  if (!st?.text) return 'No statement on file.'
  const t = st.text.replace(/\s+/g, ' ').trim()
  return t.length > 90 ? `${t.slice(0, 87)}…` : t
}

export default function TimelinePage() {
  const c = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const selectedStudentId = useCaseStore((s) => s.selectedStudentId)
  const selectStudent = useCaseStore((s) => s.selectStudent)
  const judgeMode = useCaseStore((s) => s.judgeMode)
  const revealedFlagIds = useCaseStore((s) => s.revealedFlagIds)

  const [filter, setFilter] = useState<FilterMode>('all')
  const [brushDomain, setBrushDomain] = useState<[number, number] | null>(null)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const tooltipRef = useRef<HTMLDivElement | null>(null)

  const visibleStudents = useMemo(() => {
    if (!c) return [] as Student[]
    if (filter === 'all') return c.students
    if (filter === 'flagged') {
      const ids = new Set(c.flags.map((f) => f.student_id))
      return c.students.filter((s) => ids.has(s.id))
    }
    // Selected + contacts
    if (!selectedStudentId) return c.students
    const ids = new Set<string>([selectedStudentId])
    for (const m of c.meetings) {
      if (m.a === selectedStudentId) ids.add(m.b)
      if (m.b === selectedStudentId) ids.add(m.a)
    }
    return c.students.filter((s) => ids.has(s.id))
  }, [c, filter, selectedStudentId])

  const visibleIdSet = useMemo(
    () => new Set(visibleStudents.map((s) => s.id)),
    [visibleStudents],
  )

  useEffect(() => {
    const svgEl = svgRef.current
    const wrap = wrapRef.current
    const tip = tooltipRef.current
    if (!svgEl || !wrap || !c) return

    const svg = d3.select(svgEl)
    const buildings = c.buildings
    const tMin = c.meta.time_min
    const tMax = c.meta.time_max

    const draw = () => {
      const { width, height } = wrap.getBoundingClientRect()
      if (width < 80 || height < 80) return

      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height)
      svg.selectAll('*').remove()

      const margin = { top: 28, right: 16, bottom: 52, left: 128 }
      const innerW = width - margin.left - margin.right
      const innerH = height - margin.top - margin.bottom
      if (innerW < 40 || innerH < 40) return

      const domain: [number, number] = brushDomain ?? [tMin, tMax]
      const x = d3.scaleLinear().domain(domain).range([0, innerW])
      const y = d3
        .scaleBand()
        .domain(buildings.map((b) => b.id))
        .range([0, innerH])
        .padding(0.18)

      const root = svg.append('g').attr('transform', `translate(${margin.left},${margin.top})`)

      // Hatch pattern for closed hours
      const defs = svg.append('defs')
      defs
        .append('pattern')
        .attr('id', 'closed-hatch')
        .attr('patternUnits', 'userSpaceOnUse')
        .attr('width', 6)
        .attr('height', 6)
        .append('path')
        .attr('d', 'M0,6 L6,0')
        .attr('stroke', '#5a4636')
        .attr('stroke-width', 1)

      // Background
      root
        .append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('fill', '#141018')

      // Light vertical hour guides (behind paths)
      {
        const hourStart = Math.ceil(domain[0] / 60) * 60
        for (let t = hourStart; t <= domain[1]; t += 60) {
          root
            .append('line')
            .attr('x1', x(t))
            .attr('x2', x(t))
            .attr('y1', 0)
            .attr('y2', innerH)
            .attr('stroke', '#2a2230')
            .attr('stroke-width', 1)
            .attr('pointer-events', 'none')
        }
      }

      // Closed-hours per row
      for (const b of buildings) {
        const yy = y(b.id)
        if (yy == null) continue
        const h = y.bandwidth()
        for (const [a, bEnd] of closedIntervals(b, domain[0], domain[1])) {
          const x0 = x(a)
          const x1 = x(bEnd)
          root
            .append('rect')
            .attr('x', x0)
            .attr('y', yy)
            .attr('width', Math.max(0, x1 - x0))
            .attr('height', h)
            .attr('fill', 'url(#closed-hatch)')
            .attr('opacity', 0.7)
        }
      }

      // Row labels
      root
        .append('g')
        .selectAll('text')
        .data(buildings)
        .join('text')
        .attr('x', -8)
        .attr('y', (b) => (y(b.id) ?? 0) + y.bandwidth() / 2)
        .attr('text-anchor', 'end')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#d9c3a5')
        .attr('font-size', 11)
        .text((b) => (b.name.length > 16 ? `${b.name.slice(0, 14)}…` : b.name))

      // Per-student vertical offset inside a row
      const offsetOf = new Map<string, number>()
      visibleStudents.forEach((s, i) => {
        const n = Math.max(visibleStudents.length, 1)
        offsetOf.set(s.id, ((i + 0.5) / n - 0.5) * y.bandwidth() * 0.7)
      })

      // Student paths
      const line = d3
        .line<{ t: number; y: number }>()
        .x((d) => x(d.t))
        .y((d) => d.y)
        .curve(d3.curveMonotoneX)

      const visitsByStudent = d3.group(
        c.visits.filter((v) => visibleIdSet.has(v.student_id)),
        (v) => v.student_id,
      )

      for (const st of visibleStudents) {
        const visits = (visitsByStudent.get(st.id) ?? [])
          .slice()
          .sort((a, b) => a.start - b.start)
        if (visits.length === 0) continue

        const pts: { t: number; y: number }[] = []
        for (const v of visits) {
          const rowY = y(v.building_id)
          if (rowY == null) continue
          const cy = rowY + y.bandwidth() / 2 + (offsetOf.get(st.id) ?? 0)
          // sample start + mid + end for smoother monotone transitions between rows
          pts.push({ t: v.start, y: cy })
          pts.push({ t: (v.start + v.end) / 2, y: cy })
          pts.push({ t: v.end, y: cy })
        }
        if (pts.length < 2) continue

        const selected = st.id === selectedStudentId
        const path = root
          .append('path')
          .datum(pts)
          .attr('d', line)
          .attr('fill', 'none')
          .attr('stroke', selected ? 'var(--accent)' : '#6b7c93')
          .attr('stroke-width', selected ? 2.2 : 1.2)
          .attr('opacity', selected || !selectedStudentId ? 0.9 : 0.35)
          .attr('cursor', 'pointer')
          .on('mouseenter', (event: MouseEvent) => {
            if (!tip) return
            tip.style.display = 'block'
            tip.innerHTML = `<strong>${st.name}</strong><br/>${statementSnippet(c, st.id)}`
            tip.style.left = `${event.offsetX + 12}px`
            tip.style.top = `${event.offsetY + 12}px`
          })
          .on('mousemove', (event: MouseEvent) => {
            if (!tip) return
            tip.style.left = `${event.offsetX + 12}px`
            tip.style.top = `${event.offsetY + 12}px`
          })
          .on('mouseleave', () => {
            if (tip) tip.style.display = 'none'
          })
          .on('click', (event: MouseEvent) => {
            event.stopPropagation()
            selectStudent(st.id === selectedStudentId ? null : st.id)
          })

        // Thicker segments for lecture visits
        for (const v of visits) {
          if (!isLectureVisit(c, v)) continue
          const rowY = y(v.building_id)
          if (rowY == null) continue
          const cy = rowY + y.bandwidth() / 2 + (offsetOf.get(st.id) ?? 0)
          root
            .append('line')
            .attr('x1', x(v.start))
            .attr('x2', x(v.end))
            .attr('y1', cy)
            .attr('y2', cy)
            .attr('stroke', selected ? 'var(--accent)' : '#8fa0b8')
            .attr('stroke-width', 4)
            .attr('stroke-linecap', 'round')
            .attr('opacity', 0.85)
            .attr('pointer-events', 'none')
        }

        void path
      }

      // Flags as red × markers
      const showFlags = c.flags.filter((f) => {
        if (!visibleIdSet.has(f.student_id)) return false
        if (!judgeMode && !revealedFlagIds.has(f.id)) return false
        if (f.time == null || f.building_id == null) return false
        return f.time >= domain[0] && f.time <= domain[1]
      })

      root
        .append('g')
        .selectAll('text')
        .data(showFlags)
        .join('text')
        .attr('x', (f) => x(f.time!))
        .attr('y', (f) => {
          const rowY = y(f.building_id!)
          const off = offsetOf.get(f.student_id) ?? 0
          return (rowY ?? 0) + y.bandwidth() / 2 + off
        })
        .attr('text-anchor', 'middle')
        .attr('dominant-baseline', 'middle')
        .attr('fill', '#c0392b')
        .attr('font-size', 14)
        .attr('font-weight', 700)
        .attr('cursor', 'pointer')
        .text('×')
        .append('title')
        .text((f) => f.title)

      // Gold rings for meetings involving selected student
      if (selectedStudentId) {
        const meets: Meeting[] = c.meetings.filter(
          (m) =>
            (m.a === selectedStudentId || m.b === selectedStudentId) &&
            m.start >= domain[0] &&
            m.start <= domain[1],
        )
        root
          .append('g')
          .selectAll('circle')
          .data(meets)
          .join('circle')
          .attr('cx', (m) => x(m.start))
          .attr('cy', (m) => {
            const rowY = y(m.building_id)
            const off = offsetOf.get(selectedStudentId) ?? 0
            return (rowY ?? 0) + y.bandwidth() / 2 + off
          })
          .attr('r', 7)
          .attr('fill', 'none')
          .attr('stroke', '#e3af35')
          .attr('stroke-width', 2)
          .attr('pointer-events', 'none')
      }

      // Replay time vertical line
      root
        .append('line')
        .attr('x1', x(replayTime))
        .attr('x2', x(replayTime))
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', 'var(--accent)')
        .attr('stroke-width', 1.5)
        .attr('stroke-dasharray', '4 3')
        .attr('pointer-events', 'none')

      root
        .append('text')
        .attr('x', x(replayTime))
        .attr('y', -6)
        .attr('text-anchor', 'middle')
        .attr('fill', 'var(--accent)')
        .attr('font-size', 11)
        .attr('font-family', 'var(--font-mono)')
        .text(hhmm(replayTime))

      // Time axes (top + bottom) so the day is readable without reading the slider only
      const axisBottom = d3
        .axisBottom(x)
        .ticks(10)
        .tickFormat((d) => hhmm(Number(d)))
      const axisTop = d3
        .axisTop(x)
        .ticks(10)
        .tickFormat((d) => hhmm(Number(d)))
      root
        .append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(axisBottom)
        .selectAll('text')
        .attr('fill', '#a8927a')
        .attr('font-size', 10)
      root
        .append('g')
        .call(axisTop)
        .selectAll('text')
        .attr('fill', '#a8927a')
        .attr('font-size', 10)
      root.selectAll('.domain, .tick line').attr('stroke', '#4a3524')

      // Brush strip at bottom of plot so student paths stay clickable
      const brushH = 22
      const brush = d3
        .brushX()
        .extent([
          [0, innerH - brushH],
          [innerW, innerH],
        ])
        .on('end', (event) => {
          if (!event.selection) return
          const [x0, x1] = event.selection as [number, number]
          const d0 = x.invert(x0)
          const d1 = x.invert(x1)
          if (d1 - d0 < 30) return
          setBrushDomain([d0, d1])
        })

      const brushG = root.append('g').attr('class', 'brush').call(brush)
      brushG.select('.overlay').attr('cursor', 'ew-resize')
      brushG
        .selectAll('.selection')
        .attr('fill', 'var(--accent)')
        .attr('fill-opacity', 0.15)

      root
        .append('text')
        .attr('x', innerW / 2)
        .attr('y', innerH - 6)
        .attr('text-anchor', 'middle')
        .attr('fill', '#6a5a48')
        .attr('font-size', 9)
        .attr('pointer-events', 'none')
        .text('drag here to zoom time')

      svg.on('dblclick', () => setBrushDomain(null))
    }

    draw()
    const stopRo = observeResize(wrap, draw)
    return () => {
      stopRo()
      svg.selectAll('*').remove()
    }
  }, [
    c,
    replayTime,
    selectedStudentId,
    filter,
    brushDomain,
    visibleStudents,
    visibleIdSet,
    judgeMode,
    revealedFlagIds,
    selectStudent,
  ])

  if (!c) {
    return (
      <div className="page">
        <h2 className="page-title">Timeline — the day</h2>
        <p className="caption">Loading case…</p>
      </div>
    )
  }

  return (
    <VizPageShell>
      <StoryChapter
        chapter="timeline"
        subtitle={`${hhmm(c.meta.time_min)} → ${hhmm(c.meta.time_max)} · storyline`}
        toolbar={
          <>
            {(
              [
                ['all', 'All'],
                ['flagged', 'Flagged only'],
                ['contacts', 'Selected + contacts'],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={`btn${filter === id ? ' accent' : ''}`}
                onClick={() => setFilter(id)}
              >
                {label}
              </button>
            ))}
            {brushDomain && (
              <button type="button" className="btn" onClick={() => setBrushDomain(null)}>
                Reset zoom
              </button>
            )}
          </>
        }
      />

      <div
        className="viz-stage panel story-stage"
        ref={wrapRef}
        style={{ padding: 0, position: 'relative', minHeight: 420 }}
      >
        <svg ref={svgRef} role="img" aria-label="Day storyline timeline" />
        <div ref={tooltipRef} className="tooltip" style={{ display: 'none' }} />
      </div>

      <TimeSlider />
    </VizPageShell>
  )
}
