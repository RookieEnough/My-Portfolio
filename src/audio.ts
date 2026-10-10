// One audio engine for the whole site.
// SFX are synthesized, unless a file in /content/sfx has the same name (key.wav, click.mp3...).
// Music = files in /content/music, or a generative lo-fi loop when that folder is empty.
import { useSyncExternalStore } from 'react'
import { sfxFiles, tracks } from './content'

let ctx: AudioContext | null = null
let master: GainNode, sfxBus: GainNode, musicBus: GainNode
let bus: Record<Channel, GainNode>
let analyser: AnalyserNode | null = null
let noise: AudioBuffer
let el: HTMLAudioElement | null = null

// music volume 0..1, kept between visits. It starts low: the site shouldn't blast anyone.
const VOLUME = 0.35
const savedVolume = (() => {
  try {
    const v = parseFloat(localStorage.getItem('volume') ?? '')
    return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : VOLUME
  } catch {
    return VOLUME
  }
})()
// ears hear loudness on a curve, so the slider is too: 35% sounds like a third, not a whisper
const gainOf = (v: number) => 0.9 * v ** 1.5

// the sound mixer: every effect plays through one of these channels, each with its own fader (0..1, kept between visits)
export type Channel = 'keys' | 'ui' | 'scroll' | 'fx'
const MIX: Record<Channel, number> = { keys: 0.7, ui: 0.7, scroll: 0.7, fx: 0.7 }
const savedMix = (() => {
  try {
    const m = JSON.parse(localStorage.getItem('mix') ?? '{}')
    return Object.fromEntries(Object.entries(MIX).map(([k, d]) => [k, Number.isFinite(m?.[k]) ? Math.min(1, Math.max(0, m[k])) : d])) as Record<Channel, number>
  } catch {
    return { ...MIX }
  }
})()
// 70% is the level the sounds were made at; the top of the fader is about 1.7x louder, the bottom silent
const mixGain = (v: number) => (v / 0.7) ** 1.5

type State = { unlocked: boolean; muted: boolean; playing: boolean; index: number; title: string; volume: number; mix: Record<Channel, number> }
let state: State = {
  unlocked: false,
  muted: false,
  playing: false,
  index: 0,
  title: tracks[0]?.title ?? 'lo-fi, generated live',
  volume: savedVolume,
  mix: savedMix,
}
const subs = new Set<() => void>()
const set = (patch: Partial<State>) => {
  state = { ...state, ...patch }
  subs.forEach((f) => f())
}
export const useAudio = () =>
  useSyncExternalStore(
    (f) => (subs.add(f), () => subs.delete(f)),
    () => state,
  )

function ensure() {
  if (ctx) return ctx
  ctx = new AudioContext()
  master = ctx.createGain()
  master.connect(ctx.destination)
  sfxBus = ctx.createGain()
  sfxBus.gain.value = 0.7
  sfxBus.connect(master)
  bus = Object.fromEntries(
    (Object.keys(MIX) as Channel[]).map((k) => {
      const g = ctx!.createGain()
      g.gain.value = mixGain(state.mix[k])
      g.connect(sfxBus)
      return [k, g]
    }),
  ) as Record<Channel, GainNode>
  analyser = ctx.createAnalyser()
  analyser.fftSize = 256
  analyser.smoothingTimeConstant = 0.8
  musicBus = ctx.createGain()
  musicBus.gain.value = gainOf(state.volume)
  musicBus.connect(analyser).connect(master)
  noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
  const d = noise.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  loadSamples(ctx)
  return ctx
}

const live = () => (ctx && state.unlocked && !state.muted ? ctx : null)
const rand = (a: number, b: number) => a + Math.random() * (b - a)

// ---------- drop-in samples: a file in /content/sfx replaces the synth of the same name ----------
const samples = new Map<string, AudioBuffer[]>()
function loadSamples(c: AudioContext) {
  for (const [name, url] of sfxFiles) {
    fetch(url)
      .then((r) => r.arrayBuffer())
      .then((b) => c.decodeAudioData(b))
      .then((buf) => samples.set(name, [...(samples.get(name) ?? []), buf]))
      .catch(() => console.warn(`[sfx] could not decode ${url}`))
  }
}
// returns false when there is no sample, so the caller falls back to the synth
function sample(c: AudioContext, out: AudioNode, name: string, rate = 1) {
  const pool = samples.get(name)
  if (!pool) return false
  const src = c.createBufferSource()
  src.buffer = pool[Math.floor(Math.random() * pool.length)]
  src.playbackRate.value = rate
  src.connect(out)
  src.start()
  return true
}

