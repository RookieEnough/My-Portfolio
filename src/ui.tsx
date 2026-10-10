import { Fragment, Suspense, lazy, useEffect, useLayoutEffect, useMemo, useRef, useState, type ChangeEvent, type CSSProperties, type PointerEvent as RPointerEvent } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { audio, music, sfx, useAudio, type Channel } from './audio'
import { tracks } from './content'
import type { Tilt } from './Disc'
import { Next, Pause, Play, Speaker } from './icons'

gsap.registerPlugin(ScrollTrigger)

export const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
export const coarse = matchMedia('(pointer: coarse)').matches
export const webgl = (() => {
  try {
    return !!document.createElement('canvas').getContext('webgl2')
  } catch {
    return false
  }
})()

// ---------- cursor: lagging ring + exact crosshair ----------
export function Cursor() {
  const root = useRef<HTMLDivElement>(null)
  const ring = useRef<HTMLDivElement>(null)
  const cross = useRef<HTMLDivElement>(null)
  const [label, setLabel] = useState('')
  const [hover, setHover] = useState(false)
  const [down, setDown] = useState(false)
  const [out, setOut] = useState(true)
  const [fine] = useState(() => matchMedia('(pointer: fine)').matches)

  useEffect(() => {
    if (!fine) return
    document.documentElement.classList.add('has-cursor')
    let x = -100, y = -100, rx = x, ry = y, raf = 0
    // the ring eases after the crosshair, then the loop sleeps until the mouse moves again
    const tick = () => {
      rx += (x - rx) * 0.18
      ry += (y - ry) * 0.18
      const done = Math.abs(x - rx) < 0.1 && Math.abs(y - ry) < 0.1
      if (done) (rx = x), (ry = y)
      cross.current!.style.transform = `translate3d(${x}px,${y}px,0)`
      ring.current!.style.transform = `translate3d(${rx}px,${ry}px,0)`
      raf = done ? 0 : requestAnimationFrame(tick)
    }
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      setOut(false)
      if (!raf) raf = requestAnimationFrame(tick)
    }
    const over = (e: PointerEvent) => {
      const el = (e.target as Element).closest?.('[data-cursor], a, button')
      setHover(!!el)
      setLabel(el?.getAttribute('data-cursor') ?? '')
    }
    const d = () => setDown(true)
    // a click can change what's under the pointer (play ↔ pause), so read the label again once it renders
    const u = (e: PointerEvent) => {
      setDown(false)
      requestAnimationFrame(() => over(e))
    }
    const leave = () => setOut(true)
    tick()
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerover', over)
    window.addEventListener('pointerdown', d)
    window.addEventListener('pointerup', u)
    document.documentElement.addEventListener('pointerleave', leave)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerover', over)
      window.removeEventListener('pointerdown', d)
      window.removeEventListener('pointerup', u)
      document.documentElement.removeEventListener('pointerleave', leave)
    }
  }, [fine])

  if (!fine) return null
  const cls = ['cursor', label && 'is-label', hover && !label && 'is-hover', down && 'is-down', out && 'is-out'].filter(Boolean).join(' ')
  return (
    <div ref={root} className={cls} aria-hidden>
      <div ref={ring} className="cursor-ring" style={{ position: 'absolute' }}>
        <span>{label}</span>
      </div>
      <div ref={cross} className="cursor-cross" />
    </div>
  )
}

// ---------- music player: a 90s Discman with a real 3D disc ----------
// Folded away it is only the disc, parked on an edge of the screen. Drag it anywhere and it snaps
// to the nearest side. A tap slides the player out of the disc; left alone, it tucks back in.
const Disc = lazy(() => import('./Disc'))
const mmss = (t: number) => `${String(Math.floor(t / 60) % 100).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`
const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

type Edge = 'left' | 'right' | 'top' | 'bottom'
// t runs 0..1 along the edge (top to bottom, left to right), so the spot survives a resize
type Spot = { edge: Edge; t: number }
const HOME: Spot = { edge: 'left', t: 1 } // the bottom-left corner
const IDLE = 10_000 // ms before an untouched player folds back into the disc
const PAD = 40 // room the clip leaves around the panel for its shadow

function savedSpot(): Spot {
  try {
    const s = JSON.parse(localStorage.getItem('deck') ?? 'null')
    if (['left', 'right', 'top', 'bottom'].includes(s?.edge) && s.t >= 0 && s.t <= 1) return s
  } catch {
    // nothing saved, or private mode
  }
  return HOME
}

