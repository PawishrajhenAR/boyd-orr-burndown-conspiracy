import { Link } from 'react-router-dom'
import { useCaseStore } from '../store/useCaseStore'

export default function HomePage() {
  const c = useCaseStore((s) => s.case)
  return (
    <div className="page">
      <h2 className="page-title">
        Pawish · Visualisation Developer
        <small>Local P5 workspace — charts before team merge to main</small>
      </h2>
      <p className="caption">
        Built with Cursor multi-agent help against <code>case.sample.json</code>. Open a page below.
      </p>
      <div className="home-grid">
        <Link className="home-card" to="/map">
          <h2>Map</h2>
          <p>Where it happened — campus buildings, live occupants, student paths.</p>
        </Link>
        <Link className="home-card" to="/timeline">
          <h2>Timeline</h2>
          <p>The day — storyline chart across buildings with flags and meetings.</p>
        </Link>
        <Link className="home-card" to="/network">
          <h2>Network</h2>
          <p>Who met whom — link analysis + reveal mastermind (Scott → 6).</p>
        </Link>
      </div>
      {c && (
        <p className="caption" style={{ marginTop: 24 }}>
          Sample case: {c.meta.case_name} · time {c.meta.time_min}–{c.meta.time_max} ·{' '}
          {c.flags.length} flags · {c.meetings.length} meetings
        </p>
      )}
    </div>
  )
}
