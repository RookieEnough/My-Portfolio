import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type RefObject } from 'react'
import { skills } from './content'
import { sfx } from './audio'
import { rig } from './rig'
import { LogoMark, drawLogo, preloadLogos, toolBrand, type Logo } from './brands'
import { Flap, coarse, reduced } from './ui'

export type KeyInfo = { code: string; letter?: string; kana?: string; name: string; note?: string; logo?: Logo; color?: string; ink?: string }
export type Via = 'pointer' | 'keyboard' | 'hover'
type Kind = 'alpha' | 'mod' | 'space' | 'enter'
type K = KeyInfo & { kind: Kind; w: number; x: number; z: number }

// JIS kana sub-legends, same as a real Japanese keyboard
const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM'
const KANA = 'たていすかんなにらせちとしはきくまのりつさそひこみも'
type Mod = [code: string, w: number, label: string, kind?: Kind]
const ROWS: (string | Mod)[][] = [
  [['Tab', 1.5, 'tab'], ...'QWERTYUIOP', ['Backspace', 1.5, 'del']],
  [['CapsLock', 1.75, 'caps'], ...'ASDFGHJKL', ['Enter', 2.25, 'say hi', 'enter']],
  [['ShiftLeft', 2.25, 'shift'], ...'ZXCVBNM', ['Comma', 1, ','], ['Period', 1, '.'], ['ShiftRight', 1.75, 'shift']],
  [['ControlLeft', 1.5, 'ctrl'], ['MetaLeft', 1.25, 'win'], ['AltLeft', 1.25, 'alt'], ['Space', 5, 'ship it', 'space'], ['AltRight', 1.25, 'alt'], ['ContextMenu', 1.25, 'fn'], ['ControlRight', 1.5, 'ctrl']],
]
const NOTES: Record<string, string> = {
  Enter: 'Takes you to my inbox. Go on, press it.',
  Space: 'The most important key. Everything ends here.',
  Backspace: 'Used rarely. I commit to things.',
}

const KEYS: K[] = ROWS.flatMap((row, r) => {
  let x = -6.5
  return row.map((k) => {
    let key: K
    if (typeof k === 'string') {
      const i = LETTERS.indexOf(k)
      // each letter is a tool: its brand colour on the cap and its logo on top
      const s = skills[i]
      key = { code: 'Key' + k, letter: k, kana: KANA[i], name: s?.name ?? k, note: s?.note, ...(s && toolBrand(s)), kind: 'alpha', w: 1, x: 0, z: 0 }
    } else {
      const [code, w, label, kind = 'mod'] = k
      key = { code, name: label, note: NOTES[code], kind, w, x: 0, z: 0 }
    }
    key.x = x + key.w / 2
    key.z = (r - 1.5) * 1.02
    x += key.w
    return key
  })
})

const INK = '#1b1a18'
const PAPER = '#ebe5d6'
const RED = '#c62a32'
const CAP: Record<Kind, { bg: string; fg: string; sub: string }> = {
  alpha: { bg: PAPER, fg: INK, sub: RED },
  mod: { bg: '#2b2a27', fg: PAPER, sub: '#8b867a' },
  space: { bg: '#2b2a27', fg: RED, sub: '#8b867a' },
  enter: { bg: RED, fg: PAPER, sub: '#f3c9c4' },
}

const H = 0.44 // keycap height
const R = 0.07 // corner radius
const TAPER = 0.07 // how much the top shrinks on each side

// tapered keycap: rounded box with the top vertices pulled inward
const geoCache = new Map<number, THREE.BufferGeometry>()
function capGeometry(w: number) {
  if (geoCache.has(w)) return geoCache.get(w)!
  const W = w - 0.1
  const D = 0.92
  const g = new RoundedBoxGeometry(W, H, D, 3, R)
  const pos = g.attributes.position as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) + H / 2) / H
    pos.setX(i, pos.getX(i) * (1 - (2 * TAPER * t) / W))
    pos.setZ(i, pos.getZ(i) * (1 - (2 * TAPER * t) / D))
  }
  g.computeVertexNormals()
  geoCache.set(w, g)
  return g
}
const topSize = (w: number) => [w - 0.1 - 2 * TAPER - R * 1.4, 0.92 - 2 * TAPER - R * 1.4] as const

