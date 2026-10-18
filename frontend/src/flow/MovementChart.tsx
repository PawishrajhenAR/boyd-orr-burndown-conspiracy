import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import * as d3 from 'd3'
import type { Building, Meeting, Visit } from '../types/case'
import Conversation, { useDialogue } from './Conversation'
import type { Level3Stage, Line } from './dialogue'
import type { PageProps } from './Register'
import { clock, type Shortlist } from './shortlist'
import { play } from './sound'
import { Caption } from './TitleCard'

const MARGIN = { top: 16, right: 24, bottom: 36, left: 190 }
const MINUTES_PER_SECOND = 60 // playback speed: 1 second = 1 hour

const COLOUR = {
  neutral: '#9a948a',
  flagged: '#e05252',
  six: '#b3121b',
  mastermind: '#5c0000',
  gold: '#f4b942',
}
const NODE_STEP_MS = 60
const MEETING_STEP_MS = 550

/** True if the building is open at minute t (handles hours past midnight and the previous night). */
function isOpen(b: Building, t: number): boolean {
  if (b.always_open) return true
  const start = b.open_start
  const end = b.open_end <= start ? b.open_end + 1440 : b.open_end
  return [-1, 0, 1].some((k) => t >= start + 1440 * k && t < end + 1440 * k)
}

/** Closed intervals of a building inside [tMin, tMax], minute by minute. */
function closedIntervals(b: Building, tMin: number, tMax: number): [number, number][] {
  const out: [number, number][] = []
  let from: number | null = null
  for (let t = tMin; t <= tMax; t++) {
    const closed = !isOpen(b, t)
    if (closed && from === null) from = t
    if (!closed && from !== null) {
      out.push([from, t])
      from = null
    }
  }
  if (from !== null) out.push([from, tMax])
  return out
}

/** What the analysis has revealed so far. Re-applied after every redraw, so resizing never loses progress. */
interface Reveal {
  redVisits: Set<string>
  sixRed: boolean
  /** 0 = neutral … 1 = darkest red, one step per conspirator met. */
  bossLevel: number
  found: number
  done: boolean
}
const neutralReveal = (): Reveal => ({ redVisits: new Set(), sixRed: false, bossLevel: 0, found: 0, done: false })

interface Props extends PageProps {
  shortlist: Shortlist
  script: Line<Level3Stage>[]
}

