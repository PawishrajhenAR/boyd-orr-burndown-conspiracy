import { Howl, Howler } from 'howler'

/**
 * One sound manager for the whole flow (Howler.js handles browser audio quirks).
 * - Nothing plays until the first user gesture (browsers block audio before that anyway).
 * - Each sound has a minimum gap and at most MAX_CONCURRENT copies playing at once.
 * - Mute is remembered in localStorage.
 */
export type SfxName =
  | 'swish'
  | 'buzz'
  | 'crack'
  | 'slide'
  | 'key'
  | 'shuffle'
  | 'flick'
  | 'blip'
  | 'whoosh'
  | 'ticking'
  | 'stamp'
  | 'nodetick'
  | 'heartbeat'
  | 'sting'
  | 'pageturn'

const MASTER_VOLUME = 0.4
const MAX_CONCURRENT = 3
const STORAGE_KEY = 'investigation-flow-muted'

/** Minimum milliseconds between two plays of the same sound. */
const GAP_MS: Record<SfxName, number> = {
  swish: 300,
  buzz: 250,
  crack: 300,
  slide: 300,
  key: 40,
  shuffle: 1000,
  flick: 60,
  blip: 120,
  whoosh: 300,
  ticking: 1000,
  stamp: 90,
  nodetick: 60,
  heartbeat: 250,
  sting: 1500,
  pageturn: 400,
}

const howls = new Map<SfxName, Howl>()
const lastPlayed = new Map<SfxName, number>()
const playing = new Map<SfxName, number>()
const listeners = new Set<(muted: boolean) => void>()

/** Every sound that actually played, in order (read by the e2e smoke test as `window.__sfx`). */
export const sfxLog: SfxName[] = []
if (typeof window !== 'undefined') (window as unknown as { __sfx: SfxName[] }).__sfx = sfxLog

let unlocked = false
let muted = readMuted()

function readMuted(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1'
  } catch {
    return false
  }
}

function howl(name: SfxName): Howl {
  let h = howls.get(name)
  if (!h) {
    // `Howl` = one loaded sound; `preload` fetches the file now so the first play isn't late.
    h = new Howl({ src: [`/sfx/${name}.mp3`], preload: true })
    howls.set(name, h)
  }
  return h
}

/** Call on the first click / key press. Until then every play() is ignored. */
export function unlockAudio(): void {
  if (unlocked) return
  unlocked = true
  Howler.volume(MASTER_VOLUME) // `Howler` = the global mixer; this sets the master volume.
  for (const name of Object.keys(GAP_MS) as SfxName[]) howl(name)
}

// Any first gesture unlocks audio (the envelope login click is the usual one).
if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { once: true, capture: true })
  window.addEventListener('keydown', unlockAudio, { once: true, capture: true })
}

export function play(name: SfxName, opts: { volume?: number; rate?: number } = {}): void {
  if (!unlocked || muted) return
  const now = performance.now()
  if (now - (lastPlayed.get(name) ?? -Infinity) < GAP_MS[name]) return
  if ((playing.get(name) ?? 0) >= MAX_CONCURRENT) return
  lastPlayed.set(name, now)
  sfxLog.push(name)

  const h = howl(name)
  const id = h.play()
  if (opts.volume !== undefined) h.volume(opts.volume, id)
  if (opts.rate !== undefined) h.rate(opts.rate, id)
  playing.set(name, (playing.get(name) ?? 0) + 1)
  const done = () => playing.set(name, Math.max(0, (playing.get(name) ?? 1) - 1))
  h.once('end', done, id)
  h.once('stop', done, id)
}

export function isMuted(): boolean {
  return muted
}

export function setMuted(next: boolean, persist = true): void {
  muted = next
  Howler.mute(next)
  if (persist) {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0')
    } catch {
      /* storage blocked (private mode) — mute still works for this session */
    }
  }
  listeners.forEach((fn) => fn(next))
}

export function onMuteChange(fn: (muted: boolean) => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}