const PX = 340 // texture pixels per world unit
function legend(k: K) {
  const [pw, pd] = topSize(k.w)
  const W = Math.round(pw * PX)
  const Hh = Math.round(pd * PX)
  const c = document.createElement('canvas')
  c.width = W
  c.height = Hh
  const g = c.getContext('2d')!
  const col = CAP[k.kind]
  const ink = k.ink ?? col.fg
  g.fillStyle = k.color ?? col.bg
  g.fillRect(0, 0, W, Hh)
  const pad = Hh * 0.11
  g.textBaseline = 'alphabetic'
  const texture = () => {
    const tex = new THREE.CanvasTexture(c)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.anisotropy = 8
    return tex
  }

  if (k.kind === 'alpha') {
    // the letter you can type and its kana stay small in the corners; the logo is the legend
    g.globalAlpha = k.logo ? 0.62 : 1
    g.fillStyle = k.logo ? ink : '#857f72'
    g.font = `600 ${Hh * 0.14}px "JetBrains Mono Variable", monospace`
    g.fillText(k.letter!, pad, pad + Hh * 0.11)
    g.fillStyle = k.logo ? ink : col.sub
    g.font = `800 ${Hh * (k.logo ? 0.16 : 0.21)}px "Shippori Mincho B1", serif`
    g.textAlign = 'right'
    g.fillText(k.kana!, W - pad, pad + Hh * (k.logo ? 0.13 : 0.18))
    g.textAlign = 'left'
    g.globalAlpha = 1
    if (k.logo) {
      drawLogo(g, k.logo, W / 2, Hh * 0.59, Hh * 0.5, ink)
      return texture()
    }
  }

  // main legend, shrunk (or split onto two lines) until it fits
  const isAlpha = k.kind === 'alpha'
  const font = (px: number) =>
    isAlpha ? `800 condensed ${px}px "Archivo Variable", sans-serif` : `600 ${px}px "JetBrains Mono Variable", monospace`
  const max = W - pad * 2
  let size = Hh * (isAlpha ? 0.25 : 0.16)
  let lines = [isAlpha ? k.name : k.name.toLowerCase()]
  const fits = () => lines.every((l) => g.measureText(l).width <= max)
  g.font = font(size)
  if (!fits() && lines[0].includes(' ')) lines = lines[0].split(' ')
  while (!fits() && size > 8) g.font = font((size -= 1))
  g.fillStyle = ink
  if (k.kind === 'space') {
    g.textAlign = 'center'
    g.fillText(lines[0], W / 2, Hh / 2 + size * 0.35)
  } else {
    lines.forEach((l, i) => g.fillText(l, pad, Hh - pad - (lines.length - 1 - i) * size * 1.02))
  }
  if (k.kind === 'enter') {
    g.textAlign = 'right'
    g.font = `600 ${Hh * 0.26}px "JetBrains Mono Variable", monospace`
    g.fillText('↵', W - pad, pad + Hh * 0.22)
  }
  return texture()
}

// legends are painted once, so wait for the fonts and any dropped-in logo files
function useLegendsReady() {
  const [ready, setReady] = useState(false)
  useEffect(() => {
    Promise.all([
      document.fonts.load('800 condensed 40px "Archivo Variable"'),
      document.fonts.load('600 40px "JetBrains Mono Variable"'),
      document.fonts.load('800 40px "Shippori Mincho B1"', KANA),
      preloadLogos(KEYS.map((k) => k.logo)),
    ]).finally(() => setReady(true))
  }, [])
  return ready
}

// opaque page sections and the music deck (data-solid) sit above the canvas, so keys behind them stay inert
const blocked = (e: ThreeEvent<PointerEvent>) => !!(e.nativeEvent.target as Element | null)?.closest?.('[data-solid]')

