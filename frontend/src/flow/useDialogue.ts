import { useCallback, useState } from 'react'

/** Dialogue state for a page: index, auto, advance/skip/reset. */
export function useDialogue(length: number, active: boolean, autoDefault = true) {
  const [index, setIndex] = useState(-1)
  const [auto, setAuto] = useState(autoDefault)
  if (active && index === -1 && length > 0) setIndex(0)
  const advance = useCallback(() => setIndex((i) => Math.min(length - 1, i + 1)), [length])
  const skip = useCallback(() => setIndex(length - 1), [length])
  const reset = useCallback(() => setIndex(0), [])
  const toggleAuto = useCallback(() => setAuto((a) => !a), [])
  return { index, auto, advance, skip, reset, toggleAuto }
}
