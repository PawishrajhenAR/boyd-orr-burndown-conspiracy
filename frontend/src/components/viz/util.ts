import { useEffect, useState, type RefObject } from 'react'
import { scaleLinear, type ScaleLinear } from 'd3'
import type { Flag, Verdict } from '../../types/case'
import { useCaseStore } from '../../store/useCaseStore'

/** Format minutes-from-midnight as HH:MM; values ≥1440 show next-day marker. */
export function hhmm(min: number): string {
  const day = Math.floor(min / 1440)
  const wrapped = ((min % 1440) + 1440) % 1440
  const h = Math.floor(wrapped / 60)
  const m = wrapped % 60
  const base = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
  return day > 0 ? `${base}⁺` : base
}

export function timeScale(
  width: number,
  tMin: number,
  tMax: number,
): ScaleLinear<number, number> {
  return scaleLinear().domain([tMin, tMax]).range([0, width])
}

export function verdictColor(verdict: string | Verdict | null | undefined): string {
  switch (verdict) {
    case 'conspirator':
      return '#d62828'
    case 'mastermind':
      return '#ffd166'
    case 'suspicious':
      return '#d35400'
    case 'clear':
      return '#a8927a'
    default:
      return '#a8927a'
  }
}

/** Flags visible to the player: all in judge mode, else only revealed ones. */
export function useVisibleFlags(): Flag[] {
  const flags = useCaseStore((s) => s.case?.flags ?? [])
  const judgeMode = useCaseStore((s) => s.judgeMode)
  const revealedFlagIds = useCaseStore((s) => s.revealedFlagIds)
  if (judgeMode) return flags
  return flags.filter((f) => revealedFlagIds.has(f.id))
}

export function useSvgSize(ref: RefObject<Element | null>): {
  width: number
  height: number
} {
  const [size, setSize] = useState({ width: 0, height: 0 })

  useEffect(() => {
    const el = ref.current
    if (!el) return

    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        width: Math.max(0, Math.floor(rect.width)),
        height: Math.max(0, Math.floor(rect.height)),
      })
    }

    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  return size
}

/** True if building is open at minute t (supports open_end ≥ 1440). */
export function isOpenAt(
  building: {
    always_open: boolean
    open_start: number
    open_end: number
  },
  t: number,
): boolean {
  if (building.always_open) return true
  if (building.open_end >= building.open_start) {
    return t >= building.open_start && t < building.open_end
  }
  return t >= building.open_start || t < building.open_end
}

export const TOKENS = {
  accent: '#ffb347',
  pin: '#d62828',
  panel: '#2a1f17',
  panelBorder: '#4a3524',
  networkDark: '#0b1020',
  muted: '#a8927a',
  mutedSoft: '#d9c3a5',
  warn: '#d35400',
  mastermind: '#ffd166',
} as const

/** Dark link-analysis palette for Network page / NetworkMini. */
export const NETWORK = {
  bg: '#0b1020',
  teal: '#2ec4b6',
  violet: '#9b5de5',
  conspirator: '#ff4d5e',
  mastermind: '#ffd166',
  edge: '#2ec4b6',
  edgeGold: '#ffd166',
} as const