// pose = [x, y, rotX, rotY, rotZ, scale]; computed each frame from the viewport
const pose = new Float32Array(6)
function writePose(p: number, vw: number, vh: number) {
  const portrait = vw < vh * 0.9
  const fitTool = portrait ? (vw * 0.96) / 13.6 : Math.min((vw * 0.74) / 13.6, (vh * 0.5) / 4.6)
  const A = portrait
    ? [0, -vh * 0.26, 0.9, -0.25, 0.06, (vw * 0.88) / 13.6]
    : [vw * 0.225, -vh * 0.06, 0.92, -0.45, 0.12, Math.min((vw * 0.5) / 13.6, vh * 0.1)]
  const B = [0, portrait ? -vh * 0.04 : -vh * 0.14, 1.05, 0, 0, fitTool]
  const C = [0, vh * 0.95, 1.4, 0.3, -0.12, fitTool * 0.85]
  const [from, to, t] = p <= 1 ? [A, B, p] : [B, C, p - 1]
  const e = t * t * (3 - 2 * t) // smoothstep
  for (let i = 0; i < 6; i++) pose[i] = from[i] + (to[i] - from[i]) * e
  // on the way out the opaque Work section scrolls up under the board; an eased lift starts slower than the page
  // and the section's edge would slice the board's bottom off, so the board rides up with the page (plus a bit)
  if (p > 1) pose[1] = B[1] + vh * (t + 0.12 * e)
}
// inline on a phone the board fills its own box, tilted a little flatter so the caps read as big targets
function writeInlinePose(vw: number, vh: number) {
  pose.set([0, 0, 1.2, 0, 0, Math.min((vw * 0.96) / 13.6, (vh * 0.8) / 4.6)])
}

// ---------- the name flag a key plants on itself while you point at it ----------
// tools and the keys with something to say get one; plain modifiers (shift, ctrl…) stay quiet.
// Touch screens never get one: ten fingers would plant ten flags, and the readout already names the key.
const speaks = (i: number) => KEYS[i].kind === 'alpha' || !!KEYS[i].note

// the flagged key lives outside React state, so raising a flag never re-renders the 3D scene
let flagged = -1
const flagSubs = new Set<() => void>()
const setFlag = (i: number) => {
  if (i === flagged) return
  flagged = i
  flagSubs.forEach((f) => f())
}
const subFlag = (f: () => void) => (flagSubs.add(f), () => void flagSubs.delete(f))

function KeyTag({ active, el }: { active: boolean; el: RefObject<HTMLDivElement | null> }) {
  const on = useSyncExternalStore(subFlag, () => flagged)
  const i = active ? on : -1
  // keep the last key on the flag while it furls away
  const [last, setLast] = useState(-1)
  if (i >= 0 && i !== last) setLast(i)
  useEffect(() => void (i >= 0 && sfx.flap()), [i])
  const k = last >= 0 ? KEYS[last] : null
  return (
    <div ref={el} className={'key-tag' + (i >= 0 ? ' on' : '')} aria-hidden>
      <span className="key-tag-pole" />
      <div className="key-tag-card">
        {k?.logo && (
          <span key={last} className="tool-chip key-tag-chip" style={{ background: k.color, color: k.ink }}>
            <LogoMark logo={k.logo} className="size-full" />
          </span>
        )}
        <span className="key-tag-name">
          {[...(k?.name.toUpperCase() ?? '')].map((c, j) => (
            <Flap key={j} c={c} from=" " delay={j * 0.024} />
          ))}
        </span>
        {k?.kana && <span className="key-tag-kana jp">{k.kana}</span>}
      </div>
    </div>
  )
}

const HOLD = 1.6 // seconds a flag stays up after a typed key
const v = new THREE.Vector3()

// eases cur toward to and notes whether it still has visible distance to cover
let moving = false
const ease = (cur: number, to: number, k: number, eps: number) => {
  const d = to - cur
  if (d > eps || d < -eps) moving = true
  return cur + d * k
}

// No drei ContactShadows under the board: its blur passes draw a plane at the world origin through the shadow camera,
// which only lines up while the shadow sits unmoved at the scene root. Riding inside this flying, tilted, scaled group
// it shot an empty texture on load, and every re-shoot after (a theme toggle re-renders the board) baked in a skewed
// slice of that plane: the grey bar that showed up beside the case.

