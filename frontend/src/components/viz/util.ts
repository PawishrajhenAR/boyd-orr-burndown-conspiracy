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
      return '#ef4444'
    case 'mastermind':
      return '#e3af35'
    case 'suspicious':
      return '#c2820a'
    case 'clear':
      return '#a1a1aa'
    default:
      return '#a1a1aa'
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

/** ResizeObserver that schedules work on rAF (avoids loop-notification floods). */
export function observeResize(el: Element, onResize: () => void): () => void {
  let raf = 0
  const schedule = () => {
    cancelAnimationFrame(raf)
    raf = requestAnimationFrame(onResize)
  }
  const ro = new ResizeObserver(schedule)
  ro.observe(el)
  return () => {
    cancelAnimationFrame(raf)
    ro.disconnect()
  }
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
    return observeResize(el, measure)
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
  accent: '#e3af35',
  pin: '#ef4444',
  panel: '#101013',
  panelBorder: 'rgba(255,255,255,0.08)',
  networkDark: '#09090b',
  muted: '#a1a1aa',
  mutedSoft: '#e4e4e7',
  warn: '#c2820a',
  mastermind: '#38e062',
  primary: '#38e062',
} as const

/** Amber Dark link-analysis palette for Network page / NetworkMini. */
export const NETWORK = {
  bg: '#09090b',
  teal: '#38e062',
  violet: '#e3af35',
  conspirator: '#ef4444',
  mastermind: '#e3af35',
  edge: '#38e062',
  edgeGold: '#e3af35',
} as const
