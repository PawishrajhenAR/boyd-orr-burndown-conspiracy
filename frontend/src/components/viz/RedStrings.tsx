import {
  useEffect,
  useRef,
  useState,
  type RefObject,
  type CSSProperties,
} from 'react'
import { select } from 'd3'
import {
  useCaseStore,
  boardStudents,
  buildingById,
  suspectFor,
} from '../../store/useCaseStore'
import type { Meeting } from '../../types/case'
import { hhmm, observeResize, TOKENS } from './util'

interface Props {
  containerRef: RefObject<HTMLElement | null>
}

interface Pin {
  id: string
  x: number
  y: number
}

function pinPositions(container: HTMLElement): Map<string, Pin> {
  const cRect = container.getBoundingClientRect()
  const map = new Map<string, Pin>()
  container.querySelectorAll<HTMLElement>('[data-card-id]').forEach((card) => {
    const id = card.getAttribute('data-card-id')
    if (!id) return
    const r = card.getBoundingClientRect()
    map.set(id, {
      id,
      x: r.left - cRect.left + r.width / 2,
      y: r.top - cRect.top + 8,
    })
  })
  return map
}

function curvePath(a: Pin, b: Pin): string {
  const mx = (a.x + b.x) / 2
  const my = Math.min(a.y, b.y) - 40 - Math.abs(a.x - b.x) * 0.12
  return `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`
}

export default function RedStrings({ containerRef }: Props) {
  const caseData = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const svgRef = useRef<SVGSVGElement>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    return observeResize(el, () => setTick((n) => n + 1))
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    const svg = svgRef.current
    if (!container || !svg || !caseData) return

    const root = select(svg)
    root.selectAll('*').remove()

    const rect = container.getBoundingClientRect()
    root.attr('width', rect.width).attr('height', rect.height)
    root.attr('viewBox', `0 0 ${rect.width} ${rect.height}`)

    const defs = root.append('defs')
    const glow = defs
      .append('filter')
      .attr('id', 'string-glow')
      .attr('x', '-40%')
      .attr('y', '-40%')
      .attr('width', '180%')
      .attr('height', '180%')
    glow.append('feGaussianBlur').attr('stdDeviation', 2.2).attr('result', 'b')
    glow
      .append('feMerge')
      .selectAll('feMergeNode')
      .data(['b', 'SourceGraphic'])
      .enter()
      .append('feMergeNode')
      .attr('in', (d) => d)

    const pins = pinPositions(container)
    const boardIds = new Set(boardStudents(caseData).map((s) => s.id))
    const meetings = caseData.meetings.filter(
      (m) =>
        boardIds.has(m.a) &&
        boardIds.has(m.b) &&
        m.start <= replayTime &&
        m.end >= replayTime,
    )

    const hotVerdict = (id: string) => {
      const v = suspectFor(caseData, id)?.verdict
      return v === 'conspirator' || v === 'mastermind'
    }

    const g = root.append('g')

    meetings.forEach((m: Meeting) => {
      const pa = pins.get(m.a)
      const pb = pins.get(m.b)
      if (!pa || !pb) return

      const hot = hotVerdict(m.a) && hotVerdict(m.b)
      const d = curvePath(pa, pb)
      const strokeW = Math.min(5, Math.max(1.5, m.minutes / 25))
      const building = buildingById(caseData, m.building_id)
      const label = `${building?.name ?? m.building_id} · ${hhmm(m.start)}–${hhmm(m.end)} (${m.minutes} min)`

      const path = g
        .append('path')
        .attr('d', d)
        .attr('fill', 'none')
        .attr('stroke', hot ? TOKENS.pin : '#8d5f33')
        .attr('stroke-width', strokeW)
        .attr('opacity', hot ? 0.95 : 0.5)
        .attr('stroke-linecap', 'round')
        // Never intercept board card clicks — strings sit under .cards
        .attr('pointer-events', 'none')

      if (hot) path.attr('filter', 'url(#string-glow)')

      path.append('title').text(label)

      const len = (path.node() as SVGPathElement).getTotalLength()
      if (hot) {
        path
          .attr('stroke-dasharray', `${len}`)
          .attr('stroke-dashoffset', len)
          .transition()
          .duration(450)
          .attr('stroke-dashoffset', 0)
          .on('end', () => {
            path.attr('stroke-dasharray', null)
          })
      } else {
        path.attr('stroke-dasharray', '6 4')
      }
    })
  }, [caseData, replayTime, containerRef, tick])

  const wrapStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 1, // below .cards (z-index: 2)
    overflow: 'visible',
  }

  return (
    <div style={wrapStyle} aria-hidden>
      <svg ref={svgRef} style={{ width: '100%', height: '100%', pointerEvents: 'none' }} />
    </div>
  )
}