type BoardProps = { dark: boolean; active: boolean; inline: boolean; onKey: (k: KeyInfo, via: Via) => void; tagEl: RefObject<HTMLDivElement | null> }
function Board({ dark, active, inline, onKey, tagEl }: BoardProps) {
  const ready = useLegendsReady()
  const invalidate = useThree((s) => s.invalidate)
  const setEvents = useThree((s) => s.setEvents)
  const group = useRef<THREE.Group>(null!)
  const capRefs = useRef<(THREE.Group | null)[]>([])
  const pressed = useRef(new Float32Array(KEYS.length))
  const depth = useRef(new Float32Array(KEYS.length))
  const vel = useRef(new Float32Array(KEYS.length))
  const landed = useRef(new Uint8Array(KEYS.length))
  const hover = useRef(-1)
  const scrolling = useRef(0) // hover is held off until this time (ms) while the page scrolls
  // who is holding which key down: a finger (pointerId) or a physical key (KeyboardEvent.code)
  const holds = useRef(new Map<number | string, number>())
  const aim = useRef({ x: 0, y: 0 })
  const idle = useRef(true)
  const lastY = useRef(0)
  // inline, the keys wait to drop in until the visitor scrolls the board into view
  const intro = useRef(-1)
  const tag = useRef({ i: -1, last: -1, until: 0, off: -9, x: 0, y: 0, pole: 0, fresh: true })
  const onKeyRef = useRef(onKey)
  onKeyRef.current = onKey

  const textures = useMemo(() => (ready ? KEYS.map(legend) : []), [ready])
  useEffect(() => () => textures.forEach((t) => t.dispose()), [textures])

  const hideTag = () => {
    const t = tag.current
    t.until = 0
    if (t.i < 0) return
    t.i = -1
    t.off = performance.now() / 1000
    setFlag(-1)
    invalidate()
  }
  const showTag = (i: number, hold = 0) => {
    const t = tag.current
    if (!speaks(i)) return hideTag()
    if (t.i < 0) t.fresh = true
    t.i = t.last = i
    t.until = hold && performance.now() / 1000 + hold
    // the scene sleeps while nothing moves, so wake it when the flag is due to come down
    if (hold) setTimeout(invalidate, hold * 1000 + 20)
    setFlag(i)
    invalidate()
  }

  const thock = (i: number) => sfx.key(KEYS[i].kind === 'alpha' ? 'alpha' : KEYS[i].kind === 'space' ? 'space' : 'mod')
  const press = (i: number, via: Via, flag: boolean) => {
    pressed.current[i] = 1
    thock(i)
    onKeyRef.current(KEYS[i], via)
    // typing on a real keyboard raises the flag for a moment
    if (flag && hover.current !== i) showTag(i, HOLD)
    invalidate()
  }
  const release = (i: number) => {
    if (!pressed.current[i]) return
    pressed.current[i] = 0
    sfx.keyUp()
    invalidate()
  }
  // every finger and every physical key holds its own key, so chords and multi-finger taps all register
  const hold = (by: number | string, i: number, via: Via, flag: boolean) => {
    holds.current.set(by, i)
    press(i, via, flag)
  }
  const lift = (by: number | string) => {
    const i = holds.current.get(by)
    if (i === undefined) return
    holds.current.delete(by)
    for (const j of holds.current.values()) if (j === i) return // another finger is still on it
    release(i)
  }
  // hovering a key with the mouse presses it most of the way, like running a finger over the board
  const hoverIn = (i: number) => {
    // keys slide under a still cursor while the page scrolls; hovering each one would thock and re-render on every frame
    if (hover.current === i || performance.now() < scrolling.current) return
    hover.current = i
    showTag(i)
    thock(i)
    onKeyRef.current(KEYS[i], 'hover')
    invalidate()
  }
  const hoverOut = (i: number, quiet = false) => {
    if (hover.current !== i) return
    hover.current = -1
    hideTag()
    if (!quiet && !pressed.current[i]) sfx.keyUp()
    invalidate()
  }

  // your real keyboard drives the 3D one
  useEffect(() => {
    const idx = (e: KeyboardEvent) => KEYS.findIndex((k) => k.code === e.code)
    const down = (e: KeyboardEvent) => {
      const i = idx(e)
      if (i >= 0 && !e.repeat) hold(e.code, i, 'keyboard', !coarse)
    }
    const up = (e: KeyboardEvent) => lift(e.code)
    const finger = (e: PointerEvent) => lift(e.pointerId)
    const all = () => {
      holds.current.clear()
      KEYS.forEach((_, i) => release(i))
    }
    // the board leans toward the mouse; fingers leave it still so keys stay put under them
    const move = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      aim.current.x = (e.clientX / innerWidth) * 2 - 1
      aim.current.y = 1 - (e.clientY / innerHeight) * 2
      invalidate()
    }
    // hover is only re-checked when the mouse moves, so a scroll would leave the flag on a key that has slid
    // out from under the cursor, even under the next section; let it go quietly, and hold off hovering until the
    // scroll settles (the wheel counts too, since it lands a frame before the smooth scroll moves anything)
    const scrolled = () => {
      scrolling.current = performance.now() + 180
      if (hover.current >= 0) hoverOut(hover.current, true)
    }
    rig.wake = invalidate
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('pointerup', finger)
    window.addEventListener('pointercancel', finger)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('scroll', scrolled, { passive: true })
    window.addEventListener('wheel', scrolled, { passive: true })
    window.addEventListener('blur', all)
    return () => {
      rig.wake = () => {}
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
      window.removeEventListener('pointerup', finger)
      window.removeEventListener('pointercancel', finger)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('scroll', scrolled)
      window.removeEventListener('wheel', scrolled)
      window.removeEventListener('blur', all)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invalidate])

  // off screen: skip raycasting entirely
  useEffect(() => {
    setEvents({ enabled: active })
    if (active) invalidate()
  }, [active, setEvents, invalidate])
  useEffect(() => invalidate(), [textures, invalidate])

  // Rendered on demand: frames run only while something is moving, then the GPU sleeps.
  useFrame((state, raw) => {
    // after a nap the clock reports the whole gap; play it back as a single frame so nothing jumps
    const dt = idle.current ? 1 / 60 : Math.min(raw, 0.1)
    idle.current = false
    moving = false

    const g = group.current
    const { width: vw, height: vh } = state.viewport
    if (inline) writeInlinePose(vw, vh)
    else writePose(rig.p, vw, vh)
    const near = inline ? 1 : 1 - Math.min(1, Math.max(0, rig.p - 1)) // mouse parallax fades out on exit
    const px = aim.current.x * near
    const py = aim.current.y * near
    const k = 1 - Math.exp(-5 * dt)
    g.position.x = ease(g.position.x, pose[0], k, 1e-3)
    // leaving, the board is locked to the scroll (no follow lag) and only eases off whatever offset it carried in
    if (!inline && rig.p > 1) g.position.y = pose[1] + ease(g.position.y - lastY.current, 0, k, 1e-3)
    else g.position.y = ease(g.position.y, pose[1], k, 1e-3)
    lastY.current = pose[1]
    g.rotation.x = ease(g.rotation.x, pose[2] - py * 0.08, k, 2e-4)
    g.rotation.y = ease(g.rotation.y, pose[3] + px * 0.14, k, 2e-4)
    g.rotation.z = ease(g.rotation.z, pose[4], k, 2e-4)
    g.scale.setScalar(ease(g.scale.x, pose[5], k, 1e-3))

    const now = performance.now() / 1000
    if (!inline) intro.current = rig.intro
    else if (intro.current < 0 && active && rig.intro >= 0) intro.current = reduced ? rig.intro : now + 0.1
    const start = intro.current
    const h = Math.min(dt, 1 / 30)
    const damp = Math.exp(-30 * h)
    const D = depth.current
    const V = vel.current
    for (let i = 0; i < KEYS.length; i++) {
      const cap = capRefs.current[i]
      if (!cap) continue
      // underdamped spring, so a released key springs back with a tiny bounce
      const target = Math.max(pressed.current[i], hover.current === i ? 0.8 : 0)
      if (V[i] !== 0 || D[i] !== target) {
        V[i] = (V[i] + (target - D[i]) * 700 * h) * damp
        D[i] += V[i] * h
        if (Math.abs(V[i]) < 1e-3 && Math.abs(target - D[i]) < 1e-4) (D[i] = target), (V[i] = 0)
        else moving = true
      }
      let drop = 4
      if (landed.current[i]) drop = 0
      else if (start >= 0) {
        const t = Math.min(1, Math.max(0, (now - start - (KEYS[i].x + 6.5) * 0.045 - (KEYS[i].z + 1.5) * 0.06) / 0.55))
        drop = 4 * (1 - t) * (1 - t) * (1 - t)
        if (t < 1) moving = true
        else {
          landed.current[i] = 1
          if (KEYS[i].kind === 'alpha' && i % 2 === 0 && now - start < 3) sfx.key('alpha')
        }
      }
      cap.position.y = 0.32 + drop - D[i] * 0.16
    }

    // the flag rides on its key: project the keycap to screen pixels and glide there
    const t = tag.current
    if (t.until && now > t.until) {
      if (hover.current >= 0) showTag(hover.current)
      else hideTag()
    }
    const el = tagEl.current
    const cap = capRefs.current[t.last]
    if (el && cap && !(t.i < 0 && now - t.off > 0.5)) {
      const card = el.lastElementChild as HTMLElement
      const w = card.offsetWidth // read before any writes, so this never forces a layout
      const { width: sw, height: sh } = state.size
      cap.updateWorldMatrix(true, false)
      cap.localToWorld(v.set(0, H / 2, 0)).project(state.camera)
      const x = ((v.x + 1) / 2) * sw
      const y = ((1 - v.y) / 2) * sh
      cap.localToWorld(v.set(0, H / 2, -0.5)).project(state.camera)
      const pole = Math.max(14, y - ((1 - v.y) / 2) * sh) + 18 // clear the top edge of the key
      const s = t.fresh || reduced ? 1 : 1 - Math.exp(-26 * dt)
      t.fresh = false
      t.x = ease(t.x, x, s, 0.1)
      t.y = ease(t.y, y, s, 0.1)
      t.pole = ease(t.pole, pole, s, 0.1)
      el.style.transform = `translate3d(${t.x.toFixed(1)}px,${t.y.toFixed(1)}px,0)`
      el.style.setProperty('--pole', `${t.pole.toFixed(1)}px`)
      el.classList.toggle('flip', t.x + w + 16 > sw)
    }

    if (moving) state.invalidate()
    else idle.current = true
  })

  // inline the canvas takes its own events, so nothing can be laid over it
  const covered = (e: ThreeEvent<PointerEvent>) => !inline && blocked(e)
  const caseColor = dark ? '#1d1d1b' : '#cfc9bb'
  return (
    <group ref={group} scale={0.5}>
      <mesh position={[0, -0.2, 0]}>
        <boxGeometry args={[13.25, 0.6, 4.3]} />
        <meshStandardMaterial color="#121211" roughness={0.9} />
      </mesh>
      <CaseShell color={caseColor} />
      {KEYS.map((k, i) => {
        const [tw, td] = topSize(k.w)
        return (
          <group key={k.code} position={[k.x, 4, k.z]} ref={(el) => void (capRefs.current[i] = el)}>
            <mesh
              geometry={capGeometry(k.w)}
              onPointerOver={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation()
                if (e.nativeEvent.pointerType === 'mouse' && !covered(e)) hoverIn(i)
              }}
              onPointerMove={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation()
                if (e.nativeEvent.pointerType !== 'mouse') return
                if (covered(e)) hoverOut(i)
                else hoverIn(i)
              }}
              onPointerOut={() => hoverOut(i)}
              onPointerDown={(e: ThreeEvent<PointerEvent>) => {
                e.stopPropagation()
                if (covered(e) || (e.nativeEvent.target as Element | null)?.closest?.('a, button')) return
                hold(e.nativeEvent.pointerId, i, 'pointer', e.nativeEvent.pointerType === 'mouse')
              }}
            >
              <meshStandardMaterial color={k.color ?? CAP[k.kind].bg} roughness={0.62} />
            </mesh>
            {textures[i] && (
              <mesh position={[0, H / 2 + 0.002, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[tw, td]} />
                <meshStandardMaterial map={textures[i]} roughness={0.62} polygonOffset polygonOffsetFactor={-2} />
              </mesh>
            )}
          </group>
        )
      })}
    </group>
  )
}

