import { useEffect, useMemo, useRef } from 'react'
import { select } from 'd3'
import { useCaseStore } from '../../store/useCaseStore'
import { useVisibleFlags, hhmm, observeResize, TOKENS } from './util'

const PAD = { top: 36, right: 12, bottom: 28, left: 120 }
const CELL_MIN = 14

export default function FlagHeatmap() {
  const caseData = useCaseStore((s) => s.case)
  const setReplayTime = useCaseStore((s) => s.setReplayTime)
  const selectBuilding = useCaseStore((s) => s.selectBuilding)
  const flags = useVisibleFlags()
  const svgRef = useRef<SVGSVGElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  const { buildings, hours, counts, flagCells } = useMemo(() => {
    if (!caseData) {
      return {
        buildings: [] as string[],
        hours: [] as number[],
        counts: new Map<string, number>(),
        flagCells: new Map<string, number>(),
      }
    }
    const tMin = caseData.meta.time_min
    const tMax = caseData.meta.time_max
    const hourStart = Math.floor(tMin / 60)
    const hourEnd = Math.ceil(tMax / 60)
    const hoursList: number[] = []
    for (let h = hourStart; h < hourEnd; h++) hoursList.push(h)

    const bids = caseData.buildings.map((b) => b.id)
    const countMap = new Map<string, number>()
    const people = new Map<string, Set<string>>()

    for (const v of caseData.visits) {
      const startH = Math.floor(v.start / 60)
      const endH = Math.ceil(v.end / 60)
      for (let h = startH; h < endH; h++) {
        if (h < hourStart || h >= hourEnd) continue
        const key = `${v.building_id}|${h}`
        let set = people.get(key)
        if (!set) {
          set = new Set()
          people.set(key, set)
        }
        set.add(v.student_id)
      }
    }
    for (const [key, set] of people) countMap.set(key, set.size)

    const fCells = new Map<string, number>()
    for (const f of flags) {
      if (f.building_id == null || f.time == null) continue
      const h = Math.floor(f.time / 60)
      const key = `${f.building_id}|${h}`
      fCells.set(key, (fCells.get(key) ?? 0) + 1)
    }

    return {
      buildings: bids,
      hours: hoursList,
      counts: countMap,
      flagCells: fCells,
    }
  }, [caseData, flags])

  const maxCount = useMemo(() => {
    let m = 1
    for (const v of counts.values()) if (v > m) m = v
    return m
  }, [counts])

  useEffect(() => {
    const wrap = wrapRef.current
    const svg = svgRef.current
    if (!wrap || !svg || !caseData) return

    const draw = () => {
      const width = wrap.clientWidth || 560
      const cellW = Math.max(
        CELL_MIN,
        (width - PAD.left - PAD.right) / Math.max(1, hours.length),
      )
      const cellH = CELL_MIN + 4
      const height =
        PAD.top + PAD.bottom + buildings.length * cellH

      const root = select(svg)
      root.selectAll('*').remove()
      root.attr('width', width).attr('height', height)

      const g = root
        .append('g')
        .attr('transform', `translate(${PAD.left},${PAD.top})`)

      const nameOf = (id: string) =>
        caseData.buildings.find((b) => b.id === id)?.name ?? id

      buildings.forEach((bid, yi) => {
        g.append('text')
          .attr('x', -8)
          .attr('y', yi * cellH + cellH / 2)
          .attr('text-anchor', 'end')
          .attr('dominant-baseline', 'middle')
          .attr('fill', TOKENS.mutedSoft)
          .attr('font-size', 10)
          .text(() => {
            const n = nameOf(bid)
            return n.length > 18 ? `${n.slice(0, 16)}…` : n
          })

        hours.forEach((h, xi) => {
          const key = `${bid}|${h}`
          const c = counts.get(key) ?? 0
          const t = Math.min(1, c / maxCount)
          const fill =
            c === 0
              ? '#3b2c20'
              : `rgb(${Math.round(60 + t * 180)},${Math.round(40 + t * 40)},${Math.round(30)})`

          const cell = g
            .append('rect')
            .attr('x', xi * cellW)
            .attr('y', yi * cellH)
            .attr('width', cellW - 1)
            .attr('height', cellH - 1)
            .attr('rx', 2)
            .attr('fill', fill)
            .style('cursor', 'pointer')
            .on('click', () => {
              const minute = Math.min(
                caseData.meta.time_max,
                Math.max(caseData.meta.time_min, h * 60),
              )
              setReplayTime(minute)
              selectBuilding(bid)
            })

          cell
            .append('title')
            .text(`${nameOf(bid)} · ${hhmm(h * 60)} · ${c} people`)

          const fc = flagCells.get(key) ?? 0
          if (fc > 0) {
            g.append('circle')
              .attr('cx', xi * cellW + cellW / 2)
              .attr('cy', yi * cellH + cellH / 2)
              .attr('r', Math.min(5, 3 + fc))
              .attr('fill', TOKENS.pin)
              .attr('pointer-events', 'none')
          }
        })
      })

      hours.forEach((h, xi) => {
        if (h % 2 !== 0 && hours.length > 12) return
        g.append('text')
          .attr('x', xi * cellW + cellW / 2)
          .attr('y', -8)
          .attr('text-anchor', 'middle')
          .attr('fill', TOKENS.muted)
          .attr('font-size', 9)
          .attr('font-family', 'JetBrains Mono, monospace')
          .text(hhmm(h * 60))
      })
    }

    draw()
    return observeResize(wrap, draw)
  }, [
    caseData,
    buildings,
    hours,
    counts,
    flagCells,
    maxCount,
    setReplayTime,
    selectBuilding,
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
          letterSpacing: '0.04em',
        }}
      >
        Where the day burned hot
      </div>
      <svg ref={svgRef} style={{ display: 'block', width: '100%' }} />
      <p style={{ margin: '4px 0 0', fontSize: 11, color: TOKENS.muted }}>
        Buildings × hour. Cell colour = how many people were present. Red dots
        = flags. Click a cell to jump the replay and select that building.
      </p>
    </div>
  )
}
