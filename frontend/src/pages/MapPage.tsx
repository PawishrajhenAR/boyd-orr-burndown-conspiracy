import { useEffect, useMemo, useRef } from 'react'
import * as d3 from 'd3'
import TimeSlider from '../components/viz/TimeSlider'
import { hhmm, verdictColor } from '../components/viz/util'
import {
  buildingById,
  studentById,
  suspectFor,
  useCaseStore,
  visitsFor,
} from '../store/useCaseStore'
import type { Flag, Student } from '../types/case'

interface OccNode {
  id: string
  student: Student
  buildingId: string
  x: number
  y: number
}

function studentDotColor(
  studentId: string,
  judgeMode: boolean,
): string {
  const c = useCaseStore.getState().case
  const sus = suspectFor(c, studentId)
  if (!sus) return '#c8b89a'
  if (sus.verdict === 'mastermind') {
    return judgeMode ? verdictColor('mastermind') : '#c8b89a'
  }
  if (sus.verdict === 'conspirator') return verdictColor('conspirator')
  return verdictColor(sus.verdict)
}

function flagsAtBuilding(
  flags: Flag[],
  buildingId: string,
  t: number,
  revealed: Set<string>,
  judgeMode: boolean,
): Flag[] {
  return flags.filter((f) => {
    if (f.building_id !== buildingId) return false
    if (!judgeMode && !revealed.has(f.id)) return false
    if (f.time == null) return false
    return Math.abs(f.time - t) <= 30
  })
}

