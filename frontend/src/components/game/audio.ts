export type GameSound = 'tap' | 'select' | 'clue' | 'danger' | 'success'

let muted = false
let context: AudioContext | null = null

function audioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null
  context ??= new AudioContext()
  if (context.state === 'suspended') void context.resume()
  return context
}

export function playGameSound(kind: GameSound) {
  if (muted) return
  const ctx = audioContext()
  if (!ctx) return
  const now = ctx.currentTime
  const settings: Record<GameSound, [number, number, OscillatorType, number]> = {
    tap: [440, 0.055, 'sine', 0.035],
    select: [620, 0.08, 'triangle', 0.045],
    clue: [740, 0.12, 'sine', 0.04],
    danger: [160, 0.16, 'sawtooth', 0.045],
    success: [880, 0.14, 'triangle', 0.045],
  }
  const [frequency, duration, type, volume] = settings[kind]
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = type
  oscillator.frequency.setValueAtTime(frequency, now)
  if (kind === 'success') oscillator.frequency.exponentialRampToValueAtTime(1320, now + duration)
  if (kind === 'danger') oscillator.frequency.exponentialRampToValueAtTime(95, now + duration)
  gain.gain.setValueAtTime(volume, now)
  gain.gain.exponentialRampToValueAtTime(0.001, now + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(now)
  oscillator.stop(now + duration)
}

export function soundIsMuted() { return muted }
export function toggleSound() { muted = !muted; return muted }