// aluminium case with a lip around the keys
function CaseShell({ color }: { color: string }) {
  const geo = useMemo(() => {
    const outer = new THREE.Shape()
    const w = 13.75 / 2
    const d = 4.8 / 2
    const r = 0.32
    outer.moveTo(-w + r, -d)
    outer.lineTo(w - r, -d)
    outer.quadraticCurveTo(w, -d, w, -d + r)
    outer.lineTo(w, d - r)
    outer.quadraticCurveTo(w, d, w - r, d)
    outer.lineTo(-w + r, d)
    outer.quadraticCurveTo(-w, d, -w, d - r)
    outer.lineTo(-w, -d + r)
    outer.quadraticCurveTo(-w, -d, -w + r, -d)
    const hole = new THREE.Path()
    hole.moveTo(-6.6, -2.12)
    hole.lineTo(6.6, -2.12)
    hole.lineTo(6.6, 2.12)
    hole.lineTo(-6.6, 2.12)
    hole.lineTo(-6.6, -2.12)
    outer.holes.push(hole)
    const g = new THREE.ExtrudeGeometry(outer, { depth: 0.75, bevelEnabled: true, bevelSize: 0.06, bevelThickness: 0.06, bevelSegments: 3 })
    g.rotateX(Math.PI / 2)
    g.translate(0, 0.2, 0)
    return g
  }, [])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo}>
      <meshStandardMaterial color={color} metalness={0.55} roughness={0.38} />
    </mesh>
  )
}

