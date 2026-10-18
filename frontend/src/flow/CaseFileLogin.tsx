import { useEffect, useRef, useState, type FormEvent } from 'react'
import { motion, useAnimationControls } from 'framer-motion'
import type { Case } from '../types/case'
import { play } from './sound'

/** Story gate only — NOT real security. The values are printed on the sticky note. */
const CREDENTIALS = { id: 'investigator', passcode: 'bonfire1105' } as const

const KRAFT = '#c9a266'
const KRAFT_DARK = '#a8814a'
const KRAFT_DEEP = '#7d5c2e'
const STRING = '#8f2a20'

type Ease = [number, number, number, number]
const SMOOTH: Ease = [0.65, 0, 0.35, 1]

/** Opening timeline (seconds after a correct login). */
const T = {
  stamp: 0,
  unwind: 0.25, // loops spin off the button
  retract: 0.45, // string slides back to the spine
  open: 0.85, // cover swings open on the rings
  openDuration: 1.2,
  zoom: 2.05, // push into the first page
  zoomDuration: 1.15,
  fade: 2.75,
  fadeDuration: 0.5,
}

const RINGS = 8

interface Props {
  c: Case
  onUnlock: () => void
  reducedMotion: boolean
}

export default function CaseFileLogin({ c, onUnlock, reducedMotion }: Props) {
  const [id, setId] = useState('')
  const [pass, setPass] = useState('')
  const [denied, setDenied] = useState(false)
  const [opening, setOpening] = useState(false)
  const shake = useAnimationControls()
  const firstInput = useRef<HTMLInputElement>(null)
  const timers = useRef<number[]>([])
  const unlocked = useRef(false)

  useEffect(() => () => timers.current.forEach(window.clearTimeout), [])

  // Paper swish as the file slides in (silent if the browser hasn't allowed audio yet).
  useEffect(() => {
    play('swish')
    const t = window.setTimeout(() => firstInput.current?.focus(), reducedMotion ? 0 : 900)
    return () => clearTimeout(t)
  }, [reducedMotion])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (opening) return
    if (id === CREDENTIALS.id && pass === CREDENTIALS.passcode) {
      setDenied(false)
      setOpening(true)
      play('stamp')
      if (reducedMotion) {
        timers.current.push(window.setTimeout(() => {
          if (!unlocked.current) {
            unlocked.current = true
            onUnlock()
          }
        }, 150))
        return
      }
      const at = (s: number, fn: () => void) => {
        timers.current.push(window.setTimeout(fn, s * 1000))
      }
      at(T.retract, () => play('slide'))
      at(T.open, () => play('pageturn'))
      at(T.zoom, () => play('whoosh'))
    } else {
      setDenied(true)
      play('buzz')
      void shake.start({ x: [0, -16, 16, -11, 11, -5, 0], transition: { duration: 0.5, ease: 'easeInOut' } })
    }
  }

  const at = (delay: number, duration: number, ease: Ease | 'easeIn' | 'easeOut' = SMOOTH) =>
    reducedMotion ? { duration: 0 } : { delay, duration, ease }

  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden px-6">
      {/* Hold the file steady through the cover turn, then push into the revealed page. */}
      <motion.div
        initial={reducedMotion ? false : { y: '80vh', rotate: -6, opacity: 0 }}
        animate={
          opening && !reducedMotion
            ? { y: 0, rotate: 0, opacity: 1, x: 0, scale: 3.2 }
            : { y: 0, rotate: -1.5, opacity: 1, x: 0, scale: 1 }
        }
        transition={
          opening
            ? {
                y: { duration: 0.45, ease: SMOOTH },
                rotate: { duration: 0.45, ease: SMOOTH },
                scale: reducedMotion
                  ? { duration: 0 }
                  : { delay: T.zoom, duration: T.zoomDuration, ease: [0.35, 0, 0.2, 1] },
              }
            : { type: 'spring', stiffness: 60, damping: 15 }
        }
        style={{ transformOrigin: '52% 48%', willChange: opening ? 'transform' : undefined }}
      >
        <motion.div
          animate={shake}
          className="relative"
          style={{ height: 'min(80vh, 720px)', aspectRatio: '0.84 / 1', maxWidth: '88vw', perspective: 1800 }}
        >
          {/* back board */}
          <div
            className="absolute inset-0 translate-x-[10px] translate-y-[8px] rounded-md shadow-[0_40px_90px_rgba(0,0,0,0.7)]"
            style={{ background: `linear-gradient(160deg, ${KRAFT_DARK}, ${KRAFT_DEEP})` }}
          />

          {/* first page inside the file (revealed when the cover opens) */}
          <div className="absolute inset-[3%_3%_3%_6%] overflow-hidden rounded-sm bg-paper px-[8%] py-[8%] text-ink shadow-inner">
            <div
              className="pointer-events-none absolute inset-0 opacity-50"
              style={{ backgroundImage: 'repeating-linear-gradient(to bottom, transparent 0 31px, rgba(29,26,23,0.08) 31px 32px)' }}
            />
            <p className="font-mono text-[clamp(10px,1.4vh,13px)] tracking-[0.3em] text-ink/70">CAMPUS SECURITY · CASE FILE #1105</p>
            <h2 className="mt-3 font-type text-[clamp(20px,3.6vh,34px)] leading-tight">{c.meta.case_name.replace(/^Case File #\d+:\s*/, '')}</h2>
            <p className="mt-1 font-mono text-[clamp(10px,1.5vh,14px)] text-ink/70">Day under investigation: {c.meta.day_label}</p>
            <div className="my-[5%] h-px bg-ink/20" />
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3 font-mono text-[clamp(11px,1.7vh,16px)]">
              {[
                ['Students on file', c.meta.counts.students ?? c.students.length],
                ['Access swipes', c.meta.counts.visits ?? c.visits.length],
                ['Buildings', c.meta.counts.buildings ?? c.buildings.length],
                ['Witness statements', c.meta.counts.statements ?? c.statements.length],
              ].map(([label, n]) => (
                <div key={label as string}>
                  <dt className="text-ink/60">{label}</dt>
                  <dd className="font-type text-[clamp(18px,3vh,28px)]">{n}</dd>
                </div>
              ))}
            </dl>
            <div className="my-[5%] h-px bg-ink/20" />
            <p className="font-type text-[clamp(13px,2vh,18px)]">Next: briefing with PC Morag, then the first sweep →</p>
            <div className="absolute right-[8%] bottom-[7%] -rotate-[8deg] border-4 border-blood px-3 py-1 font-type text-[clamp(12px,2vh,18px)] tracking-widest text-blood opacity-85">
              INVESTIGATION OPEN
            </div>
          </div>

          {/* the cover: swings open around the left spine */}
          <motion.div
            className="absolute inset-0 origin-left"
            style={{ transformStyle: 'preserve-3d', zIndex: 5 }}
            initial={false}
            animate={{ rotateY: opening ? -168 : 0 }}
            transition={at(T.open, T.openDuration)}
          >
            {/* inside of the cover */}
            <div
              className="absolute inset-0 rounded-md"
              style={{ transform: 'rotateY(180deg)', backfaceVisibility: 'hidden', background: `linear-gradient(200deg, ${KRAFT_DARK}, ${KRAFT_DEEP})` }}
            >
              <div className="absolute inset-x-[10%] bottom-[8%] h-[30%] rounded-sm border border-black/15 bg-black/10" />
            </div>

            {/* front of the cover */}
            <div
              className="absolute inset-0 overflow-visible rounded-md"
              style={{ backfaceVisibility: 'hidden', background: `linear-gradient(165deg, #d6b277 0%, ${KRAFT} 55%, #b88f55 100%)` }}
            >
              {/* paper texture + coffee ring */}
              <div
                className="pointer-events-none absolute inset-0 rounded-md"
                style={{
                  background:
                    'radial-gradient(ellipse at 25% 15%, rgba(255,255,255,0.22), transparent 55%), radial-gradient(circle at 78% 82%, transparent 9%, rgba(110,70,30,0.18) 10%, transparent 11.5%)',
                }}
              />

              {/* title */}
              <div className="absolute inset-x-[12%] top-[7%]">
                <p className="font-mono text-[clamp(10px,1.4vh,13px)] tracking-[0.35em] text-ink/70">CAMPUS SECURITY DIVISION</p>
                <p className="mt-1 font-type text-[clamp(24px,4.6vh,44px)] leading-none tracking-[0.12em] text-ink">CASE FILE</p>
                <p className="font-type text-[clamp(18px,3vh,30px)] tracking-[0.3em] text-blood">#1105</p>
              </div>

              {/* sticky note with the credentials */}
              <div className="absolute top-[6%] right-[7%] w-[34%] rotate-[4deg] bg-[#fff2a8] px-[3%] py-[2.5%] font-mono text-[clamp(10px,1.45vh,13px)] leading-relaxed text-ink shadow-[0_6px_14px_rgba(0,0,0,0.3)]">
                <span className="absolute -top-2 left-1/2 h-4 w-14 -translate-x-1/2 rotate-[-3deg] bg-white/50" aria-hidden="true" />
                Investigator ID: <b>{CREDENTIALS.id}</b>
                <br />
                Passcode: <b>{CREDENTIALS.passcode}</b>
              </div>

              {/* login plate + button */}
              <form onSubmit={submit} className="absolute inset-x-[15%] top-[36%] flex flex-col items-center gap-[clamp(10px,2.2vh,22px)]">
                <div className="relative w-full rounded-sm bg-paper px-[6%] py-[clamp(12px,2.6vh,26px)] text-ink shadow-[0_8px_20px_rgba(0,0,0,0.3)]">
                  <label className="flex items-center gap-3 font-type text-[clamp(11px,1.5vh,14px)] tracking-wider">
                    <span className="w-[46%] shrink-0 whitespace-nowrap uppercase">Investigator ID</span>
                    <input
                      ref={firstInput}
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      autoComplete="off"
                      disabled={opening}
                      className="min-w-0 flex-1 border-b-2 border-ink/40 bg-transparent px-1 py-1 font-mono text-[clamp(13px,1.9vh,17px)] outline-none focus:border-blood"
                    />
                  </label>
                  <label className="mt-[clamp(10px,2vh,20px)] flex items-center gap-3 font-type text-[clamp(11px,1.5vh,14px)] tracking-wider">
                    <span className="w-[46%] shrink-0 whitespace-nowrap uppercase">Passcode</span>
                    <input
                      type="password"
                      value={pass}
                      onChange={(e) => setPass(e.target.value)}
                      disabled={opening}
                      className="min-w-0 flex-1 border-b-2 border-ink/40 bg-transparent px-1 py-1 font-mono text-[clamp(13px,1.9vh,17px)] outline-none focus:border-blood"
                    />
                  </label>
                  <p className="mt-2 h-4 text-center font-mono text-xs text-blood" role="alert">
                    {denied ? 'Access denied' : ''}
                  </p>
                  {/* ACCESS GRANTED stamp */}
                  <motion.span
                    className="pointer-events-none absolute top-1/2 left-1/2 border-[5px] border-blood bg-paper/70 px-4 py-1 font-type text-[clamp(16px,2.8vh,26px)] tracking-[0.2em] whitespace-nowrap text-blood"
                    initial={false}
                    animate={opening ? { opacity: 1, scale: 1, x: '-50%', y: '-50%', rotate: -10 } : { opacity: 0, scale: 2.6, x: '-50%', y: '-50%', rotate: -10 }}
                    transition={reducedMotion ? { duration: 0 } : { type: 'spring', stiffness: 520, damping: 20 }}
                  >
                    ACCESS GRANTED
                  </motion.span>
                </div>
                <button
                  type="submit"
                  disabled={opening}
                  className="rounded-sm bg-ink px-[8%] py-[clamp(8px,1.4vh,12px)] font-type text-[clamp(13px,2vh,18px)] tracking-[0.2em] text-paper shadow-[0_6px_14px_rgba(0,0,0,0.35)] transition hover:bg-oxblood disabled:opacity-70"
                >
                  Open the file
                </button>
              </form>

              {/* CONFIDENTIAL stamp */}
              <div className="absolute bottom-[7%] left-[14%] -rotate-[6deg] border-4 border-blood/80 px-3 py-0.5 font-type text-[clamp(13px,2.2vh,22px)] tracking-[0.25em] text-blood/80">
                CONFIDENTIAL
              </div>

              {/* the string: from the spine, over the plate, to the button on the right edge */}
              <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="pointer-events-none absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                <motion.path
                  d="M -1 63 C 14 46, 30 31, 52 30 C 74 29, 92 36, 100 47"
                  fill="none"
                  stroke={STRING}
                  strokeWidth={0.55}
                  strokeLinecap="round"
                  initial={false}
                  animate={{ pathLength: opening ? 0 : 1, opacity: opening ? 0 : 1 }}
                  transition={{ pathLength: at(T.retract, 0.75, 'easeIn'), opacity: at(T.retract + 0.6, 0.2) }}
                />
              </svg>

              {/* button with the string wound round it (figure-of-eight) */}
              <motion.div
                className="absolute top-[47%] right-0 h-[clamp(34px,6vh,54px)] w-[clamp(34px,6vh,54px)] translate-x-1/2 -translate-y-1/2"
                initial={false}
                animate={opening ? { rotate: 540 } : { rotate: 0 }}
                transition={at(T.unwind, 0.8, 'easeOut')}
              >
                <div className="absolute inset-0 rounded-full shadow-[0_3px_8px_rgba(0,0,0,0.45)]" style={{ background: 'radial-gradient(circle at 35% 30%, #e8d3a0, #a8874e 60%, #6e5228)' }} />
                <div className="absolute top-1/2 left-[34%] h-[12%] w-[12%] -translate-y-1/2 rounded-full bg-[#4a3519]" />
                <div className="absolute top-1/2 right-[34%] h-[12%] w-[12%] -translate-y-1/2 rounded-full bg-[#4a3519]" />
                <svg viewBox="0 0 40 40" className="absolute inset-0 h-full w-full overflow-visible" aria-hidden="true">
                  <motion.g initial={false} animate={{ opacity: opening ? 0 : 1, scale: opening ? 1.6 : 1 }} transition={at(T.unwind, 0.7, 'easeIn')} style={{ transformOrigin: '20px 20px' }}>
                    <path d="M4 20 C 4 6, 36 34, 36 20 C 36 6, 4 34, 4 20 Z" fill="none" stroke={STRING} strokeWidth="2.6" />
                    <path d="M8 14 C 16 26, 24 26, 32 14" fill="none" stroke={STRING} strokeWidth="2.2" />
                    <path d="M8 26 C 16 14, 24 14, 32 26" fill="none" stroke={STRING} strokeWidth="2.2" />
                  </motion.g>
                </svg>
              </motion.div>
            </div>
          </motion.div>

          {/* spiral rings on the spine (they belong to the back board, so they stay put) */}
          <svg
            className="pointer-events-none absolute top-[4%] -left-[18px] h-[92%] w-[44px] overflow-visible"
            viewBox="0 0 44 100"
            preserveAspectRatio="none"
            style={{ zIndex: 10 }}
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="ring-metal" x1="0" x2="1">
                <stop offset="0" stopColor="#5d5a55" />
                <stop offset="0.45" stopColor="#e9e6df" />
                <stop offset="1" stopColor="#7a766f" />
              </linearGradient>
            </defs>
            {Array.from({ length: RINGS }, (_, i) => {
              const y = 4 + (i * 92) / (RINGS - 1)
              return (
                <g key={i}>
                  <ellipse cx="30" cy={y} rx="2.2" ry="1.1" fill="#3b2a14" />
                  <path d={`M30 ${y} C 2 ${y - 4.5}, 2 ${y + 4.5}, 30 ${y + 0.6}`} fill="none" stroke="url(#ring-metal)" strokeWidth="3.2" vectorEffect="non-scaling-stroke" strokeLinecap="round" />
                </g>
              )
            })}
          </svg>
        </motion.div>
      </motion.div>

      {/* Finish the camera push before handing off to the title card. */}
      {opening && !reducedMotion && (
        <motion.div
          className="pointer-events-none absolute inset-0 bg-black"
          style={{ zIndex: 50 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: T.fade, duration: T.fadeDuration, ease: SMOOTH }}
          onAnimationComplete={() => {
            if (!unlocked.current) {
              unlocked.current = true
              onUnlock()
            }
          }}
        />
      )}
    </div>
  )
}