// where the disc may park: inside the screen margins and below the nav. The disc lies tilted in its
// square box, so the box may hang a fifth past the top and bottom while the disc itself stays clear.
function bounds(d: number) {
  const m = innerWidth >= 768 ? 20 : 12
  const lie = d * 0.2
  // layout box, not the painted one: the nav slides in when the site opens and must not shift the spot
  const el = document.querySelector<HTMLElement>('.nav')
  const nav = el ? el.offsetTop + el.offsetHeight : 0
  return { m, nav, d, x0: m, x1: innerWidth - m - d, y0: nav + m - lie, y1: innerHeight - m - d + lie }
}
type Bounds = ReturnType<typeof bounds>
const spotAt = ({ edge, t }: Spot, b: Bounds) =>
  edge === 'left' || edge === 'right'
    ? { x: edge === 'left' ? b.x0 : b.x1, y: b.y0 + t * (b.y1 - b.y0) }
    : { x: b.x0 + t * (b.x1 - b.x0), y: edge === 'top' ? b.y0 : b.y1 }
function nearestSpot(x: number, y: number, b: Bounds): Spot {
  const gap = { left: x - b.x0, right: b.x1 - x, top: y - b.y0, bottom: b.y1 - y }
  const edge = (Object.keys(gap) as Edge[]).reduce((a, k) => (gap[k] < gap[a] ? k : a))
  const along = edge === 'left' || edge === 'right' ? (y - b.y0) / (b.y1 - b.y0) : (x - b.x0) / (b.x1 - b.x0)
  return { edge, t: clamp(along || 0, 0, 1) }
}