export default function MovementChart({ c, active, reducedMotion, onNext, shortlist, script }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const tMin = c.meta.time_min
  const tMax = c.meta.time_max
  const [now, setNow] = useState(tMin)
  const [playing, setPlaying] = useState(false)
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null)
  const [analysis, setAnalysis] = useState<{ step: 0 | 1 | 2 | 3 | 4; found: number }>({ step: 0, found: 0 })
  const reveal = useRef<Reveal>(neutralReveal())
  const timers = useRef<number[]>([])

  const dialogue = useDialogue(script.length, active)
  const stage = script[dialogue.index]?.stage

  // Responsive size
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      setSize({ width: Math.floor(entry.contentRect.width), height: Math.floor(entry.contentRect.height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Playback loop: requestAnimationFrame moves `now` forward 60 minutes per second.
  useEffect(() => {
    if (!playing) return
    let raf = 0
    let last = performance.now()
    const tick = (ts: number) => {
      const dt = (ts - last) / 1000
      last = ts
      setNow((t) => {
        const next = Math.min(tMax, t + dt * MINUTES_PER_SECOND)
        if (next >= tMax) setPlaying(false)
        return next
      })
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [playing, tMax])

  const boss = useMemo(() => c.suspects.find((s) => s.verdict === 'mastermind')?.student_id ?? null, [c])
  const sixIds = useMemo(() => new Set(c.suspects.filter((s) => s.verdict === 'conspirator').map((s) => s.student_id)), [c])
  const nameOf = useMemo(() => new Map(c.students.map((s) => [s.id, s.name])), [c.students])
  const placeName = useMemo(() => new Map(c.buildings.map((b) => [b.id, b.name])), [c.buildings])
  const shortIds = useMemo(() => new Set(shortlist.all.map((s) => s.id)), [shortlist])

  // Rows: buildings any shortlisted student visited, in the case's building order.
  const rows = useMemo(() => {
    const used = new Set(c.visits.filter((v) => shortIds.has(v.student_id)).map((v) => v.building_id))
    return c.buildings.filter((b) => used.has(b.id))
  }, [c, shortIds])

  // Visits per shortlisted student (time order) and a small per-student offset inside a row.
  const series = useMemo(() => {
    const n = shortlist.all.length
    return shortlist.all.map((student, i) => ({
      student,
      visits: c.visits.filter((v) => v.student_id === student.id).sort((a, b) => a.start - b.start),
      offset: n > 1 ? i / (n - 1) - 0.5 : 0,
    }))
  }, [c.visits, shortlist])

  // Rule-breaking visits (referenced by flags), in time order.
  const flaggedVisits = useMemo(() => {
    const ids = new Set(c.flags.filter((f) => shortIds.has(f.student_id)).flatMap((f) => f.visit_ids))
    return c.visits.filter((v) => ids.has(v.id)).sort((a, b) => a.start - b.start)
  }, [c.flags, c.visits, shortIds])

  // The first meeting between the mastermind and each conspirator, in time order.
  const bossMeetings = useMemo<Meeting[]>(() => {
    if (!boss) return []
    const seen = new Set<string>()
    return c.meetings
      .filter((m) => (m.a === boss && sixIds.has(m.b)) || (m.b === boss && sixIds.has(m.a)))
      .sort((a, b) => a.start - b.start)
      .filter((m) => {
        const other = m.a === boss ? m.b : m.a
        if (seen.has(other)) return false
        seen.add(other)
        return true
      })
  }, [c.meetings, boss, sixIds])

  const scalesRef = useRef<{ x: d3.ScaleLinear<number, number> } | null>(null)

  /** Paint lines, nodes and rings from the current `reveal` state. */
  const applyReveal = useCallback(
    (ms = 0) => {
      const r = reveal.current
      const svg = d3.select(svgRef.current)
      const colourOf = (id: string) =>
        id === boss
          ? r.bossLevel >= 1
            ? COLOUR.mastermind
            : d3.interpolateRgb(COLOUR.neutral, COLOUR.mastermind)(r.bossLevel) // blend neutral → darkest red
          : r.sixRed && sixIds.has(id)
            ? COLOUR.six
            : COLOUR.neutral
      const opacityOf = (id: string) => (r.done ? (id === boss ? 1 : 0.25) : 0.9)
      const duration = reducedMotion ? 0 : ms

      svg
        .selectAll<SVGPathElement, unknown>('path.student-line')
        .transition()
        .duration(duration)
        .attr('stroke', function () {
          return colourOf(this.dataset.id!)
        })
        .attr('stroke-width', function () {
          return r.done && this.dataset.id === boss ? 3 : 1.5
        })
        .attr('stroke-opacity', function () {
          return opacityOf(this.dataset.id!)
        })
      svg
        .selectAll<SVGCircleElement, unknown>('circle.node')
        .transition()
        .duration(duration)
        .attr('fill', function () {
          return r.redVisits.has(this.dataset.visit!) ? COLOUR.flagged : colourOf(this.dataset.id!)
        })
        .attr('fill-opacity', function () {
          return opacityOf(this.dataset.id!)
        })
      svg.selectAll<SVGGElement, unknown>('g.meeting-ring').attr('opacity', function () {
        return Number(this.dataset.i) < r.found ? 1 : 0
      })
      if (r.done && boss) {
        svg.selectAll<SVGPathElement, unknown>(`path.student-line[data-id='${boss}']`).raise()
        svg.selectAll<SVGCircleElement, unknown>(`circle.node[data-id='${boss}']`).raise()
      }
    },
    [boss, sixIds, reducedMotion],
  )

  const cancelAnalysis = () => {
    timers.current.forEach(clearTimeout)
    timers.current = []
  }

  /** "Analysing pattern…": red flags → the six → meetings that darken the mastermind → fade everyone else. */
  const runAnalysis = useCallback(() => {
    cancelAnalysis()
    reveal.current = neutralReveal()
    applyReveal(0)
    setPlaying(false)
    setNow(tMax)
    setAnalysis({ step: 1, found: 0 })
    const at = (ms: number, fn: () => void) => timers.current.push(window.setTimeout(fn, reducedMotion ? 0 : ms))

    // 1. rule-breaking visits tint light red, one by one
    flaggedVisits.forEach((v, i) =>
      at(i * NODE_STEP_MS, () => {
        reveal.current.redVisits.add(v.id)
        applyReveal(200)
        play('nodetick')
      }),
    )
    const t1 = flaggedVisits.length * NODE_STEP_MS + 300
    // 2. the six settle to mid red
    at(t1, () => {
      reveal.current.sixRed = true
      setAnalysis({ step: 2, found: 0 })
      applyReveal(600)
    })
    const t2 = t1 + 800
    // 3. every meeting with a new conspirator darkens the mastermind one step
    const total = Math.max(1, sixIds.size)
    bossMeetings.forEach((_, i) =>
      at(t2 + i * MEETING_STEP_MS, () => {
        const found = i + 1
        reveal.current.found = found
        reveal.current.bossLevel = found / total
        setAnalysis({ step: 3, found })
        applyReveal(300)
        play('heartbeat', { volume: 0.45 + 0.55 * (found / total) })
      }),
    )
    // 4. everyone else fades; the mastermind is drawn on top
    at(t2 + bossMeetings.length * MEETING_STEP_MS + 300, () => {
      reveal.current.done = true
      setAnalysis({ step: 4, found: bossMeetings.length })
      applyReveal(600)
    })
  }, [applyReveal, bossMeetings, flaggedVisits, reducedMotion, sixIds.size, tMax])

  /** Jump straight to the end state (used if "reveal" arrives before the analysis has run). */
  const finishAnalysis = useCallback(() => {
    cancelAnalysis()
    reveal.current = {
      redVisits: new Set(flaggedVisits.map((v) => v.id)),
      sixRed: true,
      bossLevel: 1,
      found: bossMeetings.length,
      done: true,
    }
    setPlaying(false)
    setNow(tMax)
    setAnalysis({ step: 4, found: bossMeetings.length })
    applyReveal(300)
  }, [applyReveal, bossMeetings.length, flaggedVisits, tMax])

  useEffect(() => () => cancelAnalysis(), [])

  // Dialogue stage → chart action.
  useEffect(() => {
    if (!active || !stage) return
    if (stage === 'play') {
      if (reducedMotion) setNow(tMax)
      else {
        setNow(tMin)
        setPlaying(true)
      }
    } else if (stage === 'analyse') runAnalysis()
    else if (stage === 'reveal' && !reveal.current.done && timers.current.length === 0) finishAnalysis()
  }, [stage, active])

  // ---- full redraw: only when size or data change (not on every playback frame) ----
  useEffect(() => {
    const svg = d3.select(svgRef.current)
    svg.selectAll('*').remove()
    const { width, height } = size
    if (!width || !height) return
    const innerW = width - MARGIN.left - MARGIN.right
    const innerH = height - MARGIN.top - MARGIN.bottom

    const x = d3.scaleLinear().domain([tMin, tMax]).range([0, innerW])
    const y = d3.scaleBand<string>().domain(rows.map((r) => r.id)).range([0, innerH]).paddingInner(0.12)
    scalesRef.current = { x }
    const spread = y.bandwidth() * 0.7
    const yOf = (bid: string, offset: number) => (y(bid) ?? 0) + y.bandwidth() / 2 + offset * spread

    const defs = svg.append('defs')
    const hatch = defs.append('pattern').attr('id', 'hatch').attr('width', 6).attr('height', 6).attr('patternUnits', 'userSpaceOnUse').attr('patternTransform', 'rotate(45)')
    hatch.append('rect').attr('width', 6).attr('height', 6).attr('fill', '#1d1a17').attr('fill-opacity', 0.12)
    hatch.append('line').attr('x1', 0).attr('y1', 0).attr('x2', 0).attr('y2', 6).attr('stroke', '#1d1a17').attr('stroke-opacity', 0.35).attr('stroke-width', 2)
    defs.append('clipPath').attr('id', 'reveal').append('rect').attr('class', 'reveal-rect').attr('x', -8).attr('y', -10).attr('height', innerH + 20).attr('width', 0)

    const g = svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`)

    // rows + closed hours
    const row = g.selectAll('g.row').data(rows).join('g').attr('class', 'row').attr('transform', (r) => `translate(0,${y(r.id)})`)
    row
      .append('rect')
      .attr('width', innerW)
      .attr('height', y.bandwidth())
      .attr('fill', (r) => (r.name.includes('Boyd Orr') ? '#f4b942' : '#1d1a17'))
      .attr('fill-opacity', (r) => (r.name.includes('Boyd Orr') ? 0.18 : 0.03))
    row
      .selectAll('rect.closed')
      .data((r) => closedIntervals(r, tMin, tMax))
      .join('rect')
      .attr('class', 'closed hatch-closed')
      .attr('x', ([a]) => x(a))
      .attr('width', ([a, b]) => Math.max(0, x(b) - x(a)))
      .attr('height', y.bandwidth())
    row
      .append('text')
      .attr('x', -10)
      .attr('y', y.bandwidth() / 2)
      .attr('dy', '0.35em')
      .attr('text-anchor', 'end')
      .attr('font-size', 12)
      .attr('font-weight', (r) => (r.name.includes('Boyd Orr') ? 700 : 400))
      .attr('fill', '#1d1a17')
      .text((r) => r.name)

    // hour axis (every 2nd label when space is tight)
    const hours = d3.range(Math.ceil(tMin / 60) * 60, tMax + 1, 60)
    const labelStep = Math.max(1, Math.ceil(hours.length / Math.max(1, Math.floor(innerW / 64))))
    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .tickValues(hours.filter((_, index) => index % labelStep === 0))
          .tickFormat((d) => clock(Number(d)).replace(' (+1)', ' ⁺¹')),
      )
      .call((a) => a.selectAll('text').attr('fill', '#1d1a17').attr('font-family', 'JetBrains Mono').attr('font-size', 10))
      .call((a) => a.selectAll('line,path').attr('stroke', '#1d1a17').attr('stroke-opacity', 0.4))

    // student step-lines + visit nodes, clipped to "now"
    const line = d3
      .line<[number, string]>()
      .x(([t]) => x(t))
      .curve(d3.curveStepAfter)
    const clipped = g.append('g').attr('clip-path', 'url(#reveal)')
    const linesG = clipped.append('g')
    const hitsG = clipped.append('g')
    const nodesG = clipped.append('g')

    const showTip = (event: MouseEvent, text: string) => {
      const [px, py] = d3.pointer(event, wrapRef.current)
      setHover({ x: px, y: py, text })
    }
    const highlight = (id: string) =>
      linesG.selectAll<SVGPathElement, unknown>('path.student-line').attr('stroke-opacity', function () {
        return this.dataset.id === id ? 1 : 0.12
      })
    const unhover = () => {
      setHover(null)
      applyReveal(0)
    }

    for (const s of series) {
      const points = s.visits.flatMap((v): [number, string][] => [
        [v.start, v.building_id],
        [v.end, v.building_id],
      ])
      const d = line.y(([, bid]) => yOf(bid, s.offset))(points)
      if (!d) continue
      linesG.append('path').attr('class', 'student-line').attr('data-id', s.student.id).attr('d', d).attr('fill', 'none').attr('stroke-linejoin', 'round')
      // wide invisible twin for easy hovering
      hitsG
        .append('path')
        .attr('d', d)
        .attr('fill', 'none')
        .attr('stroke', 'transparent')
        .attr('stroke-width', 10)
        .style('cursor', 'pointer')
        .on('mousemove', (event: MouseEvent) => {
          const t = x.invert(d3.pointer(event, g.node())[0])
          const visit = s.visits.find((v) => v.start <= t && t <= v.end)
          showTip(event, `${s.student.name} · ${visit ? placeName.get(visit.building_id) : 'between buildings'} · ${clock(Math.round(t))}`)
          highlight(s.student.id)
        })
        .on('mouseleave', unhover)
      // one node at the start of every visit
      nodesG
        .selectAll(null)
        .data(s.visits)
        .join('circle')
        .attr('class', 'node')
        .attr('data-id', s.student.id)
        .attr('data-visit', (v: Visit) => v.id)
        .attr('cx', (v: Visit) => x(v.start))
        .attr('cy', (v: Visit) => yOf(v.building_id, s.offset))
        .attr('r', 4)
        .attr('stroke', 'transparent')
        .attr('stroke-width', 6)
        .style('cursor', 'pointer')
        .on('mouseenter', (event: MouseEvent, v: Visit) => {
          showTip(event, `${s.student.name} · ${placeName.get(v.building_id) ?? v.building_id} · ${clock(v.start)}`)
          highlight(s.student.id)
        })
        .on('mouseleave', unhover)
    }

    // "now" line
    g.append('line').attr('class', 'now-line').attr('y1', -6).attr('y2', innerH).attr('stroke', COLOUR.gold).attr('stroke-width', 2)

    // gold rings at the mastermind's first meeting with each conspirator (shown during the analysis)
    const bossOffset = series.find((s) => s.student.id === boss)?.offset ?? 0
    bossMeetings.forEach((m, i) => {
      const ring = g.append('g').attr('class', 'meeting-ring').attr('data-i', i).attr('opacity', 0)
      const cx = x(m.start)
      const cy = yOf(m.building_id, bossOffset)
      ring.append('circle').attr('cx', cx).attr('cy', cy).attr('r', 8).attr('fill', 'none').attr('stroke', COLOUR.gold).attr('stroke-width', 3)
      ring.append('circle').attr('class', 'gold-ring').attr('cx', cx).attr('cy', cy).attr('r', 8).attr('fill', 'none').attr('stroke', COLOUR.gold).attr('stroke-width', 2)
      ring.append('title').text(`${nameOf.get(m.a === boss ? m.b : m.a)} · ${placeName.get(m.building_id)} · ${clock(m.start)}`)
    })

    applyReveal(0)
  }, [size, rows, series, bossMeetings, tMin, tMax, boss, placeName, nameOf, applyReveal])

  // ---- cheap per-frame update: clip width + now-line ----
  useEffect(() => {
    const s = scalesRef.current
    if (!s) return
    const svg = d3.select(svgRef.current)
    const px = s.x(now)
    svg.select('.reveal-rect').attr('width', Math.max(0, px + 8))
    svg.select('.now-line').attr('x1', px).attr('x2', px)
  }, [now, size, series])

  const total = sixIds.size
  const progress =
    analysis.step === 0
      ? null
      : analysis.step === 4
        ? 'Pattern found'
        : `Analysing pattern… ${analysis.step}/3 · ${['', 'rule-break visits', 'the six', 'meetings with the six'][analysis.step]}`

  return (
    <div className="flex h-full flex-col px-6 pt-14 pb-10 md:px-12">
      <header className="mb-2 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-mono text-xs tracking-[0.3em] text-paper/70">LEVEL 3 · FOLLOW THE MOVEMENT</p>
          <h2 className="font-type text-2xl tracking-widest">The day, hour by hour</h2>
          <p className="text-sm text-paper/70">
            {shortlist.all.length} shortlisted students · a dot = arrival at a building · hatched = building closed
          </p>
        </div>
        <div className="flex items-center gap-3 text-xs text-paper/80">
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOUR.neutral }} /> not analysed</span>
          <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: COLOUR.flagged }} /> rule-break visit</span>
          <span className="flex items-center gap-1"><i className="inline-block h-1 w-5" style={{ background: COLOUR.six }} /> conspirator</span>
          <span className="flex items-center gap-1"><i className="inline-block h-1.5 w-5" style={{ background: COLOUR.mastermind }} /> darkest line</span>
          <button type="button" onClick={runAnalysis} className="ml-2 rounded border border-paper/30 px-3 py-1.5 text-sm hover:border-amber">
            ↺ Replay analysis
          </button>
          <button
            type="button"
            onClick={onNext}
            className="rounded bg-amber px-4 py-1.5 font-type text-sm tracking-widest text-ink hover:brightness-110"
          >
            Next →
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1 flex-col rounded-md bg-paper p-3 text-ink">
        <div ref={wrapRef} className="relative min-h-0 flex-1">
          <svg ref={svgRef} width={size.width} height={size.height} role="img" aria-label="Movement of shortlisted students between buildings over the day" />
          {hover && (
            <div
              className="pointer-events-none absolute z-10 rounded bg-ink px-2 py-1 font-mono text-xs whitespace-nowrap text-paper"
              style={{ left: hover.x + 12, top: hover.y - 28 }}
            >
              {hover.text}
            </div>
          )}
          {progress && (
            <div className="pointer-events-none absolute top-1 right-3 flex flex-col items-end gap-1">
              <p className="rounded bg-ink/90 px-3 py-1 font-mono text-xs text-paper" data-testid="analysis-progress">
                {progress}
              </p>
              <p className="rounded bg-ink/90 px-3 py-1 font-mono text-xs text-amber" data-testid="meeting-counter">
                Meetings with the six: {analysis.found} / {total}
              </p>
              {analysis.step === 4 && (
                <p className="rounded bg-ink/90 px-3 py-1 font-type text-sm tracking-wider text-amber">One clean student was with all six.</p>
              )}
            </div>
          )}
        </div>

        {/* playback controls */}
        <div className="mt-2 flex items-center gap-3 border-t border-ink/10 pt-2">
          <button
            type="button"
            onClick={() => {
              if (now >= tMax) setNow(tMin)
              setPlaying((p) => !p)
            }}
            className="h-9 w-9 rounded-full bg-ink text-paper hover:bg-oxblood"
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? '❚❚' : '▶'}
          </button>
          <input
            type="range"
            min={tMin}
            max={tMax}
            step={1}
            value={Math.round(now)}
            onChange={(e) => {
              setPlaying(false)
              setNow(Number(e.target.value))
            }}
            className="flex-1 accent-[#5c0000]"
            aria-label="Scrub time"
          />
          <span className="w-24 text-right font-mono text-sm tabular-nums">{clock(Math.round(now))}</span>
        </div>
      </div>

      <div className="mt-2">
        <Conversation
          lines={script}
          index={dialogue.index}
          onAdvance={dialogue.advance}
          onSkip={dialogue.skip}
          auto={dialogue.auto}
          onToggleAuto={dialogue.toggleAuto}
          active={active}
          blocked={playing || (analysis.step > 0 && analysis.step < 4)}
          reducedMotion={reducedMotion}
        />
      </div>

      <Caption>Time across, place down. Follow the darkest line.</Caption>
    </div>
  )
}
