import { useEffect, useMemo, useRef } from 'react'
import { select, forceSimulation, forceLink, forceManyBody, forceCenter } from 'd3'
import {
  useCaseStore,
  boardStudents,
  suspectFor,
} from '../../store/useCaseStore'
import { verdictColor, TOKENS } from './util'

interface NNode {
  id: string
  name: string
  verdict: string
  x?: number
  y?: number
  vx?: number
  vy?: number
}

interface NLink {
  source: string | NNode
  target: string | NNode
  minutes: number
}

/** Small static network preview for Case Closed / newspaper. */
export default function NetworkMini() {
  const caseData = useCaseStore((s) => s.case)
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const graph = useMemo(() => {
    if (!caseData) return { nodes: [] as NNode[], links: [] as NLink[] }
    const board = boardStudents(caseData)
    const ids = new Set(board.map((s) => s.id))
    const nodes: NNode[] = board.map((s) => ({
      id: s.id,
      name: s.name.split(' ')[0] ?? s.name,
      verdict: suspectFor(caseData, s.id)?.verdict ?? 'clear',
    }))
    const links: NLink[] = []
    const seen = new Set<string>()
    for (const m of caseData.meetings) {
      if (!ids.has(m.a) || !ids.has(m.b)) continue
      const key = [m.a, m.b].sort().join('|')
      if (seen.has(key)) {
        const existing = links.find(
          (l) =>
            (typeof l.source === 'string' ? l.source : l.source.id) ===
              key.split('|')[0] &&
            (typeof l.target === 'string' ? l.target : l.target.id) ===
              key.split('|')[1],
        )
        if (existing) existing.minutes += m.minutes
        continue
      }
      seen.add(key)
      const [a, b] = key.split('|') as [string, string]
      links.push({ source: a, target: b, minutes: m.minutes })
    }
    return { nodes, links }
  }, [caseData])

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg || !caseData) return

    const width = wrap.clientWidth || 280
    const height = 160

    const root = select(svg)
    root.selectAll('*').remove()
    root.attr('width', width).attr('height', height)

    root
      .append('rect')
      .attr('width', width)
      .attr('height', height)
      .attr('rx', 8)
      .attr('fill', TOKENS.networkDark)
      .attr('stroke', '#1a2744')

    if (graph.nodes.length === 0) return

    const nodes = graph.nodes.map((n) => ({ ...n }))
    const links = graph.links.map((l) => ({ ...l }))

    const sim = forceSimulation(nodes)
      .force(
        'link',
        forceLink<NNode, NLink>(links)
          .id((d) => d.id)
          .distance(42)
          .strength(0.4),
      )
      .force('charge', forceManyBody().strength(-80))
      .force('center', forceCenter(width / 2, height / 2))
      .stop()

    for (let i = 0; i < 80; i++) sim.tick()

    const g = root.append('g')

    g.selectAll('line')
      .data(links)
      .join('line')
      .attr('x1', (d) => (d.source as NNode).x ?? 0)
      .attr('y1', (d) => (d.source as NNode).y ?? 0)
      .attr('x2', (d) => (d.target as NNode).x ?? 0)
      .attr('y2', (d) => (d.target as NNode).y ?? 0)
      .attr('stroke', '#2ec4b6')
      .attr('stroke-opacity', 0.45)
      .attr('stroke-width', (d) => Math.min(3, 0.5 + d.minutes / 40))

    const node = g
      .selectAll('g.node')
      .data(nodes)
      .join('g')
      .attr('class', 'node')
      .attr('transform', (d) => `translate(${d.x ?? 0},${d.y ?? 0})`)

    node
      .append('circle')
      .attr('r', 8)
      .attr('fill', '#12182a')
      .attr('stroke', (d) => verdictColor(d.verdict))
      .attr('stroke-width', 2)

    node
      .append('text')
      .attr('y', 16)
      .attr('text-anchor', 'middle')
      .attr('fill', '#c5d0e6')
      .attr('font-size', 8)
      .text((d) => d.name)

    return () => {
      sim.stop()
    }
  }, [caseData, graph])

  return (
    <div ref={wrapRef} style={{ width: '100%' }}>
      <div
        style={{
          fontFamily: 'Outfit, sans-serif',
          fontWeight: 600,
          fontSize: 12,
          color: '#2ec4b6',
          marginBottom: 2,
        }}
      >
        Network
      </div>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
    </div>
  )
}
