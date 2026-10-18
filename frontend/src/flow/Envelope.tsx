import { useEffect, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import { play } from './sound'

/** Story gate only — NOT real security. The values are printed on the envelope. */
const CREDENTIALS = { id: 'investigator', passcode: 'bonfire1105' } as const

const MANILA = '#d8b673'
const MANILA_DARK = '#c49d55'

interface Props {
  onUnlock: () => void
  reducedMotion: boolean
}

export default function Envelope({ onUnlock, reducedMotion }: Props) {
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [denied, setDenied] = useState(false)
  const [open, setOpen] = useState(false)
  const shake = useAnimationControls()

  // Paper swish as the envelope slides in (silent if the browser hasn't allowed audio yet).
  useEffect(() => {
    play('swish')
  }, [])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (open) return
    if (id === CREDENTIALS.id && pass === CREDENTIALS.passcode) {
      setDenied(false)
      setOpen(true)
      play('crack')
      window.setTimeout(() => play('slide'), reducedMotion ? 0 : 850)
      window.setTimeout(onUnlock, reducedMotion ? 150 : 2000)
    } else {
      setDenied(true)
      play('buzz')
      void shake.start({ x: [0, -14, 14, -10, 10, -4, 0], transition: { duration: 0.45 } })
    }
  }

  const t = (delay: number, duration: number) => (reducedMotion ? { duration: 0 } : { delay, duration, ease: 'easeInOut' as const })

  return (
    <div className="flex h-full flex-col items-center justify-center gap-8 px-6">
      <motion.div
        className="mt-32"
        initial={reducedMotion ? false : { y: '70vh', rotate: -4 }}
        animate={{ y: 0, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 70, damping: 14 }}
      >
        <motion.div animate={shake} className="relative h-[300px] w-[min(480px,90vw)]" style={{ perspective: 900 }}>
          {/* back of the envelope */}
          <div className="absolute inset-0 rounded-md shadow-2xl" style={{ background: MANILA_DARK }} />

          {/* the paper inside */}
          <motion.div
            className="absolute inset-x-8 top-3 z-10 flex h-[85%] flex-col items-center justify-start rounded-sm bg-paper pt-6 text-ink shadow"
            animate={{ y: open ? -170 : 0 }}
            transition={t(0.9, 0.8)}
          >
            <p className="font-type text-lg tracking-widest">CASE FILE #1105</p>
            <p className="mt-1 font-mono text-xs text-ink/70">ACCESS GRANTED</p>
          </motion.div>

          {/* front pocket */}
          <div className="absolute inset-0 z-20 overflow-hidden rounded-md" style={{ background: MANILA }}>
            <div
              className="absolute inset-0"
              style={{
                background: `linear-gradient(to top right, transparent 49.6%, ${MANILA_DARK}55 50%, transparent 50.4%),
                             linear-gradient(to top left, transparent 49.6%, ${MANILA_DARK}55 50%, transparent 50.4%)`,
              }}
            />
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 -rotate-[8deg] border-4 border-blood px-4 py-1 font-type text-xl tracking-widest whitespace-nowrap text-blood opacity-90">
              CONFIDENTIAL · CASE #1105
            </div>
          </div>

          {/* flap: rotates open around its top edge */}
          <motion.div
            className="absolute inset-x-0 top-0 h-[55%] origin-top"
            style={{
              background: MANILA_DARK,
              clipPath: 'polygon(0 0, 100% 0, 50% 100%)',
              zIndex: open ? 5 : 30,
              transformStyle: 'preserve-3d',
            }}
            animate={{ rotateX: open ? 180 : 0 }}
            transition={t(0.35, 0.6)}
          >
            <motion.div
              animate={{ opacity: open ? 0 : 1 }}
              transition={t(0.3, 0.2)}
              className="mx-auto mt-4 w-max rounded-sm bg-paper/90 px-3 py-1 text-center font-mono text-[11px] leading-5 text-ink shadow-sm"
            >
              Investigator ID: <b>{CREDENTIALS.id}</b>
              <br />
              Passcode: <b>{CREDENTIALS.passcode}</b>
            </motion.div>
          </motion.div>

          {/* wax seal: two halves that crack apart */}
          {(['left', 'right'] as const).map((side) => (
            <motion.div
              key={side}
              className="absolute top-[55%] left-1/2 z-40 h-14 w-14 -translate-x-1/2 -translate-y-1/2 rounded-full shadow-md"
              style={{
                background: 'radial-gradient(circle at 35% 35%, #c7352d, #7d0e0e)',
                clipPath: side === 'left' ? 'inset(0 50% 0 0)' : 'inset(0 0 0 50%)',
              }}
              animate={
                open
                  ? { x: side === 'left' ? -18 : 18, rotate: side === 'left' ? -25 : 25, opacity: 0 }
                  : { x: 0, rotate: 0, opacity: 1 }
              }
              transition={t(0, 0.45)}
            >
              <span className="flex h-full items-center justify-center font-type text-sm text-paper/80">1105</span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <form onSubmit={submit} className="flex w-[min(480px,90vw)] flex-col gap-3">
        <label className="flex flex-col gap-1 text-xs tracking-widest text-paper/60 uppercase">
          Investigator ID
          <input
            value={id}
            onChange={(e) => setId(e.target.value)}
            autoComplete="off"
            autoFocus
            className="rounded border border-paper/20 bg-black/30 px-3 py-2 font-mono text-base text-paper outline-none focus:border-amber"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs tracking-widest text-paper/60 uppercase">
          Passcode
          <input
            type="password"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            className="rounded border border-paper/20 bg-black/30 px-3 py-2 font-mono text-base text-paper outline-none focus:border-amber"
          />
        </label>
        <button
          type="submit"
          className="mt-1 rounded bg-amber px-4 py-2 font-type text-lg tracking-widest text-ink transition hover:brightness-110 disabled:opacity-50"
          disabled={open}
        >
          Break the seal
        </button>
        <p className="h-5 text-center font-mono text-sm text-alarm" role="alert">
          {denied ? 'Access denied' : ''}
        </p>
      </form>
    </div>
  )
}
