import { useMemo, useState } from 'react'
import { useCaseStore } from '../store/useCaseStore'
import Clock24 from '../components/viz/Clock24'
import DayTimeline from '../components/viz/DayTimeline'
import FlagHeatmap from '../components/viz/FlagHeatmap'
import RuleBars from '../components/viz/RuleBars'
import TimeSlider from '../components/viz/TimeSlider'
import { hhmm } from '../components/viz/util'

/** Local P5 harness — mounts every chart that P4 will host on game pages. */
export default function VizLabPage() {
  const c = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)
  const flagged = useMemo(() => {
    if (!c) return []
    return c.suspects
      .filter((s) => s.verdict === 'conspirator' || s.verdict === 'suspicious')
      .map((s) => {
        const st = c.students.find((x) => x.id === s.student_id)
        return { id: s.student_id, name: st?.name ?? s.student_id, verdict: s.verdict }
      })
  }, [c])

  const [studentId, setStudentId] = useState<string>('2813225B')

  if (!c) {
    return (
      <div className="page">
        <h2 className="page-title">Viz lab</h2>
        <p className="caption">Loading case…</p>
      </div>
    )
  }

  const student = c.students.find((s) => s.id === studentId)

  return (
    <div className="page">
      <h2 className="page-title">
        Viz lab
        <small>Clock24 · DayTimeline · HQ charts — acceptance harness</small>
      </h2>
      <p className="caption">
        How to read: pick a flagged student. Clock24 must wrap midnight (Stuart @ Hive). DayTimeline must
        put Abdul’s Boyd Orr visit in the hatched closed zone after 21:00. Heatmap / rule bars feed HQ.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
        <label style={{ fontSize: 13, color: 'var(--muted-dark)' }}>
          Student{' '}
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            style={{
              background: 'var(--panel-inner)',
              color: 'var(--muted)',
              border: '1px solid var(--panel-border)',
              borderRadius: 8,
              padding: '6px 10px',
            }}
          >
            {flagged.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.verdict})
              </option>
            ))}
          </select>
        </label>
        {student && (
          <span className="caption">
            {student.name} · age {student.age} · {student.subject} · replay {hhmm(replayTime)}
          </span>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(280px, 340px) 1fr',
          gap: 12,
          flex: 1,
          minHeight: 0,
        }}
      >
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
            Clock24 — hours
          </strong>
          <p className="caption">Radial day; OOH arcs pulse red; 18+ badge on age-gated venues.</p>
          <Clock24 studentId={studentId} />
        </div>
        <div className="panel" style={{ display: 'flex', flexDirection: 'column', gap: 8, minHeight: 0 }}>
          <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
            DayTimeline — lecture / places
          </strong>
          <p className="caption">Mini Gantt: visits, ghost lecture, hatched closed hours, flagged outlines.</p>
          <div style={{ flex: 1, minHeight: 220 }}>
            <DayTimeline studentId={studentId} />
          </div>
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.2fr 0.8fr',
          gap: 12,
          minHeight: 240,
        }}
      >
        <div className="panel" style={{ minHeight: 220 }}>
          <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
            FlagHeatmap — HQ
          </strong>
          <FlagHeatmap />
        </div>
        <div className="panel" style={{ minHeight: 220 }}>
          <strong style={{ color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
            RuleBars — HQ
          </strong>
          <RuleBars />
        </div>
      </div>

      <TimeSlider />
    </div>
  )
}