// ---------- tiny synth helpers ----------
function burst(c: AudioContext, out: AudioNode, t: number, o: { type: BiquadFilterType; f: number; q?: number; g: number; d: number; rate?: number }) {
  const src = c.createBufferSource()
  src.buffer = noise
  src.playbackRate.value = o.rate ?? 1
  const filt = c.createBiquadFilter()
  filt.type = o.type
  filt.frequency.value = o.f
  filt.Q.value = o.q ?? 1
  const g = c.createGain()
  g.gain.setValueAtTime(o.g, t)
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.d)
  src.connect(filt).connect(g).connect(out)
  src.start(t, Math.random() * 0.5, o.d + 0.02)
}
function tone(c: AudioContext, out: AudioNode, t: number, o: { type?: OscillatorType; f: number; to?: number; g: number; d: number; a?: number }) {
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.f, t)
  if (o.to) osc.frequency.exponentialRampToValueAtTime(o.to, t + o.d)
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(o.g, t + (o.a ?? 0.004))
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.d)
  osc.connect(g).connect(out)
  osc.start(t)
  osc.stop(t + o.d + 0.05)
}
const throttle = <A extends unknown[]>(ms: number, fn: (...a: A) => void) => {
  let last = 0
  return (...a: A) => {
    const n = performance.now()
    if (n - last > ms) (last = n), fn(...a)
  }
}

export const sfx = {
  // mechanical "thock": plastic click on top of a low body resonance
  key(kind: 'alpha' | 'mod' | 'space' = 'alpha') {
    const c = live()
    // key-space.wav / key-mod.wav win over key.wav; slight pitch drift so repeats don't sound looped
    if (!c || sample(c, bus.keys, 'key-' + kind) || sample(c, bus.keys, 'key', rand(0.95, 1.05))) return
    const t = c.currentTime
    const low = kind === 'space' ? 0.6 : kind === 'mod' ? 0.85 : 1
    burst(c, bus.keys, t, { type: 'bandpass', f: rand(2600, 3600) * low, q: 1.4, g: 0.55, d: 0.028 })
    tone(c, bus.keys, t, { f: rand(170, 200) * low, to: 60 * low, g: 0.5, d: kind === 'space' ? 0.14 : 0.08 })
    burst(c, bus.keys, t + 0.012, { type: 'lowpass', f: 900 * low, g: 0.25, d: 0.05 })
  },
  keyUp() {
    const c = live()
    if (!c || sample(c, bus.keys, 'keyup')) return
    burst(c, bus.keys, c.currentTime, { type: 'bandpass', f: rand(4200, 5200), q: 2, g: 0.16, d: 0.018 })
  },
  tick: throttle(40, () => {
    const c = live()
    if (!c || sample(c, bus.ui, 'tick')) return
    tone(c, bus.ui, c.currentTime, { f: 2400, g: 0.035, d: 0.03 })
  }),
  // scrolling: a soft notch now and then, like a mouse wheel's detents; a faster scroll clicks a touch higher and firmer
  scroll: throttle(55, (speed: number) => {
    const c = live()
    if (!c || sample(c, bus.scroll, 'scroll', 0.92 + speed * 0.2)) return
    burst(c, bus.scroll, c.currentTime, { type: 'bandpass', f: rand(1400, 1650) + speed * 1100, q: 3, g: 0.08 + speed * 0.05, d: 0.012 })
  }),
  click() {
    const c = live()
    if (!c || sample(c, bus.ui, 'click')) return
    tone(c, bus.ui, c.currentTime, { type: 'triangle', f: 920, to: 460, g: 0.14, d: 0.06 })
    burst(c, bus.ui, c.currentTime, { type: 'highpass', f: 3000, g: 0.08, d: 0.015 })
  },
  flap: throttle(22, () => {
    const c = live()
    if (!c || sample(c, bus.fx, 'flap', rand(0.9, 1.1))) return
    burst(c, bus.fx, c.currentTime, { type: 'highpass', f: 1800, g: 0.14, d: 0.014, rate: rand(0.8, 1.2) })
  }),
  toggle() {
    const c = live()
    if (!c || sample(c, bus.fx, 'toggle')) return
    const t = c.currentTime
    burst(c, bus.fx, t, { type: 'bandpass', f: 2200, q: 3, g: 0.4, d: 0.02 })
    burst(c, bus.fx, t + 0.045, { type: 'bandpass', f: 1500, q: 3, g: 0.3, d: 0.03 })
  },
  whoosh() {
    const c = live()
    if (!c || sample(c, bus.fx, 'whoosh')) return
    const t = c.currentTime
    const src = c.createBufferSource()
    src.buffer = noise
    const f = c.createBiquadFilter()
    f.type = 'bandpass'
    f.Q.value = 0.8
    f.frequency.setValueAtTime(250, t)
    f.frequency.exponentialRampToValueAtTime(2800, t + 0.35)
    f.frequency.exponentialRampToValueAtTime(400, t + 0.8)
    const g = c.createGain()
    g.gain.setValueAtTime(0.0001, t)
    g.gain.exponentialRampToValueAtTime(0.35, t + 0.3)
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.8)
    src.connect(f).connect(g).connect(bus.fx)
    src.start(t)
    src.stop(t + 0.85)
  },
  chime() {
    const c = live()
    if (!c || sample(c, bus.fx, 'chime')) return
    const t = c.currentTime
    tone(c, bus.fx, t, { f: 1318.5, g: 0.12, d: 0.9 })
    tone(c, bus.fx, t + 0.07, { f: 1975.5, g: 0.08, d: 1.1 })
  },
  // a drop of ink hitting water: fast upward pitch sweep, like a real "plip"
  drop: throttle(60, () => {
    const c = live()
    if (!c || sample(c, bus.fx, 'drop', rand(0.9, 1.15))) return
    const t = c.currentTime
    const f = rand(500, 750)
    tone(c, bus.fx, t, { f, to: f * 2.6, g: 0.16, d: 0.07, a: 0.002 })
    tone(c, bus.fx, t + 0.05, { f: f * 1.9, to: f * 2.4, g: 0.04, d: 0.12 })
  }),
  // CI check passing
  pass() {
    const c = live()
    if (!c || sample(c, bus.fx, 'pass')) return
    const t = c.currentTime
    tone(c, bus.fx, t, { type: 'triangle', f: 1046.5, g: 0.06, d: 0.12 })
    tone(c, bus.fx, t + 0.05, { type: 'triangle', f: 1568, g: 0.05, d: 0.18 })
  },
}

