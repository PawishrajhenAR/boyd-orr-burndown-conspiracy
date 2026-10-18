import type { ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

export interface BasisRow {
  key: string
  /** Rule being applied, e.g. "Broke at least one rule". */
  label: string
  /** Threshold in words, e.g. "score > 0". */
  threshold: string
  before: number
  after: number
  state: 'active' | 'done'
}

interface Props {
  title: string
  rows: BasisRow[]
  /** Extra detail under the rows (rule list, severity table…). */
  children?: ReactNode
}

/** Right-hand "why" panel: rule · threshold · count before → after, for every filter step shown so far. */
export default function FilterBasis({ title, rows, children }: Props) {
  return (
    <aside className="flex w-72 shrink-0 flex-col gap-3 overflow-y-auto rounded-md border border-paper/15 bg-[#1b1714]/90 p-4" aria-label="Filter basis">
      <h3 className="font-type text-sm tracking-[0.25em] text-amber uppercase">{title}</h3>
      <ol className="space-y-2">
        <AnimatePresence initial={false}>
          {rows.map((r) => (
            <motion.li
              key={r.key}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              className={`rounded border px-3 py-2 ${r.state === 'active' ? 'border-amber bg-amber/10' : 'border-paper/15'}`}
            >
              <p className="text-sm font-semibold text-paper">{r.label}</p>
              <p className="font-mono text-[11px] text-paper/70">{r.threshold}</p>
              <p className="mt-1 font-mono text-sm text-paper">
                {r.before} <span className="text-paper/60">→</span> <b className="text-amber">{r.after}</b>
              </p>
            </motion.li>
          ))}
        </AnimatePresence>
      </ol>
      {children}
    </aside>
  )
}
