export default function Background({ step: _step }: { step: number }) {
  return <div className="no-print pointer-events-none fixed inset-0 z-0 bg-black" aria-hidden="true" />
}
