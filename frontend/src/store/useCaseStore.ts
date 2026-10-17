import { create } from 'zustand'
import type { Case, Flag, Meeting, Student, Building, Suspect, Visit } from '../types/case'
import { loadCase as fetchCase } from '../api/client'

type ExamCheck = 'lecture' | 'hours' | 'alibi' | 'profile'

interface CaseState {
  case: Case | null
  loadCase: () => Promise<void>
  selectedStudentId: string | null
  selectStudent: (id: string | null) => void
  selectedBuildingId: string | null
  selectBuilding: (id: string | null) => void
  replayTime: number
  setReplayTime: (min: number) => void
  isPlaying: boolean
  togglePlay: () => void
  judgeMode: boolean
  setJudgeMode: (b: boolean) => void
  examined: Record<string, { lecture: boolean; hours: boolean; alibi: boolean; profile: boolean }>
  markExamined: (id: string, check: ExamCheck) => void
  revealedFlagIds: Set<string>
  badges: number
  accusation: { conspirators: string[]; mastermind: string | null }
  hint: string
  setHint: (text: string) => void
}

export const useCaseStore = create<CaseState>((set, get) => ({
  case: null,
  loadCase: async () => {
    const c = await fetchCase()
    set({
      case: c,
      replayTime: c.meta.time_min,
      judgeMode: true,
      revealedFlagIds: new Set(c.flags.map((f) => f.id)),
    })
  },
  selectedStudentId: null,
  selectStudent: (id) => set({ selectedStudentId: id }),
  selectedBuildingId: null,
  selectBuilding: (id) => set({ selectedBuildingId: id }),
  replayTime: 480,
  setReplayTime: (min) => set({ replayTime: min }),
  isPlaying: false,
  togglePlay: () => {
    const next = !get().isPlaying
    set({ isPlaying: next })
  },
  judgeMode: true,
  setJudgeMode: (b) => set({ judgeMode: b }),
  examined: {},
  markExamined: (id, check) => {
    const prev = get().examined[id] ?? {
      lecture: false,
      hours: false,
      alibi: false,
      profile: false,
    }
    set({ examined: { ...get().examined, [id]: { ...prev, [check]: true } } })
  },
  revealedFlagIds: new Set(),
  badges: 3,
  accusation: { conspirators: [], mastermind: null },
  hint: '',
  setHint: (text) => set({ hint: text }),
}))

export function studentById(c: Case | null, id: string | null): Student | undefined {
  if (!c || !id) return undefined
  return c.students.find((s) => s.id === id)
}

export function buildingById(c: Case | null, id: string | null): Building | undefined {
  if (!c || !id) return undefined
  return c.buildings.find((b) => b.id === id)
}

export function visitsFor(c: Case | null, studentId: string): Visit[] {
  if (!c) return []
  return c.visits.filter((v) => v.student_id === studentId)
}

export function flagsFor(c: Case | null, studentId: string): Flag[] {
  if (!c) return []
  return c.flags.filter((f) => f.student_id === studentId)
}

export function suspectFor(c: Case | null, studentId: string): Suspect | undefined {
  if (!c) return undefined
  return c.suspects.find((s) => s.student_id === studentId)
}

export function meetingsUntil(c: Case | null, t: number): Meeting[] {
  if (!c) return []
  return c.meetings.filter((m) => m.start <= t)
}

export function boardStudents(c: Case | null): Student[] {
  if (!c) return []
  const ranked = [...c.suspects].sort(
    (a, b) =>
      b.score + 2 * b.conspirators_met.length - (a.score + 2 * a.conspirators_met.length),
  )
  const ids = new Set(ranked.slice(0, 12).map((s) => s.student_id))
  const mm = c.suspects.find((s) => s.verdict === 'mastermind')
  if (mm) ids.add(mm.student_id)
  return c.students.filter((s) => ids.has(s.id))
}
