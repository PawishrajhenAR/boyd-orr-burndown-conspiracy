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
  const [tooltip, setTooltip] = useState<{
    x: number
    y: number
    text: string
  } | null>(null)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const bump = () => setTick((n) => n + 1)
    const stopRo = observeResize(container, bump)
    const mo = new MutationObserver(bump)
    mo.observe(container, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class', 'data-card-id'],
    })
    window.addEventListener('resize', bump)
    return () => {
      stopRo()
      mo.disconnect()
      window.removeEventListener('resize', bump)
    }
  }, [containerRef])

  useEffect(() => {
    const container = containerRef.current
    const svg = svgRef.current
    if (!container || !svg || !caseData) return

    const board = boardStudents(caseData)
    const boardIds = new Set(board.map((s) => s.id))
    const pins = pinPositions(container)
    const meetings = caseData.meetings.filter(
      (m) =>
        m.start <= replayTime && boardIds.has(m.a) && boardIds.has(m.b),
    )

    const w = container.clientWidth
    const h = container.clientHeight
    const root = select(svg)
    root.selectAll('*').remove()
    root.attr('width', w).attr('height', h)

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
        .attr('opacity', hot ? 0.9 : 0.55)
        .attr('pointer-events', 'stroke')
        .style('cursor', 'default')

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

      path
        .on('pointerenter', (event: PointerEvent) => {
          const cRect = container.getBoundingClientRect()
          setTooltip({
            x: event.clientX - cRect.left,
            y: event.clientY - cRect.top - 12,
            text: label,
          })
        })
        .on('pointermove', (event: PointerEvent) => {
          const cRect = container.getBoundingClientRect()
          setTooltip({
            x: event.clientX - cRect.left,
            y: event.clientY - cRect.top - 12,
            text: label,
          })
        })
        .on('pointerleave', () => setTooltip(null))
    })
  }, [caseData, replayTime, containerRef, tick])

  const wrapStyle: CSSProperties = {
    position: 'absolute',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 5,
    overflow: 'visible',
  }

  return (
    <div style={wrapStyle} aria-hidden>
      <svg ref={svgRef} style={{ width: '100%', height: '100%' }} />
      {tooltip && (
        <div
          style={{
            position: 'absolute',
            left: tooltip.x,
            top: tooltip.y,
            transform: 'translate(-50%, -100%)',
            background: TOKENS.panel,
            border: `1px solid ${TOKENS.panelBorder}`,
            color: TOKENS.mutedSoft,
            padding: '4px 8px',
            borderRadius: 6,
            fontSize: 11,
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
            fontFamily: 'Inter, sans-serif',
          }}
        >
          {tooltip.text}
        </div>
      )}
    </div>
  )
}
