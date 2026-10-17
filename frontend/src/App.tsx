import { useEffect } from 'react'
import { NavLink, Route, Routes } from 'react-router-dom'
import { useCaseStore } from './store/useCaseStore'
import MapPage from './pages/MapPage'
import TimelinePage from './pages/TimelinePage'
import NetworkPage from './pages/NetworkPage'
import HomePage from './pages/HomePage'

export default function App() {
  const loadCase = useCaseStore((s) => s.loadCase)
  const c = useCaseStore((s) => s.case)
  const isPlaying = useCaseStore((s) => s.isPlaying)
  const setReplayTime = useCaseStore((s) => s.setReplayTime)
  const replayTime = useCaseStore((s) => s.replayTime)

  useEffect(() => {
    void loadCase()
  }, [loadCase])

  useEffect(() => {
    if (!isPlaying || !c) return
    const id = window.setInterval(() => {
      const next = replayTime + 5
      const max = c.meta.time_max
      setReplayTime(next > max ? c.meta.time_min : next)
    }, 100)
    return () => clearInterval(id)
  }, [isPlaying, c, replayTime, setReplayTime])

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
        </nav>
        <span style={{ fontSize: 12, color: 'var(--muted-dark)' }}>
          {c ? `${c.meta.counts.students} students · judge mode` : 'Loading…'}
        </span>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/timeline" element={<TimelinePage />} />
          <Route path="/network" element={<NetworkPage />} />
        </Routes>
      </main>
    </div>
  )
}
