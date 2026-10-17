import type { Case } from '../types/case'

export async function loadCase(): Promise<Case> {
  try {
    const ctrl = new AbortController()
    const t = setTimeout(() => ctrl.abort(), 2000)
    const res = await fetch('/api/case', { signal: ctrl.signal })
    clearTimeout(t)
    if (res.ok) return (await res.json()) as Case
  } catch {
    /* fall through */
  }
  for (const path of ['/case.json', '/case.sample.json']) {
    const res = await fetch(path)
    if (res.ok) return (await res.json()) as Case
  }
  throw new Error('No case data found')
}
