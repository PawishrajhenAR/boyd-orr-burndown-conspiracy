/**
 * Network page — dark link-analysis "who met whom" graph (P5).
 * Force layout reheats only when topology changes; replayTime filters edge visibility without re-sim.
 */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import * as d3 from 'd3'
import TimeSlider from '../components/viz/TimeSlider'
import StoryChapter from '../components/viz/StoryChapter'
import VizPageShell from '../components/viz/VizPageShell'
import { hhmm, NETWORK, observeResize, verdictColor } from '../components/viz/util'
import '../components/viz/viz-story.css'
import { flagsFor, meetingsUntil, suspectFor, useCaseStore } from '../store/useCaseStore'
import type { Case, Meeting, Student, Suspect, Verdict } from '../types/case'

type NodeKind = 'student' | 'building'

interface GraphNode extends d3.SimulationNodeDatum {
  id: string
  kind: NodeKind
  label: string
  verdict?: Verdict
}

interface GraphLink extends d3.SimulationLinkDatum<GraphNode> {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  meeting: Meeting
  buildingName: string
  gold?: boolean
}

const FLAGGED: Verdict[] = ['conspirator', 'suspicious', 'mastermind']

function buildTopology(
  c: Case,
  minMinutes: number,
  flaggedOnly: boolean,
  showPlaces: boolean,
): { nodes: GraphNode[]; links: GraphLink[] } {
  const byId = new Map(c.students.map((s) => [s.id, s]))
  const suspectBy = new Map(c.suspects.map((s) => [s.student_id, s]))
  const buildingName = new Map(c.buildings.map((b) => [b.id, b.name]))

  const longMeetings = c.meetings.filter((m) => m.minutes >= minMinutes)

  let studentIds: Set<string>
  if (flaggedOnly) {
    const seeds = new Set(
      c.suspects.filter((s) => FLAGGED.includes(s.verdict)).map((s) => s.student_id),
    )
    studentIds = new Set(seeds)
    for (const m of longMeetings) {
      if (seeds.has(m.a) || seeds.has(m.b)) {
        studentIds.add(m.a)
        studentIds.add(m.b)
      }
    }
  } else {
    studentIds = new Set(c.students.map((s) => s.id))
  }

  const nodes: GraphNode[] = [...studentIds].map((id) => {
    const st = byId.get(id)
    const sus = suspectBy.get(id)
    return {
      id,
      kind: 'student' as const,
      label: st?.name ?? id,
      verdict: sus?.verdict,
    }
  })

  const nodeSet = new Set(nodes.map((n) => n.id))
  const links: GraphLink[] = []
  const placeIds = new Set<string>()

  for (const m of longMeetings) {
    if (!nodeSet.has(m.a) || !nodeSet.has(m.b)) continue
    const bName = buildingName.get(m.building_id) ?? m.building_id

    if (showPlaces) {
      placeIds.add(m.building_id)
      links.push({
        id: `${m.id}:a`,
        source: m.a,
        target: m.building_id,
        meeting: m,
        buildingName: bName,
      })
      links.push({
        id: `${m.id}:b`,
        source: m.b,
        target: m.building_id,
        meeting: m,
        buildingName: bName,
      })
    } else {
      links.push({
        id: m.id,
        source: m.a,
        target: m.b,
        meeting: m,
        buildingName: bName,
      })
    }
  }

  if (showPlaces) {
    for (const bid of placeIds) {
      nodes.push({
        id: bid,
        kind: 'building',
        label: buildingName.get(bid) ?? bid,
      })
    }
  }

  return { nodes, links }
}