// Mounted with the page but `shown` only once the site opens: until then it waits off its edge, already drawn, so the
// 3D disc's first frame (shader compile, environment map, label texture) is paid behind the gate and not mid-transition
export function MusicPlayer({ shown }: { shown: boolean }) {
  const a = useAudio()
  const cover = tracks[a.index]?.cover
  const root = useRef<HTMLDivElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const discBtn = useRef<HTMLButtonElement>(null)
  const bars = useRef<HTMLSpanElement>(null)
  const clock = useRef<HTMLSpanElement>(null)
  const tilt = useRef<Tilt>({ x: 0, y: 0, wake: () => {}, kick: () => {} })
  const [open, setOpen] = useState(false)
  // which way the panel slides out: towards the middle of the screen
  const [side, setSide] = useState<'l' | 'r'>('r')
  const [volFlash, setVolFlash] = useState(false)
  const s = useRef({
    spot: HOME,
    open: false,
    side: 'r' as 'l' | 'r',
    hover: false,
    keyFocus: false,
    idle: 0,
    flash: 0,
    tl: null as gsap.core.Timeline | null,
    // the panel's clip, in px from each side, tweened as numbers and written out as inset()
    clip: { t: 0, r: 0, b: 0, l: 0, k: 0 },
    clipped: false,
    shown,
    // the parked position, kept so sliding in at the opening click reads no layout
    at: { x: 0, y: 0 },
    drag: null as null | { id: number; px: number; py: number; x: number; y: number; b: Bounds; moved: boolean; lx: number; ly: number; lt: number; vx: number; vy: number },
  }).current

  // ----- placement -----
  const fitPanel = (y: number, b: Bounds) => {
    // centred on the disc, nudged to stay on screen and clear of the nav
    const pn = panel.current!
    const ph = pn.offsetHeight
    const top = clamp(y + b.d / 2 - ph / 2, b.nav + b.m, innerHeight - b.m - ph)
    pn.style.top = `${top - y}px`
  }
  const park = (animate: boolean) => {
    const el = root.current!
    const b = bounds(el.offsetWidth)
    const p = (s.at = spotAt(s.spot, b))
    s.side = s.spot.edge === 'left' ? 'r' : s.spot.edge === 'right' ? 'l' : p.x + b.d / 2 < innerWidth / 2 ? 'r' : 'l'
    setSide(s.side)
    if (animate && !reduced) gsap.to(el, { x: p.x, y: p.y, duration: 0.75, ease: 'back.out(1.4)', overwrite: true })
    else gsap.set(el, { x: p.x, y: p.y, overwrite: true })
    fitPanel(p.y, b)
  }

  // just past its edge, where it waits for the site to open
  const away = () => {
    const el = root.current!
    if (reduced) return void gsap.set(el, { autoAlpha: 0 })
    gsap.set(el, { left: { x: -el.offsetWidth * 1.3 }, right: { x: innerWidth + 20 }, top: { y: -el.offsetWidth * 1.3 }, bottom: { y: innerHeight + 20 } }[s.spot.edge])
  }

  useLayoutEffect(() => {
    s.spot = savedSpot()
    park(false)
    if (!s.shown) away()
    const resize = () => {
      if (s.drag?.moved) return
      park(false)
      if (!s.shown) away()
    }
    addEventListener('resize', resize)
    return () => removeEventListener('resize', resize)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // the disc slides in from its edge when the site opens
  useEffect(() => {
    if (!shown || s.shown) return
    s.shown = true
    const el = root.current!
    if (reduced) return void gsap.set(el, { autoAlpha: 1 })
    gsap.to(el, { x: s.at.x, y: s.at.y, duration: 1.1, ease: 'expo.out', delay: 0.25, overwrite: true })
  }, [shown, s])

  // ----- the panel sliding out of the disc and back in -----
  const paintClip = () => {
    const c = s.clip
    panel.current!.style.clipPath = `inset(${c.t}px ${c.r}px ${c.b}px ${c.l}px round ${c.k}px)`
  }
  // Tucked = slid in under the middle of the disc and pinched to a capsule the disc fully hides.
  // (Not a sliver at the disc's rim: the disc lies tilted, so its rim is thin and a sliver there shows.)
  const tucked = () => {
    const pn = panel.current!
    const d = root.current!.offsetWidth
    const pw = pn.offsetWidth
    const ph = pn.offsetHeight
    const r = s.side === 'r'
    const ov = r ? d - pn.offsetLeft : pn.offsetLeft + pw
    const cy = clamp(d / 2 - pn.offsetTop, 0, ph) // the disc's centre line, in panel px
    const hh = d * 0.15
    const t = Math.max(0, cy - hh)
    const b = Math.max(0, ph - cy - hh)
    return {
      x: (r ? -1 : 1) * (d / 2 - ov),
      origin: `${r ? 0 : 100}% ${cy}px`,
      clip: r ? { t, r: pw, b, l: 0, k: hh } : { t, r: 0, b, l: pw, k: hh },
    }
  }
  // open = the whole panel plus room for its shadow
  const OPEN_CLIP = { t: -PAD, r: -PAD, b: -PAD, l: -PAD, k: PAD }

  const slideOut = () => {
    const pn = panel.current!
    const kids = pn.children
    const dir = s.side === 'r' ? 1 : -1
    s.tl?.kill()
    fitPanel(gsap.getProperty(root.current!, 'y') as number, bounds(root.current!.offsetWidth))
    if (reduced) {
      s.tl = gsap.timeline().set(pn, { visibility: 'visible', clipPath: 'none', x: 0, scaleY: 1 }).set(kids, { opacity: 1, x: 0 }).fromTo(pn, { opacity: 0 }, { opacity: 1, duration: 0.2 })
      return
    }
    const fresh = getComputedStyle(pn).visibility === 'hidden'
    const tl = gsap.timeline()
    if (fresh) {
      const k = tucked()
      Object.assign(s.clip, k.clip)
      tl.set(pn, { visibility: 'visible', opacity: 0, x: k.x, scaleY: 0.86, transformOrigin: k.origin }).set(kids, { opacity: 0, x: -dir * 12 })
    }
    s.clipped = true
    paintClip()
    // squeezed out of the disc like ink from a pen: the edge races out, the body swells and settles with a wobble
    tl.to(pn, { opacity: 1, duration: 0.12, ease: 'none' }, 0)
      .to(s.clip, { ...OPEN_CLIP, duration: 0.75, ease: 'expo.out', onUpdate: paintClip }, 0)
      .to(pn, { x: 0, duration: 1, ease: 'elastic.out(1, 0.75)' }, 0)
      .to(pn, { scaleY: 1, duration: 1, ease: 'elastic.out(1.15, 0.45)' }, 0)
      .to(kids, { opacity: 1, x: 0, duration: 0.5, stagger: 0.06, ease: 'power3.out' }, fresh ? 0.16 : 0)
      .add(() => {
        // fully out: drop the clip so the panel gets its own rounded corners and shadow back
        s.clipped = false
        pn.style.clipPath = ''
      })
    s.tl = tl
    tilt.current.kick(6)
  }
  const slideIn = (fast: boolean) => {
    const pn = panel.current!
    const kids = pn.children
    const dir = s.side === 'r' ? 1 : -1
    s.tl?.kill()
    if (reduced) {
      s.tl = gsap.timeline().to(pn, { opacity: 0, duration: 0.15 }).set(pn, { visibility: 'hidden' })
      return
    }
    if (!s.clipped) {
      Object.assign(s.clip, OPEN_CLIP)
      s.clipped = true
      paintClip()
    }
    const k = tucked()
    const d = fast ? 0.24 : 0.56
    const ease = fast ? 'power3.in' : 'power2.inOut'
    // drawn back in, contents and all: it retracts into the disc's centre while it's pulled down onto
    // the disc's line, only fades once it is under the disc, and the disc swallows it
    s.tl = gsap
      .timeline({
        onComplete: () => {
          gsap.set(pn, { visibility: 'hidden' })
          if (fast) return
          tilt.current.kick(3)
          gsap.fromTo(discBtn.current, { scale: 1.06 }, { scale: 1, duration: 0.6, ease: 'elastic.out(1, 0.45)' })
        },
      })
      .set(pn, { transformOrigin: k.origin })
      .to(s.clip, { ...k.clip, duration: d, ease, onUpdate: paintClip }, 0)
      .to(pn, { x: k.x, scaleY: fast ? 0.86 : 0.6, duration: d, ease }, 0)
      .to(kids, { opacity: 0, x: -dir * 10, duration: d * 0.45, ease: 'power1.in' }, d * 0.3)
      .to(pn, { opacity: 0, duration: d * 0.3, ease: 'power1.in' }, d * 0.7)
  }

  // ----- open / close and the 10 s fold-away -----
  const arm = () => {
    clearTimeout(s.idle)
    if (s.open && !s.hover && !s.keyFocus) s.idle = window.setTimeout(() => fold(false), IDLE)
  }
  const unfold = () => {
    if (s.open) return
    s.open = true
    setOpen(true)
    slideOut()
    arm()
  }
  const fold = (fast: boolean) => {
    if (!s.open) return
    s.open = false
    setOpen(false)
    clearTimeout(s.idle)
    const f = document.activeElement
    if (f instanceof HTMLElement && panel.current!.contains(f)) f.blur()
    slideIn(fast)
  }
  const toggle = () => (s.open ? fold(false) : unfold())

  // a tap anywhere else, or Esc, folds it away early
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !root.current!.contains(e.target as Node) && fold(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      const inside = root.current!.contains(document.activeElement)
      fold(false)
      if (inside) discBtn.current!.focus()
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', esc)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => () => void (clearTimeout(s.idle), clearTimeout(s.flash), s.tl?.kill()), [s])

  // ----- LCD: spectrum bars and clock, only while the panel is out -----
  useEffect(() => {
    if (!open) return
    let raf = 0
    let data: Uint8Array<ArrayBuffer> | null = null
    let shown = ''
    const BINS = [2, 4, 7, 11, 16]
    const level = new Uint8Array(BINS.length).fill(255)
    const draw = () => {
      const an = audio.analyser
      const el = bars.current
      if (an && el) {
        data ??= new Uint8Array(an.frequencyBinCount)
        if (a.playing) an.getByteFrequencyData(data)
        else data.fill(0)
        // only touch the DOM when a bar actually moves
        BINS.forEach((b, i) => {
          if (data![b] === level[i]) return
          level[i] = data![b]
          ;(el.children[i] as HTMLElement).style.transform = `scaleY(${0.12 + (data![b] / 255) * 0.88})`
        })
      }
      const t = mmss(music.time())
      if (t !== shown && clock.current) clock.current.textContent = shown = t
      if (a.playing) raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [open, a.playing, a.index])

  // ----- the disc: tap to open, drag to move -----
  const lean = (e: RPointerEvent<HTMLButtonElement>) => {
    if (reduced || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const t = tilt.current
    t.x = (e.clientX - r.left) / r.width - 0.5
    t.y = (e.clientY - r.top) / r.height - 0.5
    t.wake()
  }
  const unlean = () => {
    const t = tilt.current
    t.x = t.y = 0
    t.wake()
  }
  const down = (e: RPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const el = root.current!
    gsap.killTweensOf(el) // catch it mid-snap
    const x = gsap.getProperty(el, 'x') as number
    const y = gsap.getProperty(el, 'y') as number
    s.drag = { id: e.pointerId, px: e.clientX, py: e.clientY, x, y, b: bounds(el.offsetWidth), moved: false, lx: e.clientX, ly: e.clientY, lt: e.timeStamp, vx: 0, vy: 0 }
    el.classList.add('held')
  }
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    const g = s.drag
    if (!g || g.id !== e.pointerId) return lean(e)
    const dx = e.clientX - g.px
    const dy = e.clientY - g.py
    if (!g.moved) {
      if (Math.hypot(dx, dy) < 6) return
      g.moved = true
      root.current!.classList.add('dragging')
      fold(true)
    }
    const { b } = g
    gsap.set(root.current!, { x: clamp(g.x + dx, 0, innerWidth - b.d), y: clamp(g.y + dy, b.nav - b.d * 0.2, innerHeight - b.d * 0.8) })
    // the disc tips the way it's thrown
    const dt = Math.max(1, e.timeStamp - g.lt)
    g.vx += ((e.clientX - g.lx) / dt - g.vx) * 0.35
    g.vy += ((e.clientY - g.ly) / dt - g.vy) * 0.35
    g.lx = e.clientX
    g.ly = e.clientY
    g.lt = e.timeStamp
    if (reduced) return
    const t = tilt.current
    t.x = clamp(g.vx * 0.45, -0.9, 0.9)
    t.y = clamp(g.vy * 0.45, -0.9, 0.9)
    t.wake()
  }
  const up = (e: RPointerEvent<HTMLButtonElement>) => {
    const g = s.drag
    if (!g || g.id !== e.pointerId) return
    s.drag = null
    root.current!.classList.remove('held', 'dragging')
    if (!g.moved) {
      if (e.type === 'pointerup') toggle()
      return
    }
    const el = root.current!
    s.spot = nearestSpot(gsap.getProperty(el, 'x') as number, gsap.getProperty(el, 'y') as number, bounds(el.offsetWidth))
    try {
      localStorage.setItem('deck', JSON.stringify(s.spot))
    } catch {
      // private mode: it just won't remember
    }
    park(true)
    unlean()
    tilt.current.kick(4)
    sfx.toggle()
  }

  const onVolume = (e: ChangeEvent<HTMLInputElement>) => {
    music.setVolume(+e.target.value / 100)
    // the LCD shows the level while it changes, like the real thing
    setVolFlash(true)
    clearTimeout(s.flash)
    s.flash = window.setTimeout(() => setVolFlash(false), 1400)
  }

  const long = a.title.length > 17
  const vol = Math.round(a.volume * 100)

  return (
    <div
      ref={root}
      className="deck"
      data-side={side}
      inert={!shown}
      // floats over the keyboard: keys under it (or under a disc being dragged) don't hover
      data-solid
      onPointerEnter={() => ((s.hover = true), clearTimeout(s.idle))}
      onPointerLeave={() => ((s.hover = false), arm())}
      // a mouse click leaves focus on a button too; only keyboard focus holds the player open
      onFocus={(e) => (e.target as Element).matches(':focus-visible') && ((s.keyFocus = true), clearTimeout(s.idle))}
      onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && ((s.keyFocus = false), arm())}
      onKeyDown={arm}
    >
      <button
        ref={discBtn}
        type="button"
        className="deck-disc"
        aria-expanded={open}
        aria-controls="deck-panel"
        aria-label={open ? 'Fold the music player away' : 'Open the music player'}
        data-cursor={open ? 'close' : 'open'}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onLostPointerCapture={up}
        onPointerLeave={unlean}
        // Enter / Space; pointer taps are handled in `up` so a drag never counts as a click
        onClick={(e) => e.detail === 0 && toggle()}
      >
        {webgl ? (
          <Suspense fallback={<span className="disc-flat" />}>
            <Disc playing={a.playing} title={a.title} cover={cover} tilt={tilt} />
          </Suspense>
        ) : (
          <span
            className={'disc-flat' + (a.playing ? ' spinning' : '') + (cover ? ' has-cover' : '')}
            style={cover ? ({ '--cover': `url("${cover}")` } as CSSProperties) : undefined}
          />
        )}
      </button>
      <div ref={panel} id="deck-panel" className="deck-body" role="group" aria-label="Music player" inert={!open}>
        <div className="lcd" aria-live="off">
          <div className="flex items-center justify-between gap-2 whitespace-nowrap md:gap-3">
            <span>{a.playing ? '▶ PLAY' : 'Ⅱ PAUSE'}</span>
            <span>
              TR <b>{String(a.index + 1).padStart(2, '0')}</b>
            </span>
            <span className="lcd-num" data-ghost="88:88">
              <span ref={clock}>00:00</span>
            </span>
          </div>
          {volFlash ? (
            <div className="lcd-title lcd-vol" aria-hidden>
              VOL
              <span className="seg">
                {Array.from({ length: 10 }, (_, i) => (
                  <i key={i} className={i < Math.ceil(vol / 10) ? 'on' : undefined} />
                ))}
              </span>
              <b>{vol}</b>
            </div>
          ) : (
            <div className="lcd-title" title={a.title}>
              <span className={long && a.playing ? 'scroll' : undefined}>
                {a.title}
                {long && <span aria-hidden>{'   ·   ' + a.title + '   ·   '}</span>}
              </span>
            </div>
          )}
        </div>
        <div className="mt-1.5 flex items-center gap-1.5 md:mt-2">
          {tracks.length > 1 && (
            <button onClick={music.prev} className="deck-btn" aria-label="Previous track" data-cursor="prev">
              <Next className="rotate-180" />
            </button>
          )}
          <button onClick={music.toggle} className="deck-btn primary" aria-label={a.playing ? 'Pause music' : 'Play music'} data-cursor={a.playing ? 'pause' : 'play'}>
            {a.playing ? <Pause /> : <Play />}
          </button>
          {tracks.length > 1 && (
            <button onClick={music.next} className="deck-btn" aria-label="Next track" data-cursor="next">
              <Next />
            </button>
          )}
          <span ref={bars} className="bars ml-auto" aria-hidden>
            <i /><i /><i /><i /><i />
          </span>
        </div>
        <label className="deck-vol">
          <span aria-hidden>VOL</span>
          <input
            type="range"
            min={0}
            max={100}
            value={vol}
            onChange={onVolume}
            aria-label="Music volume"
            aria-valuetext={`${vol}%`}
            data-cursor="volume"
            style={{ '--v': `${vol}%` } as CSSProperties}
          />
        </label>
      </div>
    </div>
  )
}

// ---------- sound mixer: the nav's speaker opens a little desk, one fader per kind of sound ----------
const FADERS: { id: Channel | 'music'; name: string; hint: string }[] = [
  { id: 'keys', name: 'Keys', hint: 'the 3D keyboard' },
  { id: 'ui', name: 'Clicks', hint: 'buttons and links' },
  { id: 'scroll', name: 'Scroll', hint: 'notches as the page moves' },
  { id: 'fx', name: 'FX', hint: 'flaps, ink, CI checks, chimes' },
  { id: 'music', name: 'Music', hint: 'the Discman' },
]
const setFader = (id: Channel | 'music', v: number) => (id === 'music' ? music.setVolume(v) : audio.setLevel(id, v))

// Follows the audio state on its own, so a fader drag re-renders this and not the whole page
// (the 3D keyboard with it, which re-shot its shadow and lighting on every change)
export function Mixer() {
  const a = useAudio()
  const [open, setOpen] = useState(false)
  const [hint, setHint] = useState(-1)
  const root = useRef<HTMLDivElement>(null)
  const btn = useRef<HTMLButtonElement>(null)
  const panel = useRef<HTMLDivElement>(null)
  const s = useRef({ tl: null as gsap.core.Timeline | null, glide: 0 }).current

  // a tap anywhere else, or Esc, closes it
  useEffect(() => {
    if (!open) return
    const outside = (e: PointerEvent) => !root.current!.contains(e.target as Node) && setOpen(false)
    const esc = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (root.current!.contains(document.activeElement)) btn.current!.focus()
      setOpen(false)
    }
    document.addEventListener('pointerdown', outside, true)
    document.addEventListener('keydown', esc)
    return () => {
      document.removeEventListener('pointerdown', outside, true)
      document.removeEventListener('keydown', esc)
    }
  }, [open])
  useEffect(() => () => void (s.tl?.kill(), clearTimeout(s.glide)), [s])

  // it drops out of the button, then the faders run up to their levels, like a motorised desk recalling a mix
  useLayoutEffect(() => {
    const pn = panel.current!
    s.tl?.kill()
    if (reduced) return void gsap.set(pn, { autoAlpha: open ? 1 : 0 })
    s.tl = open
      ? gsap
          .timeline()
          .fromTo(pn, { autoAlpha: 0, y: -10, scale: 0.97 }, { autoAlpha: 1, y: 0, scale: 1, duration: 0.45, ease: 'expo.out' })
          .fromTo(pn.querySelectorAll('.fader'), { '--k': 0 }, { '--k': 1, duration: 0.8, ease: 'expo.out', stagger: 0.05 }, 0.08)
      : gsap.timeline().to(pn, { autoAlpha: 0, y: -6, scale: 0.98, duration: 0.18, ease: 'power2.in' })
  }, [open, s])

  // reset: the caps glide home instead of jumping
  const reset = () => {
    const pn = panel.current!
    pn.classList.add('glide')
    audio.resetMix()
    clearTimeout(s.glide)
    s.glide = window.setTimeout(() => pn.classList.remove('glide'), 600)
  }

  const shown = hint >= 0 ? FADERS[hint] : null
  return (
    <div ref={root} className="relative">
      <button
        ref={btn}
        onClick={() => setOpen((o) => !o)}
        className="grid size-10 place-items-center rounded-full border border-line bg-bg/60 backdrop-blur transition-colors aria-expanded:border-red aria-expanded:text-red"
        aria-label={a.muted ? 'Sound settings (sound is off)' : 'Sound settings'}
        aria-expanded={open}
        aria-controls="mixer"
        data-cursor={open ? 'close' : 'mixer'}
      >
        <Speaker off={a.muted} />
      </button>
      <div ref={panel} id="mixer" className="mixer" role="group" aria-label="Sound mixer" inert={!open} data-muted={a.muted || undefined} data-solid>
        <div className="mix-head">
          <span className="mix-title">
            Mixer <span className="jp">音</span>
          </span>
          <button role="switch" aria-checked={!a.muted} aria-label="Sound" onClick={() => audio.setMuted(!a.muted)} className="mix-switch" data-cursor={a.muted ? 'sound on' : 'mute'}>
            {a.muted ? 'Off' : 'On'}
            <i aria-hidden />
          </button>
        </div>
        {/* grabbing a fader while the caps still run up finishes the run, so the cap is where the finger is */}
        <div className="mix-desk" onPointerDown={() => s.tl?.progress(1)}>
          {FADERS.map((f, i) => {
            const v = Math.round((f.id === 'music' ? a.volume : a.mix[f.id]) * 100)
            return (
              <label key={f.id} className="fader" style={{ '--v': v / 100 } as CSSProperties} onPointerEnter={() => setHint(i)} onPointerLeave={() => setHint(-1)}>
                <span className="lcd mix-val" aria-hidden>
                  <span className="lcd-num" data-ghost="888">
                    <span>{String(v).padStart(3, ' ')}</span>
                  </span>
                </span>
                <span className="fader-slot">
                  <i className="fader-fill" />
                  <i className="fader-cap" />
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={v}
                    onChange={(e) => setFader(f.id, +e.target.value / 100)}
                    onFocus={() => setHint(i)}
                    onBlur={() => setHint(-1)}
                    aria-label={`${f.name} volume`}
                    aria-valuetext={`${v}%`}
                    data-cursor={f.name.toLowerCase()}
                  />
                </span>
                <span className="fader-name">{f.name}</span>
              </label>
            )
          })}
        </div>
        <div className="mix-foot">
          <span>{shown ? `${shown.name}: ${shown.hint}` : a.muted ? 'Sound is off' : 'Drag a fader to hear it'}</span>
          <button onClick={reset} data-cursor="reset">
            Reset
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------- split-flap display ----------
// `from` makes a freshly mounted flap flip in from that character; `delay` (s) staggers a row of them
export function Flap({ c, from, delay = 0 }: { c: string; from?: string; delay?: number }) {
  const [s, setS] = useState(() => ({ cur: from ?? c, prev: from ?? c, n: 0 }))
  if (s.cur !== c) setS({ cur: c, prev: s.cur, n: s.n + 1 })
  const narrow = !/[0-9A-Za-z]/.test(c)
  return (
    <span className="flap" style={{ width: narrow ? '0.3em' : undefined, '--d': `${delay}s` } as CSSProperties}>
      <span className="half top"><b>{s.cur}</b></span>
      <span className="half bottom"><b>{s.prev}</b></span>
      {s.n > 0 && (
        <>
          <span key={'t' + s.n} className="half top flip"><b>{s.prev}</b></span>
          <span key={'b' + s.n} className="half bottom flip"><b>{s.cur}</b></span>
        </>
      )}
    </span>
  )
}

export function SplitFlap({ value, className = '' }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const target = value.split('')
  const [shown, setShown] = useState(() => target.map((c) => (/\d/.test(c) ? '0' : c)))
  useEffect(() => {
    if (reduced) return setShown(target)
    let timer = 0
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return
      io.disconnect()
      let tick = 0
      timer = window.setInterval(() => {
        tick++
        let done = true
        setShown(
          target.map((c, i) => {
            if (!/\d/.test(c) || tick >= 5 + i * 2) return c
            done = false
            return String(Math.floor(Math.random() * 10))
          }),
        )
        sfx.flap()
        if (done) clearInterval(timer)
      }, 70)
    }, { threshold: 0.6 })
    io.observe(ref.current!)
    return () => (io.disconnect(), clearInterval(timer))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])
  return (
    <span ref={ref} className={className}>
      <span className="sr-only">{value}</span>
      <span aria-hidden className="inline-flex">
        {shown.map((c, i) => (
          <Flap key={i} c={c} />
        ))}
      </span>
    </span>
  )
}

// ---------- masked word reveal; wrap a word in *stars* to ink it red ----------
type RevealTag = 'h2' | 'h3' | 'p'
// `cue` moves the reveal to another scroll point and hides the words again on the way back up
// (the toolkit title waits for the flying keyboard to land instead of sitting under it)
export type Cue = { trigger: string; start: string }
export function Reveal({ text, as = 'h2', className = '', cue }: { text: string; as?: RevealTag; className?: string; cue?: Cue }) {
  const ref = useRef<HTMLHeadingElement>(null)
  const Tag = as as 'h2'
  const [cueAt, cueStart] = [cue?.trigger, cue?.start]
  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      gsap.from(ref.current!.querySelectorAll('.w > span'), {
        // far enough down that a long word's tilted corner can't peek over the mask while it waits
        yPercent: 150,
        rotate: 5,
        duration: 1,
        ease: 'power4.out',
        stagger: 0.05,
        scrollTrigger: cueAt ? { trigger: cueAt, start: cueStart, toggleActions: 'play none none reverse' } : { trigger: ref.current, start: 'top 86%', once: true },
      })
    })
    return () => ctx.revert()
  }, [cueAt, cueStart])
  return (
    <Tag ref={ref} className={'words ' + className}>
      <span className="sr-only">{text.replaceAll('*', '')}</span>
      <span aria-hidden>
        {text.split(' ').map((w, i) => (
          <Fragment key={i}>
            <span className="w">
              <span className={w.includes('*') ? 'text-red' : undefined}>{w.replaceAll('*', '')}</span>
            </span>{' '}
          </Fragment>
        ))}
      </span>
    </Tag>
  )
}