type KeyboardProps = { dark: boolean; inline?: boolean; onKey: (k: KeyInfo, via: Via) => void }
const isOn = () => rig.on

// one element for the life of the page: drei re-shoots a frames={1} environment whenever its children change by
// reference, which a fresh JSX tree on every render of the board always did
const ENV = (
  <Environment resolution={256} frames={1}>
    <Lightformer intensity={2.2} position={[0, 6, 4]} scale={[14, 3, 1]} rotation={[-Math.PI / 3, 0, 0]} />
    <Lightformer intensity={1.2} position={[-8, 2, 2]} scale={[3, 8, 1]} rotation={[0, Math.PI / 2, 0]} />
    <Lightformer intensity={0.8} position={[8, 1, -2]} scale={[3, 6, 1]} rotation={[0, -Math.PI / 2, 0]} color={RED} />
  </Environment>
)

// Two homes for the same board. On wide screens it is one fixed canvas behind the page that flies from the
// hero into the toolkit. On phones it sits inline in the toolkit section: the browser scrolls it like any
// other block, so nothing is re-rendered (or lags a frame behind the finger) while the page moves.
export default function Keyboard({ dark, inline = false, onKey }: KeyboardProps) {
  const tagEl = useRef<HTMLDivElement>(null)
  const box = useRef<HTMLDivElement>(null)
  const active = useSyncExternalStore(rig.subscribe, isOn)
  const [seen, setSeen] = useState(false)
  useEffect(() => {
    if (!inline) return
    const io = new IntersectionObserver(([e]) => setSeen(e.isIntersecting), { rootMargin: '160px 0px' })
    io.observe(box.current!)
    return () => io.disconnect()
  }, [inline])
  const on = inline ? seen : active

  const scene = (
    <>
      <ambientLight intensity={dark ? 0.35 : 0.6} />
      <directionalLight position={[-6, 10, 8]} intensity={dark ? 1.6 : 1.8} />
      <directionalLight position={[8, 4, -4]} intensity={0.5} color={RED} />
      {ENV}
      <Board dark={dark} active={on} inline={inline} onKey={onKey} tagEl={tagEl} />
    </>
  )
  const shared = {
    frameloop: on ? ('demand' as const) : ('never' as const),
    dpr: [1, 1.75] as [number, number],
    gl: { antialias: true, alpha: true, powerPreference: 'high-performance' as const },
    camera: { position: [0, 0, 20] as [number, number, number], fov: 30 },
  }

  if (inline)
    return (
      // pan-y: a swipe across the board still scrolls the page, but a chord can never turn into a pinch-zoom
      <div ref={box} className="kb-inline -mx-5 md:-mx-8" aria-hidden>
        <Canvas {...shared} style={{ touchAction: 'pan-y' }}>
          {scene}
        </Canvas>
      </div>
    )

  return (
    <>
      <Canvas
        {...shared}
        className="keyboard-canvas"
        // 100vh is the tall viewport, so a phone's URL bar sliding away never resizes the drawing buffer mid-scroll
        style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100vh', zIndex: 0, pointerEvents: 'none', visibility: active ? 'visible' : 'hidden' }}
        eventSource={document.getElementById('root')!}
        eventPrefix="client"
        aria-hidden
      >
        {scene}
      </Canvas>
      {/* outside the canvas so the name is crisp DOM text, laid over the page */}
      {!coarse && <KeyTag active={active} el={tagEl} />}
    </>
  )
}