export default function MapPage() {
  const c = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const selectedBuildingId = useCaseStore((s) => s.selectedBuildingId)
  const selectedStudentId = useCaseStore((s) => s.selectedStudentId)
  const selectBuilding = useCaseStore((s) => s.selectBuilding)
  const selectStudent = useCaseStore((s) => s.selectStudent)
  const judgeMode = useCaseStore((s) => s.judgeMode)
  const revealedFlagIds = useCaseStore((s) => s.revealedFlagIds)

  const svgRef = useRef<SVGSVGElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)

  const visitCounts = useMemo(() => {
    const m = new Map<string, number>()
    if (!c) return m
    for (const v of c.visits) m.set(v.building_id, (m.get(v.building_id) ?? 0) + 1)
    return m
  }, [c])

  const occupantsByBuilding = useMemo(() => {
    const m = new Map<string, Student[]>()
    if (!c) return m
    const byId = new Map(c.students.map((s) => [s.id, s]))
    for (const v of c.visits) {
      if (v.start <= replayTime && replayTime < v.end) {
        const st = byId.get(v.student_id)
        if (!st) continue
        const list = m.get(v.building_id) ?? []
        if (!list.some((x) => x.id === st.id)) list.push(st)
        m.set(v.building_id, list)
      }
    }
    return m
  }, [c, replayTime])

  const selectedBuilding = buildingById(c, selectedBuildingId)
  const selectedStudent = studentById(c, selectedStudentId)

  const sideOccupants = selectedBuildingId
    ? (occupantsByBuilding.get(selectedBuildingId) ?? [])
    : []
  const sideFlags =
    c && selectedBuildingId
      ? flagsAtBuilding(c.flags, selectedBuildingId, replayTime, revealedFlagIds, judgeMode)
      : []

  useEffect(() => {
    const svgEl = svgRef.current
    const wrap = wrapRef.current
    if (!svgEl || !wrap || !c) return

    const svg = d3.select(svgEl)
    const buildings = c.buildings

    const draw = () => {
      const { width, height } = wrap.getBoundingClientRect()
      if (width < 40 || height < 40) return

      svg.attr('viewBox', `0 0 ${width} ${height}`).attr('width', width).attr('height', height)
      svg.selectAll('*').remove()

      const g = svg.append('g')

      // Dark campus backdrop
      g.append('rect')
        .attr('width', width)
        .attr('height', height)
        .attr('fill', '#0e1218')

      const pad = 48
      const projection = d3.geoMercator().fitExtent(
        [
          [pad, pad],
          [width - pad, height - pad],
        ],
        {
          type: 'FeatureCollection',
          features: buildings.map((b) => ({
            type: 'Feature' as const,
            properties: {},
            geometry: { type: 'Point' as const, coordinates: [b.lon, b.lat] },
          })),
        },
      )

      const maxVisits = d3.max([...visitCounts.values()]) ?? 1
      const rScale = d3.scaleSqrt().domain([0, maxVisits]).range([14, 36])

      const positions = new Map<string, [number, number]>()
      for (const b of buildings) {
        const p = projection([b.lon, b.lat])
        if (p) positions.set(b.id, p)
      }

      // Soft glow layer for flagged buildings
      const glowLayer = g.append('g').attr('class', 'glows')
      const bLayer = g.append('g').attr('class', 'buildings')
      const occLayer = g.append('g').attr('class', 'occupants')
      const pathLayer = g.append('g').attr('class', 'student-path')
      const labelLayer = g.append('g').attr('class', 'labels')

      for (const b of buildings) {
        const xy = positions.get(b.id)
        if (!xy) continue
        const [x, y] = xy
        const r = rScale(visitCounts.get(b.id) ?? 0)
        const glowFlags = flagsAtBuilding(
          c.flags,
          b.id,
          replayTime,
          revealedFlagIds,
          judgeMode,
        )
        const selected = b.id === selectedBuildingId

        if (glowFlags.length > 0) {
          glowLayer
            .append('circle')
            .attr('cx', x)
            .attr('cy', y)
            .attr('r', r + 10)
            .attr('fill', 'none')
            .attr('stroke', '#c0392b')
            .attr('stroke-width', 3)
            .attr('opacity', 0.85)
            .style('filter', 'drop-shadow(0 0 8px #c0392b)')
        }

        bLayer
          .append('circle')
          .attr('cx', x)
          .attr('cy', y)
          .attr('r', r)
          .attr('fill', selected ? '#3b2c20' : '#1c2433')
          .attr('stroke', selected ? 'var(--accent)' : '#4a5568')
          .attr('stroke-width', selected ? 2.5 : 1.5)
          .attr('cursor', 'pointer')
          .on('click', (event: MouseEvent) => {
            event.stopPropagation()
            selectBuilding(b.id === selectedBuildingId ? null : b.id)
          })

        labelLayer
          .append('text')
          .attr('x', x)
          .attr('y', y + r + 14)
          .attr('text-anchor', 'middle')
          .attr('fill', '#d9c3a5')
          .attr('font-size', 11)
          .attr('font-family', 'var(--font-body)')
          .text(b.name.length > 18 ? `${b.name.slice(0, 16)}…` : b.name)
          .attr('pointer-events', 'none')
      }

      // Occupant dots with forceCollide around each building
      const nodes: OccNode[] = []
      for (const [bid, students] of occupantsByBuilding) {
        const xy = positions.get(bid)
        if (!xy) continue
        const [bx, by] = xy
        for (const st of students) {
          nodes.push({
            id: st.id,
            student: st,
            buildingId: bid,
            x: bx + (Math.random() - 0.5) * 8,
            y: by + (Math.random() - 0.5) * 8,
          })
        }
      }

      const sim = d3
        .forceSimulation(nodes)
        .force(
          'x',
          d3.forceX<OccNode>((d) => positions.get(d.buildingId)?.[0] ?? 0).strength(0.85),
        )
        .force(
          'y',
          d3.forceY<OccNode>((d) => positions.get(d.buildingId)?.[1] ?? 0).strength(0.85),
        )
        .force('collide', d3.forceCollide(7))
        .stop()
      for (let i = 0; i < 60; i++) sim.tick()

      occLayer
        .selectAll('circle')
        .data(nodes, (d) => (d as OccNode).id)
        .join('circle')
        .attr('cx', (d) => d.x)
        .attr('cy', (d) => d.y)
        .attr('r', 5)
        .attr('fill', (d) => studentDotColor(d.id, judgeMode))
        .attr('stroke', (d) => (d.id === selectedStudentId ? '#fff' : 'none'))
        .attr('stroke-width', 1.5)
        .attr('cursor', 'pointer')
        .on('click', (event: MouseEvent, d) => {
          event.stopPropagation()
          selectStudent(d.id === selectedStudentId ? null : d.id)
        })
        .append('title')
        .text((d) => d.student.name)

      // Selected student path through buildings in time order
      if (selectedStudentId) {
        const visits = visitsFor(c, selectedStudentId)
          .slice()
          .sort((a, b) => a.start - b.start)
        const pts: [number, number][] = []
        for (const v of visits) {
          const xy = positions.get(v.building_id)
          if (xy) pts.push(xy)
        }
        if (pts.length >= 2) {
          const line = d3.line<[number, number]>().curve(d3.curveCardinal.tension(0.4))
          const path = pathLayer
            .append('path')
            .attr('d', line(pts))
            .attr('fill', 'none')
            .attr('stroke', 'var(--accent)')
            .attr('stroke-width', 2)
            .attr('opacity', 0.9)
            .attr('pointer-events', 'none')

          const node = path.node()
          if (node) {
            const len = node.getTotalLength()
            path
              .attr('stroke-dasharray', `${len}`)
              .attr('stroke-dashoffset', len)
              .transition()
              .duration(900)
              .ease(d3.easeCubicOut)
              .attr('stroke-dashoffset', 0)
          }

          pathLayer
            .selectAll('circle.path-node')
            .data(pts)
            .join('circle')
            .attr('class', 'path-node')
            .attr('cx', (d) => d[0])
            .attr('cy', (d) => d[1])
            .attr('r', 3)
            .attr('fill', 'var(--accent)')
            .attr('pointer-events', 'none')
        }
      }

      svg.on('click', () => selectBuilding(null))
    }

    draw()
    const ro = new ResizeObserver(() => draw())
    ro.observe(wrap)
    return () => {
      ro.disconnect()
      svg.selectAll('*').remove()
    }
  }, [
    c,
    replayTime,
    selectedBuildingId,
    selectedStudentId,
    judgeMode,
    revealedFlagIds,
    visitCounts,
    occupantsByBuilding,
    selectBuilding,
    selectStudent,
  ])

  if (!c) {
    return (
      <div className="page">
        <h2 className="page-title">Map — where it happened</h2>
        <p className="caption">Loading case…</p>
      </div>
    )
  }

  return (
    <div className="page">
      <h2 className="page-title">
        Map — where it happened
        <small>{c.meta.day_label}</small>
      </h2>
      <p className="caption">
        How to read: circles are buildings (size = visit count). Dots are people inside at the
        replay time — red = conspirator, gold = mastermind (judge mode). Red glow = a flag fired
        there near now. Click a building for details; select a student to trace their path.
      </p>

      <div className="row">
        <div className="viz-stage panel" ref={wrapRef} style={{ padding: 0 }}>
          <svg ref={svgRef} role="img" aria-label="Campus map" />
        </div>

        <aside className="side-panel">
          {selectedBuilding ? (
            <>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                {selectedBuilding.name}
              </h3>
              <p className="caption" style={{ marginBottom: 8 }}>
                {selectedBuilding.open_label}
              </p>
              <p style={{ fontSize: 13, margin: '0 0 12px' }}>{selectedBuilding.description}</p>

              {selectedBuilding.lectures.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <strong style={{ fontSize: 12, color: 'var(--muted-dark)' }}>Lectures</strong>
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {selectedBuilding.lectures.map((lec) => (
                      <li key={`${lec.subject}-${lec.start}`}>
                        {lec.subject} · {hhmm(lec.start)}–{hhmm(lec.end)}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div style={{ marginBottom: 12 }}>
                <strong style={{ fontSize: 12, color: 'var(--muted-dark)' }}>
                  Inside now ({hhmm(replayTime)})
                </strong>
                {sideOccupants.length === 0 ? (
                  <p className="caption">Nobody here.</p>
                ) : (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {sideOccupants.map((s) => (
                      <li key={s.id}>
                        <button
                          type="button"
                          className="btn"
                          style={{ padding: '2px 8px', marginBottom: 4 }}
                          onClick={() => selectStudent(s.id)}
                        >
                          {s.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div>
                <strong style={{ fontSize: 12, color: 'var(--muted-dark)' }}>Flags near now</strong>
                {sideFlags.length === 0 ? (
                  <p className="caption">None at this time.</p>
                ) : (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 18, fontSize: 13 }}>
                    {sideFlags.map((f) => (
                      <li key={f.id} style={{ color: 'var(--danger)' }}>
                        {f.title}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <h3 style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>
                Building info
              </h3>
              <p className="caption">Click a building on the map.</p>
              {selectedStudent && (
                <p style={{ fontSize: 13, marginTop: 12 }}>
                  Tracing <strong>{selectedStudent.name}</strong>
                  <button
                    type="button"
                    className="btn"
                    style={{ marginLeft: 8 }}
                    onClick={() => selectStudent(null)}
                  >
                    Clear
                  </button>
                </p>
              )}
            </>
          )}
        </aside>
      </div>

      <TimeSlider />
    </div>
  )
}