// ---------- text that streams in like a model response ----------
// Every word is laid out from the first frame (so the height never changes) and eases in on its own CSS clock:
// up, out of a blur, overlapping the next. A paced schedule, not random gaps, with a breath after punctuation.
// The caret glides to the end of each word as it lands; nothing here re-renders while it streams.
const LEAD = 0.7 // s of blinking caret before the first word, like a model thinking
export function Stream({ text, start, className = '' }: { text: string; start: boolean; className?: string }) {
  const words = useMemo(() => {
    let t = LEAD
    return (text.match(/\S+\s*/g) ?? []).map((w) => {
      const word = w.trimEnd()
      const at = t
      t += 0.028 + word.length * 0.01 + (/[.,:;!?]$/.test(word) ? 0.22 : 0)
      return { word, space: w.slice(word.length), at }
    })
  }, [text])
  const box = useRef<HTMLSpanElement>(null)
  const caret = useRef<HTMLSpanElement>(null)
  useEffect(() => {
    const b = box.current
    const c = caret.current
    if (!start || reduced || !b || !c) return
    const els = b.querySelectorAll<HTMLElement>('.w')
    let line = NaN
    const to = (w: HTMLElement, end: boolean) => {
      const y = w.offsetTop + (w.offsetHeight - c.offsetHeight) / 2
      const x = w.offsetLeft + (end ? w.offsetWidth + c.offsetWidth * 0.3 : 0)
      c.style.transition = y === line ? '' : 'none' // a new line jumps there; it doesn't sweep back across the text
      c.style.transform = `translate3d(${x}px,${y}px,0)`
      line = y
    }
    if (els[0]) to(els[0], false)
    c.dataset.state = 'wait'
    const timers = words.map(({ at }, i) =>
      window.setTimeout(() => {
        c.dataset.state = 'type'
        to(els[i], true)
      }, at * 1000),
    )
    const last = words.at(-1)
    timers.push(window.setTimeout(() => (c.dataset.state = 'done'), ((last?.at ?? 0) + 0.45) * 1000))
    return () => timers.forEach(clearTimeout)
  }, [start, words])
  return (
    <p className={'relative ' + className}>
      <span className="sr-only">{text}</span>
      <span ref={box} aria-hidden className="stream" data-on={start ? (reduced ? 'still' : 'go') : undefined}>
        {words.map(({ word, space, at }, i) => (
          <Fragment key={i}>
            <span className="w" style={{ '--at': `${at}s` } as CSSProperties}>
              {word}
            </span>
            {space}
          </Fragment>
        ))}
        <span ref={caret} className="stream-caret" />
      </span>
    </p>
  )
}
