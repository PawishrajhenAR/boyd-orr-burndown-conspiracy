import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useCaseStore } from './store/useCaseStore'
import MapPage from './pages/MapPage'
import TimelinePage from './pages/TimelinePage'
import NetworkPage from './pages/NetworkPage'
import VizLabPage from './pages/VizLabPage'
import HomePage from './pages/HomePage'
import { hhmm } from './components/viz/util'

export default function App() {
  const loadCase = useCaseStore((s) => s.loadCase)
  const c = useCaseStore((s) => s.case)
  const replayTime = useCaseStore((s) => s.replayTime)

  useEffect(() => {
    void loadCase()
  }, [loadCase])

  // Play/scrub is owned by <TimeSlider /> — do not duplicate the interval here.

  return (
    <div className="app-shell">
      <header className="topbar">
        <h1>CASE FILE #1105 — P5 Viz Lab</h1>
        <nav className="nav">
          <NavLink to="/" end>
            Home
          </NavLink>
          <NavLink to="/map">Map</NavLink>
          <NavLink to="/timeline">Timeline</NavLink>
          <NavLink to="/network">Network</NavLink>
          <NavLink to="/lab">Lab</NavLink>
        </nav>
        <span style={{ fontSize: 12, color: 'var(--muted-dark)', fontFamily: 'var(--font-mono)' }}>
          {c
            ? `${c.meta.counts.students} students · ${hhmm(replayTime)} · judge`
            : 'Loading…'}
        </span>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/network" element={<NetworkPage />} />
          <Route path="/lab" element={<VizLabPage />} />
        </Routes>
      </main>
    </div>
  )
}
