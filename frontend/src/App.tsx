import { Suspense, lazy, useEffect, type ReactNode } from 'react'
import { Route, Routes, useLocation } from 'react-router-dom'
import InvestigationFlow from './flow/InvestigationFlow'
import legacyStyles from './index.css?url'
import { useCaseStore } from './store/useCaseStore'
import { NavRail } from './components/game/GameKit'
import { playGameSound } from './components/game/audio'
// Legacy / classic pages are code-split: the main investigation at `/` never downloads them.
const TitlePage = lazy(() => import('./pages/TitlePage'))
const RegisterPage = lazy(() => import('./pages/RegisterPage'))
const FirstSweepPage = lazy(() => import('./pages/FirstSweepPage'))
const SuspectReviewPage = lazy(() => import('./pages/SuspectReviewPage'))
const MovementEvidencePage = lazy(() => import('./pages/MovementEvidencePage'))
const ResultsPage = lazy(() => import('./pages/ResultsPage'))
const BriefingPage = lazy(() => import('./pages/BriefingPage'))
const EvidencePage = lazy(() => import('./pages/EvidencePage'))
const BoardPage = lazy(() => import('./pages/BoardPage'))
const InterrogationPage = lazy(() => import('./pages/InterrogationPage'))
const HQPage = lazy(() => import('./pages/HQPage'))
const AccusePage = lazy(() => import('./pages/AccusePage'))
const CaseClosedPage = lazy(() => import('./pages/CaseClosedPage'))
const MapPage = lazy(() => import('./pages/MapPage'))
const TimelinePage = lazy(() => import('./pages/TimelinePage'))
const NetworkPage = lazy(() => import('./pages/NetworkPage'))
const VizLabPage = lazy(() => import('./pages/VizLabPage'))

function GameRoute({ children }: { children: ReactNode }) {
  return <><NavRail />{children}</>
}

export default function App() {
  const { pathname } = useLocation()
  const loadCase = useCaseStore((state) => state.loadCase)
  useEffect(() => {
    if (pathname === '/') return
    const style = document.createElement('link')
    style.rel = 'stylesheet'
    style.href = legacyStyles
    document.head.append(style)
    void loadCase().catch(() => {})
    return () => style.remove()
  }, [loadCase, pathname])
  useEffect(() => {
    if (pathname === '/') return
    const onPress = (event: PointerEvent) => {
      const target = (event.target as HTMLElement).closest('button, a')
      if (!target) return
      target.classList.add('game-press')
      window.setTimeout(() => target.classList.remove('game-press'), 150)
      const text = target.textContent?.toLowerCase() ?? ''
      playGameSound(target.classList.contains('polaroid') ? 'select' : text.includes('accuse') ? 'danger' : text.includes('clue') ? 'clue' : text.includes('submit') ? 'success' : 'tap')
    }
    document.addEventListener('pointerdown', onPress)
    return () => document.removeEventListener('pointerdown', onPress)
  }, [pathname])
  return <div className="app-shell"><Suspense fallback={<div className="page">Loading…</div>}><Routes>
    <Route path="/" element={<InvestigationFlow />} />
    <Route path="/classic" element={<TitlePage />} />
    <Route path="/register" element={<GameRoute><RegisterPage /></GameRoute>} />
    <Route path="/first-sweep" element={<GameRoute><FirstSweepPage /></GameRoute>} />
    <Route path="/suspect-review" element={<GameRoute><SuspectReviewPage /></GameRoute>} />
    <Route path="/movement-evidence" element={<GameRoute><MovementEvidencePage /></GameRoute>} />
    <Route path="/results" element={<GameRoute><ResultsPage /></GameRoute>} />
    <Route path="/briefing" element={<GameRoute><BriefingPage /></GameRoute>} />
    <Route path="/evidence" element={<GameRoute><EvidencePage /></GameRoute>} />
    <Route path="/board" element={<GameRoute><BoardPage /></GameRoute>} />
    <Route path="/student/:id" element={<GameRoute><InterrogationPage /></GameRoute>} />
    <Route path="/hq" element={<GameRoute><HQPage /></GameRoute>} />
    <Route path="/map" element={<GameRoute><MapPage /></GameRoute>} />
    <Route path="/timeline" element={<GameRoute><TimelinePage /></GameRoute>} />
    <Route path="/network" element={<GameRoute><NetworkPage /></GameRoute>} />
    <Route path="/lab" element={<GameRoute><VizLabPage /></GameRoute>} />
    <Route path="/accuse" element={<GameRoute><AccusePage /></GameRoute>} />
    <Route path="/closed" element={<GameRoute><CaseClosedPage /></GameRoute>} />
  </Routes></Suspense></div>
}