function DetailsPanel({
  student,
  c,
  open,
  setOpen,
}: {
  student: Student | null
  c: Case
  open: Record<string, boolean>
  setOpen: (k: string, v: boolean) => void
}) {
  if (!student) {
    return (
      <aside className="network-details">
        <p className="caption">Select a student node for profile, flags, meetings and societies.</p>
      </aside>
    )
  }

  const sus = suspectFor(c, student.id)
  const flags = flagsFor(c, student.id)
  const meetings = c.meetings.filter((m) => m.a === student.id || m.b === student.id)
  const bName = (id: string) => c.buildings.find((b) => b.id === id)?.name ?? id

  const sections: { key: string; title: string; body: ReactNode }[] = [
    {
      key: 'profile',
      title: 'Profile',
      body: (
        <dl className="net-dl">
          <dt>Name</dt>
          <dd>{student.name}</dd>
          <dt>ID</dt>
          <dd>{student.id}</dd>
          <dt>Subject</dt>
          <dd>{student.subject}</dd>
          <dt>Year / Age</dt>
          <dd>
            {student.year} · {student.age}
          </dd>
          <dt>Hair</dt>
          <dd style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {student.hair_colour?.startsWith('#') ? (
              <span
                title={student.hair_colour}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: 4,
                  background: student.hair_colour,
                  border: '1px solid #2a3355',
                  display: 'inline-block',
                }}
              />
            ) : null}
            {student.hair_colour}
          </dd>
        </dl>
      ),
    },
    {
      key: 'flags',
      title: 'Flags',
      body:
        flags.length === 0 ? (
          <p className="caption">No flags — clean record.</p>
        ) : (
          <ul className="net-list">
            {flags.map((f) => (
              <li key={f.id}>
                <strong style={{ color: '#ff4d5e' }}>{f.title}</strong>
                <div className="caption">{f.detail}</div>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: 'meetings',
      title: 'Meetings',
      body:
        meetings.length === 0 ? (
          <p className="caption">No meetings recorded.</p>
        ) : (
          <ul className="net-list">
            {meetings.map((m) => {
              const other = m.a === student.id ? m.b : m.a
              const otherName = c.students.find((s) => s.id === other)?.name ?? other
              return (
                <li key={m.id}>
                  {otherName} @ {bName(m.building_id)} · {hhmm(m.start)}–{hhmm(m.end)} ({m.minutes}m)
                </li>
              )
            })}
          </ul>
        ),
    },
    {
      key: 'societies',
      title: 'Societies',
      body:
        student.societies.length === 0 ? (
          <p className="caption">None listed.</p>
        ) : (
          <ul className="net-list">
            {student.societies.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        ),
    },
  ]

  return (
    <aside className="network-details">
      <h3 style={{ margin: '0 0 4px', color: verdictColor(sus?.verdict), fontFamily: 'var(--font-display)' }}>
        {student.name}
      </h3>
      {sus && (
        <p className="caption" style={{ marginBottom: 10 }}>
          {sus.verdict} · score {sus.score.toFixed(1)} · met {sus.conspirators_met.length} conspirators
        </p>
      )}
      {sections.map((sec) => (
        <div key={sec.key} className="net-section">
          <button
            type="button"
            className="net-section-head"
            onClick={() => setOpen(sec.key, !open[sec.key])}
          >
            <span>{sec.title}</span>
            <span aria-hidden>{open[sec.key] ? '▾' : '▸'}</span>
          </button>
          {open[sec.key] && <div className="net-section-body">{sec.body}</div>}
        </div>
      ))}
    </aside>
  )
}

export default function NetworkPage() {
  const c = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const setReplayTime = useCaseStore((s) => s.setReplayTime)
  const selectStudent = useCaseStore((s) => s.selectStudent)
  const selectedStudentId = useCaseStore((s) => s.selectedStudentId)
  const judgeMode = useCaseStore((s) => s.judgeMode)
  const setHint = useCaseStore((s) => s.setHint)

  const [minMinutes, setMinMinutes] = useState(1)
  const [showPlaces, setShowPlaces] = useState(false)
  const [flaggedOnly, setFlaggedOnly] = useState(true)
  const [search, setSearch] = useState('')
  const [revealed, setRevealed] = useState(false)
  const [edgeTip, setEdgeTip] = useState<string | null>(null)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    profile: true,
    flags: true,
    meetings: true,
    societies: false,
  })

  const svgRef = useRef<SVGSVGElement | null>(null)
  const wrapRef = useRef<HTMLDivElement | null>(null)
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null)
  const simRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null)
  const nodePosRef = useRef<Map<string, { x: number; y: number }>>(new Map())
  const gRootRef = useRef<d3.Selection<SVGGElement, unknown, null, undefined> | null>(null)

  const topology = useMemo(() => {
    if (!c) return { nodes: [] as GraphNode[], links: [] as GraphLink[] }
    return buildTopology(c, minMinutes, flaggedOnly, showPlaces)
  }, [c, minMinutes, flaggedOnly, showPlaces])

  /** Stable ids for force membership — excludes replayTime so we don't reheat on ticks. */
  const topologyKey = useMemo(() => {
    const n = topology.nodes.map((x) => x.id).sort().join('|')
    const e = topology.links.map((l) => l.id).sort().join('|')
    return `${n}::${e}`
  }, [topology])

  const visibleMeetingIds = useMemo(() => {
    if (!c) return new Set<string>()
    return new Set(meetingsUntil(c, replayTime).map((m) => m.id))
  }, [c, replayTime])

  const mastermind: Suspect | undefined = useMemo(
    () => c?.suspects.find((s) => s.verdict === 'mastermind'),
    [c],
  )
  const conspirators = useMemo(
    () => (c ? c.suspects.filter((s) => s.verdict === 'conspirator').map((s) => s.student_id) : []),
    [c],
  )

  const selectedStudent = useMemo(() => {
    if (!c || !selectedStudentId) return null
    return c.students.find((s) => s.id === selectedStudentId) ?? null
  }, [c, selectedStudentId])

  const setSection = useCallback((k: string, v: boolean) => {
    setOpenSections((prev) => ({ ...prev, [k]: v }))
  }, [])

  const fitView = useCallback(() => {
    const svg = svgRef.current
    const zoom = zoomRef.current
    const wrap = wrapRef.current
    if (!svg || !zoom || !wrap) return
    const { width, height } = wrap.getBoundingClientRect()
    const nodes = topology.nodes
    if (!nodes.length) return
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (const n of nodes) {
      const p = nodePosRef.current.get(n.id) ?? { x: n.x ?? 0, y: n.y ?? 0 }
      minX = Math.min(minX, p.x)
      minY = Math.min(minY, p.y)
      maxX = Math.max(maxX, p.x)
      maxY = Math.max(maxY, p.y)
    }
    const gw = Math.max(maxX - minX, 40)
    const gh = Math.max(maxY - minY, 40)
    const scale = Math.min(2.2, 0.85 * Math.min(width / gw, height / gh))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    const t = d3.zoomIdentity.translate(width / 2 - cx * scale, height / 2 - cy * scale).scale(scale)
    d3.select(svg).transition().duration(400).call(zoom.transform, t)
  }, [topology.nodes])

  const centerOn = useCallback(
    (id: string) => {
      const svg = svgRef.current
      const zoom = zoomRef.current
      const wrap = wrapRef.current
      if (!svg || !zoom || !wrap) return
      const p = nodePosRef.current.get(id)
      if (!p) return
      const { width, height } = wrap.getBoundingClientRect()
      const scale = 1.4
      const t = d3.zoomIdentity.translate(width / 2 - p.x * scale, height / 2 - p.y * scale).scale(scale)
      d3.select(svg).transition().duration(500).call(zoom.transform, t)
      selectStudent(id)
    },
    [selectStudent],
  )

  const onSearch = useCallback(() => {
    if (!c || !search.trim()) return
    const q = search.trim().toLowerCase()
    const hit =
      c.students.find((s) => s.id.toLowerCase() === q) ??
      c.students.find((s) => s.name.toLowerCase().includes(q))
    if (hit) {
      centerOn(hit.id)
      setHint(`Centered on ${hit.name}`)
    } else {
      setHint(`No student matching “${search}”`)
    }
  }, [c, search, centerOn, setHint])

  const revealMastermind = useCallback(() => {
    if (!c || !mastermind) {
      setHint('No mastermind verdict in case data yet.')
      return
    }
    setRevealed(true)
    // Show every meeting so gold edges to all conspirators are visible.
    setReplayTime(c.meta.time_max)
    const n = mastermind.conspirators_met.length
    const total = conspirators.length || n
    setHint(`Clean record · met ${n}/${total}`)
    requestAnimationFrame(() => {
      const wrap = wrapRef.current
      const sim = simRef.current
      const node = sim?.nodes().find((x) => x.id === mastermind.student_id)
      if (!wrap || !node) {
        centerOn(mastermind.student_id)
        return
      }
      const { width, height } = wrap.getBoundingClientRect()
      node.fx = width / 2
      node.fy = height / 2
      sim?.alpha(0.45).restart()
      selectStudent(mastermind.student_id)
      setTimeout(() => centerOn(mastermind.student_id), 400)
    })
  }, [
    c,
    mastermind,
    conspirators.length,
    centerOn,
    selectStudent,
    setHint,
    setReplayTime,
  ])

  // Force + zoom: reheat only when topologyKey changes (not every replayTime tick).
  useEffect(() => {
    if (!c || !svgRef.current || !wrapRef.current) return

    const svgEl = svgRef.current
    const wrap = wrapRef.current
    const { width, height } = wrap.getBoundingClientRect()

    // Restore prior positions when possible
    const nodes: GraphNode[] = topology.nodes.map((n) => {
      const prev = nodePosRef.current.get(n.id)
      return {
        ...n,
        x: prev?.x ?? width / 2 + (Math.random() - 0.5) * 80,
        y: prev?.y ?? height / 2 + (Math.random() - 0.5) * 80,
      }
    })
    const links: GraphLink[] = topology.links.map((l) => ({ ...l }))

    const svg = d3.select(svgEl)
    svg.selectAll('*').remove()

    const gRoot = svg.append('g').attr('class', 'net-zoom')
    gRootRef.current = gRoot

    const gGroup = gRoot.append('g').attr('class', 'conspirator-group')
    const gLinks = gRoot.append('g').attr('class', 'links')
    const gNodes = gRoot.append('g').attr('class', 'nodes')
    const gLabels = gRoot.append('g').attr('class', 'labels')

    const zoom = d3
      .zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 4])
      .on('zoom', (event) => {
        gRoot.attr('transform', event.transform.toString())
      })
    zoomRef.current = zoom
    svg.call(zoom)

    const showMm = judgeMode || revealed

    const linkSel = gLinks
      .selectAll<SVGLineElement, GraphLink>('line')
      .data(links, (d) => d.id)
      .join('line')
      .attr('stroke', NETWORK.edge)
      .attr('stroke-width', (d) => Math.max(1, Math.min(6, d.meeting.minutes / 12)))
      .attr('stroke-opacity', 0.7)
      .style('cursor', 'pointer')
      .on('mouseenter', (_event, d) => {
        setEdgeTip(`met at ${d.buildingName} ${hhmm(d.meeting.start)}`)
      })
      .on('mouseleave', () => setEdgeTip(null))

    const nodeSel = gNodes
      .selectAll<SVGGElement, GraphNode>('g.node')
      .data(nodes, (d) => d.id)
      .join((enter) => {
        const g = enter.append('g').attr('class', 'node').style('cursor', 'pointer')
        g.append('circle').attr('class', 'ring').attr('r', 14).attr('fill', 'none').attr('stroke-width', 2.5)
        g.append('circle').attr('class', 'core').attr('r', 9).attr('fill', '#12182a')
        return g
      })
      .on('click', (_event, d) => {
        if (d.kind === 'student') {
          selectStudent(d.id)
          setHint(d.label)
        }
      })

    nodeSel.each(function (d) {
      const g = d3.select(this)
      if (d.kind === 'building') {
        g.select('.ring').attr('stroke', NETWORK.violet).attr('r', 16)
        g.select('.core').attr('fill', '#1a1030').attr('r', 10)
      } else {
        const v = d.verdict
        const isMm = v === 'mastermind'
        const ring =
          v === 'conspirator'
            ? NETWORK.conspirator
            : isMm && showMm
              ? NETWORK.mastermind
              : NETWORK.teal
        g.select('.ring').attr('stroke', ring).attr('r', isMm && showMm ? 16 : 14)
        g.select('.core')
          .attr('fill', v === 'conspirator' ? '#2a1218' : isMm && showMm ? '#2a2410' : '#12182a')
          .attr('r', 9)
      }
    })

    const labelSel = gLabels
      .selectAll<SVGTextElement, GraphNode>('text')
      .data(nodes, (d) => d.id)
      .join('text')
      .attr('text-anchor', 'middle')
      .attr('dy', 26)
      .attr('fill', '#c8d0e0')
      .attr('font-size', 10)
      .attr('font-family', 'var(--font-body)')
      .text((d) => (d.kind === 'building' ? d.label : d.label.split(' ')[0] ?? d.label))

    const groupRect = gGroup
      .append('rect')
      .attr('rx', 18)
      .attr('ry', 18)
      .attr('fill', 'rgba(255, 77, 94, 0.06)')
      .attr('stroke', 'rgba(255, 77, 94, 0.55)')
      .attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '6 4')
    const groupLabel = gGroup
      .append('text')
      .attr('fill', NETWORK.conspirator)
      .attr('font-size', 11)
      .attr('font-family', 'var(--font-display)')
      .text('Conspirators')

    const sim = d3
      .forceSimulation<GraphNode>(nodes)
      .force(
        'link',
        d3
          .forceLink<GraphNode, GraphLink>(links)
          .id((d) => d.id)
          .distance((d) => 40 + d.meeting.minutes * 0.4)
          .strength(0.4),
      )
      .force('charge', d3.forceManyBody().strength(-180))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide<GraphNode>().radius((d) => (d.kind === 'building' ? 28 : 22)))

    simRef.current = sim

    const drag = d3
      .drag<SVGGElement, GraphNode>()
      .on('start', (event, d) => {
        if (!event.active) sim.alphaTarget(0.25).restart()
        d.fx = d.x
        d.fy = d.y
      })
      .on('drag', (event, d) => {
        d.fx = event.x
        d.fy = event.y
      })
      .on('end', (event, d) => {
        if (!event.active) sim.alphaTarget(0)
        if (!(revealed && mastermind && d.id === mastermind.student_id)) {
          d.fx = null
          d.fy = null
        }
      })
    nodeSel.call(drag)

    function paintLinks() {
      linkSel
        .attr('x1', (d) => (d.source as GraphNode).x ?? 0)
        .attr('y1', (d) => (d.source as GraphNode).y ?? 0)
        .attr('x2', (d) => (d.target as GraphNode).x ?? 0)
        .attr('y2', (d) => (d.target as GraphNode).y ?? 0)
    }

    function paintGroup() {
      const cons = nodes.filter((n) => n.kind === 'student' && n.verdict === 'conspirator')
      if (cons.length < 2) {
        groupRect.attr('opacity', 0)
        groupLabel.attr('opacity', 0)
        return
      }
      const pad = 28
      const xs = cons.map((n) => n.x ?? 0)
      const ys = cons.map((n) => n.y ?? 0)
      const x0 = Math.min(...xs) - pad
      const y0 = Math.min(...ys) - pad
      const x1 = Math.max(...xs) + pad
      const y1 = Math.max(...ys) + pad
      groupRect.attr('opacity', 1).attr('x', x0).attr('y', y0).attr('width', x1 - x0).attr('height', y1 - y0)
      groupLabel.attr('opacity', 1).attr('x', x0 + 8).attr('y', y0 + 14)
    }

    sim.on('tick', () => {
      paintLinks()
      nodeSel.attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)
      labelSel.attr('x', (d) => d.x ?? 0).attr('y', (d) => d.y ?? 0)
      for (const n of nodes) {
        if (n.x != null && n.y != null) nodePosRef.current.set(n.id, { x: n.x, y: n.y })
      }
      paintGroup()
    })

    // Initial visibility from current replayTime (without depending effect on it for reheat)
    const applyVisibility = () => {
      const visible = new Set(meetingsUntil(c, useCaseStore.getState().replayTime).map((m) => m.id))
      const mm = useCaseStore.getState().case?.suspects.find((s) => s.verdict === 'mastermind')
      const goldSet = new Set<string>()
      if (revealed && mm) {
        for (const mid of mm.meeting_ids_with_conspirators) goldSet.add(mid)
        // Also mark any meeting between mm and a conspirator
        for (const m of c.meetings) {
          const other = m.a === mm.student_id ? m.b : m.b === mm.student_id ? m.a : null
          if (other && conspirators.includes(other)) goldSet.add(m.id)
        }
      }
      linkSel
        .attr('display', (d) => (visible.has(d.meeting.id) ? null : 'none'))
        .attr('stroke', (d) => (goldSet.has(d.meeting.id) ? NETWORK.edgeGold : NETWORK.edge))
        .attr('stroke-width', (d) =>
          goldSet.has(d.meeting.id)
            ? Math.max(2.5, Math.min(7, d.meeting.minutes / 10))
            : Math.max(1, Math.min(6, d.meeting.minutes / 12)),
        )
        .attr('stroke-opacity', (d) => (goldSet.has(d.meeting.id) ? 0.95 : 0.65))
    }
    applyVisibility()

    // Store applicator for replayTime effect
    ;(svgEl as SVGSVGElement & { __applyVis?: () => void }).__applyVis = applyVisibility

    const stopRo = observeResize(wrap, () => {
      const rect = wrap.getBoundingClientRect()
      sim.force('center', d3.forceCenter(rect.width / 2, rect.height / 2))
      sim.alpha(0.15).restart()
    })

    return () => {
      stopRo()
      sim.stop()
      simRef.current = null
      delete (svgEl as SVGSVGElement & { __applyVis?: () => void }).__applyVis
    }
    // topologyKey drives reheat; judgeMode/revealed refresh styling via included deps
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c, topologyKey, judgeMode, revealed, selectStudent, setHint, conspirators, mastermind])

  // Filter edges on replayTime without restarting the force simulation.
  useEffect(() => {
    const svgEl = svgRef.current as (SVGSVGElement & { __applyVis?: () => void }) | null
    svgEl?.__applyVis?.()
  }, [replayTime, revealed, visibleMeetingIds])

  if (!c) {
    return (
      <div className="page network-page">
        <h2 className="page-title">Network</h2>
        <p className="caption">Loading case…</p>
      </div>
    )
  }

  const mmMet = mastermind?.conspirators_met.length ?? 0
  const mmTotal = conspirators.length || 6

  return (
    <VizPageShell
      className="network-page"
      style={{ background: NETWORK.bg, margin: 0, borderRadius: 0 }}
    >
      <style>{`
        .network-page { color: #e4e4e7; gap: 8px; }
        .network-page .page-title { color: #e3af35; }
        .network-page .caption { color: #a1a1aa; }
        .network-stage {
          flex: 1; min-height: 320px; position: relative;
          background: ${NETWORK.bg};
          border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; overflow: hidden;
        }
        .network-stage svg { width: 100%; height: 100%; display: block; }
        .net-controls-tl {
          position: absolute; top: 10px; left: 10px; z-index: 2;
          display: flex; gap: 6px;
        }
        .net-controls-tr {
          position: absolute; top: 10px; right: 10px; z-index: 2;
          display: flex; gap: 6px; align-items: center;
        }
        .net-controls-tr input {
          background: #17171b; border: 1px solid rgba(255,255,255,0.08); color: #e4e4e7;
          border-radius: 10px; padding: 6px 10px; min-width: 160px; font-size: 13px;
        }
        .net-toolbar {
          display: flex; flex-wrap: wrap; gap: 12px; align-items: center;
          padding: 4px 0;
        }
        .net-toolbar label {
          display: inline-flex; align-items: center; gap: 6px; font-size: 12px; color: #a1a1aa;
        }
        .net-toolbar input[type="range"] { accent-color: ${NETWORK.teal}; width: 120px; }
        .network-layout { display: flex; gap: 14px; flex: 1; min-height: 0; }
        .network-details {
          width: 280px; flex-shrink: 0; background: #101013;
          border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 12px; overflow: auto;
        }
        .net-section { border-top: 1px solid rgba(255,255,255,0.08); }
        .net-section-head {
          width: 100%; display: flex; justify-content: space-between;
          background: transparent; border: none; color: #e4e4e7;
          padding: 8px 0; cursor: pointer; font-family: var(--font-display); font-size: 14px;
        }
        .net-section-body { padding-bottom: 8px; font-size: 12px; }
        .net-dl { display: grid; grid-template-columns: auto 1fr; gap: 4px 10px; margin: 0; }
        .net-dl dt { color: #a1a1aa; }
        .net-dl dd { margin: 0; }
        .net-list { margin: 0; padding-left: 16px; }
        .net-list li { margin-bottom: 6px; }
        .net-edge-tip {
          position: absolute; bottom: 12px; left: 50%; transform: translateX(-50%);
          background: #17171b; border: 1px solid ${NETWORK.teal}; color: #e4e4e7;
          padding: 4px 10px; border-radius: 8px; font-size: 12px; pointer-events: none; z-index: 3;
        }
        .net-reveal-caption {
          position: absolute; bottom: 12px; left: 12px; z-index: 2;
          color: ${NETWORK.mastermind}; font-family: var(--font-display); font-size: 13px;
        }
        .btn.net { background: #17171b; border-color: rgba(255,255,255,0.08); color: #e4e4e7; }
        .btn.net.gold { border-color: ${NETWORK.mastermind}; color: ${NETWORK.mastermind}; }
      `}</style>

      <StoryChapter
        chapter="network"
        variant="night"
        subtitle="Link analysis · the invisible web"
        toolbar={
          <div className="net-toolbar" style={{ margin: 0 }}>
            <label>
              Min minutes
              <input
                type="range"
                min={1}
                max={60}
                value={minMinutes}
                onChange={(e) => setMinMinutes(Number(e.target.value))}
              />
              <span style={{ fontFamily: 'var(--font-mono)', color: NETWORK.teal }}>{minMinutes}</span>
            </label>
            <label>
              <input type="checkbox" checked={showPlaces} onChange={(e) => setShowPlaces(e.target.checked)} />
              Show places
            </label>
            <label>
              <input type="checkbox" checked={flaggedOnly} onChange={(e) => setFlaggedOnly(e.target.checked)} />
              Flagged + contacts only
            </label>
            <button type="button" className="btn net gold" onClick={revealMastermind}>
              Reveal mastermind
            </button>
            {revealed && mastermind && (
              <span style={{ color: NETWORK.mastermind, fontSize: 13 }}>
                Clean record · met {mmMet}/{mmTotal}
              </span>
            )}
          </div>
        }
      />

      <div className="network-layout">
        <div className="network-stage story-stage" ref={wrapRef}>
          <div className="net-controls-tl">
            <button
              type="button"
              className="btn net"
              onClick={() => {
                const svg = svgRef.current
                const z = zoomRef.current
                if (!svg || !z) return
                d3.select(svg).transition().duration(200).call(z.scaleBy, 1.25)
              }}
            >
              +
            </button>
            <button
              type="button"
              className="btn net"
              onClick={() => {
                const svg = svgRef.current
                const z = zoomRef.current
                if (!svg || !z) return
                d3.select(svg).transition().duration(200).call(z.scaleBy, 0.8)
              }}
            >
              −
            </button>
            <button type="button" className="btn net" onClick={fitView}>
              Fit
            </button>
          </div>
          <div className="net-controls-tr">
            <input
              type="search"
              placeholder="Search student…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') onSearch()
              }}
              aria-label="Search student"
            />
            <button type="button" className="btn net" onClick={onSearch}>
              Go
            </button>
          </div>
          <svg ref={svgRef} role="img" aria-label="Meeting network graph" />
          {edgeTip && <div className="net-edge-tip">{edgeTip}</div>}
          {revealed && mastermind && (
            <div className="net-reveal-caption">
              The clean record · met every conspirator · {mmMet}/{mmTotal}
            </div>
          )}
        </div>
        <DetailsPanel student={selectedStudent} c={c} open={openSections} setOpen={setSection} />
      </div>

      <TimeSlider />
    </VizPageShell>
  )
}