// ---------- generative lo-fi (fallback when /content/music is empty) ----------
const BPM = 74
const STEP = 60 / BPM / 4 // 16th note
const CHORDS: [number, number[]][] = [
  [41, [57, 60, 64, 67]], // Fmaj9
  [40, [55, 59, 62, 66]], // Em9
  [38, [53, 57, 60, 64]], // Dm9
  [36, [52, 55, 59, 62]], // Cmaj9
]
const PENTA = [72, 74, 76, 79, 81, 84]
const hz = (m: number) => 440 * 2 ** ((m - 69) / 12)
let gen: { timer: number; step: number; next: number; start: number; bus: GainNode; crackle: AudioBufferSourceNode } | null = null

function startGenerative(c: AudioContext) {
  const bus = c.createGain()
  const warm = c.createBiquadFilter()
  warm.type = 'lowpass'
  warm.frequency.value = 3200
  bus.gain.setValueAtTime(0.0001, c.currentTime)
  bus.gain.exponentialRampToValueAtTime(1, c.currentTime + 1.5)
  bus.connect(warm).connect(musicBus)

  // vinyl crackle
  const cb = c.createBuffer(1, c.sampleRate * 3, c.sampleRate)
  const cd = cb.getChannelData(0)
  for (let i = 0; i < cd.length; i++) cd[i] = Math.random() < 0.0009 ? rand(-0.6, 0.6) : rand(-0.012, 0.012)
  const crackle = c.createBufferSource()
  crackle.buffer = cb
  crackle.loop = true
  const cg = c.createGain()
  cg.gain.value = 0.35
  crackle.connect(cg).connect(bus)
  crackle.start()

  gen = { timer: 0, step: 0, next: c.currentTime + 0.1, start: c.currentTime, bus, crackle }
  const schedule = () => {
    if (!gen) return
    while (gen.next < c.currentTime + 0.15) {
      playStep(c, gen.step, gen.next, bus)
      gen.step++
      gen.next += STEP
    }
  }
  gen.timer = window.setInterval(schedule, 25)
}

function playStep(c: AudioContext, s: number, t: number, out: AudioNode) {
  const inBar = s % 16
  const [bass, notes] = CHORDS[Math.floor(s / 16) % 4]
  const swing = inBar % 4 === 2 ? STEP * 0.28 : 0
  t += swing
  if (inBar === 0) {
    // rhodes-ish strum
    notes.forEach((n, i) => {
      tone(c, out, t + i * 0.025, { f: hz(n), g: 0.05, d: 2.6, a: 0.02 })
      tone(c, out, t + i * 0.025, { type: 'triangle', f: hz(n) * 1.002, g: 0.018, d: 1.4, a: 0.01 })
    })
  }
  if (inBar === 0 || inBar === 10) tone(c, out, t, { f: hz(bass), g: 0.22, d: 0.9, a: 0.02 })
  if (inBar === 0 || inBar === 7 || inBar === 8) tone(c, out, t, { f: 110, to: 42, g: inBar === 7 ? 0.2 : 0.5, d: 0.3 })
  if (inBar === 4 || inBar === 12) {
    burst(c, out, t, { type: 'bandpass', f: 1700, q: 0.9, g: 0.16, d: 0.16 })
    tone(c, out, t, { f: 210, to: 160, g: 0.06, d: 0.08 })
  }
  if (inBar % 2 === 0) burst(c, out, t, { type: 'highpass', f: 7500, g: inBar % 4 === 0 ? 0.045 : 0.025, d: 0.035 })
  if (inBar % 2 === 1 && Math.random() < 0.14)
    tone(c, out, t, { f: hz(PENTA[Math.floor(Math.random() * PENTA.length)]), g: 0.03, d: 1.2, a: 0.01 })
}

