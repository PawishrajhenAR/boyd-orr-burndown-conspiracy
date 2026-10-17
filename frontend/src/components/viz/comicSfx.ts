/**
 * Comic-book Web Audio SFX for P5 viz pages.
 * Respects P4's global mute (`soundIsMuted`).
 */
import { soundIsMuted } from '../game/audio'

export type ComicSfx =
  | 'whoosh'
  | 'thwip'
  | 'pow'
  | 'bam'
  | 'zap'
  | 'tick'
  | 'slam'
  | 'reveal'
  | 'flag'
  | 'play'

let ctx: AudioContext | null = null

function ac(): AudioContext | null {
  if (typeof window === 'undefined') return null
  ctx ??= new AudioContext()
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

function beep(
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  slideTo?: number,
) {
  const c = ac()
  if (!c) return
  const now = c.currentTime
  const o = c.createOscillator()
  const g = c.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, now)
  if (slideTo != null) o.frequency.exponentialRampToValueAtTime(Math.max(40, slideTo), now + dur)
  g.gain.setValueAtTime(vol, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + dur)
  o.connect(g).connect(c.destination)
  o.start(now)
  o.stop(now + dur)
}

function noiseBurst(dur: number, vol: number, filterFreq: number) {
  const c = ac()
  if (!c) return
  const n = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate)
  const data = n.getChannelData(0)
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = n
  const filter = c.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = filterFreq
  const g = c.createGain()
  const now = c.currentTime
  g.gain.setValueAtTime(vol, now)
  g.gain.exponentialRampToValueAtTime(0.001, now + dur)
  src.connect(filter).connect(g).connect(c.destination)
  src.start(now)
  src.stop(now + dur)
}

export function playComicSfx(kind: ComicSfx) {
  if (soundIsMuted()) return
  switch (kind) {
    case 'whoosh':
      noiseBurst(0.22, 0.08, 900)
      beep(420, 0.18, 'sine', 0.03, 180)
      break
    case 'thwip':
      beep(980, 0.05, 'square', 0.04, 1600)
      beep(1400, 0.08, 'triangle', 0.025, 600)
      break
    case 'pow':
      beep(120, 0.12, 'sawtooth', 0.06, 70)
      noiseBurst(0.1, 0.07, 400)
      break
    case 'bam':
      beep(90, 0.18, 'square', 0.07, 55)
      beep(220, 0.1, 'sawtooth', 0.04)
      break
    case 'zap':
      beep(880, 0.06, 'square', 0.045, 2200)
      beep(1600, 0.05, 'sawtooth', 0.03, 400)
      break
    case 'tick':
      beep(880, 0.03, 'triangle', 0.03)
      break
    case 'slam':
      noiseBurst(0.15, 0.09, 200)
      beep(70, 0.2, 'sine', 0.07, 40)
      break
    case 'reveal':
      beep(440, 0.1, 'triangle', 0.04)
      beep(660, 0.12, 'triangle', 0.04)
      beep(990, 0.18, 'sine', 0.05, 1320)
      break
    case 'flag':
      beep(200, 0.1, 'sawtooth', 0.05, 110)
      beep(360, 0.08, 'square', 0.03)
      break
    case 'play':
      beep(520, 0.06, 'triangle', 0.04)
      beep(780, 0.1, 'sine', 0.035)
      break
  }
}