function stopGenerative() {
  if (!gen || !ctx) return
  const g = gen
  gen = null
  clearInterval(g.timer)
  g.bus.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.2)
  setTimeout(() => (g.crackle.stop(), g.bus.disconnect()), 1200)
}

// ---------- public controls ----------
function loadTrack(i: number) {
  const c = ensure()
  if (!el) {
    el = new Audio()
    el.preload = 'auto'
    el.onended = () => music.next()
    c.createMediaElementSource(el).connect(musicBus)
  }
  el.src = tracks[i].url
  set({ index: i, title: tracks[i].title })
}

export const music = {
  play() {
    const c = ensure()
    c.resume()
    if (tracks.length) {
      if (!el) loadTrack(state.index)
      el!.play().catch(() => set({ playing: false }))
    } else if (!gen) startGenerative(c)
    set({ playing: true })
  },
  pause() {
    el?.pause()
    stopGenerative()
    set({ playing: false })
  },
  toggle() {
    if (state.playing) music.pause()
    else {
      if (state.muted) audio.setMuted(false)
      music.play()
    }
  },
  next() {
    music.skip(1)
  },
  prev() {
    // like a CD player: restart the track, or go back if we're at the start
    if (el && el.currentTime > 3) el.currentTime = 0
    else music.skip(-1)
  },
  skip(d: number) {
    if (!tracks.length) return
    loadTrack((state.index + d + tracks.length) % tracks.length)
    if (state.playing) el!.play().catch(() => {})
  },
  // seconds into the current track (or the live loop)
  time() {
    if (el) return el.currentTime
    return gen && ctx ? ctx.currentTime - gen.start : 0
  },
  setVolume(v: number) {
    v = Math.min(1, Math.max(0, v))
    set({ volume: v })
    try {
      localStorage.setItem('volume', v.toFixed(2))
    } catch {
      // private mode: the level just won't be remembered
    }
    if (ctx) musicBus.gain.setTargetAtTime(gainOf(v), ctx.currentTime, 0.03)
  },
}

export const audio = {
  // Opening the audio device costs 30 to 100 ms on the main thread, so the gate does it on the press of a button
  // (already a user gesture) instead of in the click that starts the opening transition; a frame later, so the
  // button is drawn pressed first
  warm() {
    if (!ctx) requestAnimationFrame(() => setTimeout(ensure))
  },
  // must be called from a user gesture (browser autoplay rules)
  unlock(withSound: boolean) {
    const c = ensure()
    c.resume()
    set({ unlocked: true, muted: !withSound })
    master.gain.value = withSound ? 1 : 0
    if (withSound) music.play()
  },
  setMuted(m: boolean) {
    if (!ctx) ensure()
    set({ unlocked: true, muted: m })
    master.gain.setTargetAtTime(m ? 0 : 1, ctx!.currentTime, 0.05)
    if (m) music.pause()
    else if (!state.playing) music.play()
  },
  // one mixer fader; it plays a sample of the channel so the visitor hears where it sits
  setLevel(ch: Channel, v: number) {
    mixTo({ ...state.mix, [ch]: Math.min(1, Math.max(0, v)) })
    preview[ch]()
  },
  // every fader back to where the sounds were made, music to its starting level
  resetMix() {
    mixTo({ ...MIX })
    music.setVolume(VOLUME)
  },
  get analyser() {
    return analyser
  },
}
function mixTo(mix: Record<Channel, number>) {
  set({ mix })
  try {
    localStorage.setItem('mix', JSON.stringify(mix))
  } catch {
    // private mode: the mix just won't be remembered
  }
  if (ctx) for (const k of Object.keys(mix) as Channel[]) bus[k].gain.setTargetAtTime(mixGain(mix[k]), ctx.currentTime, 0.02)
}
const preview: Record<Channel, () => void> = {
  keys: throttle(90, () => sfx.key()),
  ui: throttle(90, () => sfx.click()),
  scroll: throttle(60, () => sfx.scroll(0.4)),
  fx: throttle(140, () => sfx.drop()),
}
