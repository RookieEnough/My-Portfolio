// The entry gate backdrop: a cherry-blossom tree under a dusk sky, with petals drifting down.
// Three stacked canvases — a static sky, a static tree (parallaxed by the pointer), and the live petals.
// Both the sky and the tree are pre-rendered for each theme, so toggling light/dark cross-fades the
// backdrop while the moon slides down and the sun rises into its place (and vice-versa).
// Everything is aria-hidden and pointer-events-none; the real controls sit above it in the Gate.
import { useEffect, useRef } from 'react'
import { reduced } from './ui'

type Theme = 'dark' | 'light'
const themeNow = (): Theme => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')

const lerp = (a: number, b: number, t: number) => a + (b - a) * t
const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v)
const easeInOut = (t: number) => (t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2)

// small seeded RNG so the tree is the same shape every paint of a given size
function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 4294967296
  }
}

// ---------- sky ----------
// split in two so the sun/moon sits between them and can set behind the ridges:
// the back is the bare gradient, the front is mist, mountains and grain on transparent
function paintSkyBack(g: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
  const sky = g.createLinearGradient(0, 0, 0, h)
  if (t === 'light') {
    sky.addColorStop(0, '#efe7dd')
    sky.addColorStop(0.55, '#f2ddd6')
    sky.addColorStop(1, '#f3d9d3')
  } else {
    sky.addColorStop(0, '#0d0d0c')
    sky.addColorStop(0.6, '#1b1016')
    sky.addColorStop(1, '#2a1820')
  }
  g.fillStyle = sky
  g.fillRect(0, 0, w, h)
}

// one mountain ridge outline, far (0) to near (2); seeded so every call traces the same line
function ridgePath(g: CanvasRenderingContext2D, w: number, h: number, i: number) {
  const base = h * (0.6 + i * 0.1)
  const amp = h * (0.08 + i * 0.03)
  const r2 = rng(97 + i * 53)
  g.moveTo(0, h)
  g.lineTo(0, base)
  for (let x = 0; x <= w; x += w / 10) g.lineTo(x, base - amp * (0.4 + r2() * 0.6))
  g.lineTo(w, base)
  g.lineTo(w, h)
  g.closePath()
}

function paintSkyFront(g: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
  // back the ridges with the sky itself so they're opaque and the disc sets behind them
  g.save()
  g.beginPath()
  for (let i = 0; i < 3; i++) ridgePath(g, w, h, i)
  g.clip()
  paintSkyBack(g, w, h, t)
  g.restore()

  // kasumi — mist bands, drawn across the disc like a woodblock print
  const mist = t === 'light' ? '255, 249, 244' : '60, 40, 52'
  for (let i = 0; i < 5; i++) {
    const y = h * (0.42 + i * 0.1)
    g.fillStyle = `rgba(${mist}, ${0.14 - i * 0.015})`
    g.beginPath()
    roundBand(g, -40, y, w + 80, h * 0.07, h * 0.035)
    g.fill()
  }

  // mountain ridges, far to near, fading into the haze
  const ridges = t === 'light'
    ? ['rgba(150,120,130,0.22)', 'rgba(120,92,104,0.3)', 'rgba(92,66,78,0.42)']
    : ['rgba(70,48,64,0.5)', 'rgba(48,30,44,0.65)', 'rgba(28,16,26,0.85)']
  ridges.forEach((col, i) => {
    g.fillStyle = col
    g.beginPath()
    ridgePath(g, w, h, i)
    g.fill()
  })

  grain(g, w, h, t)
}

// the sun (light) or moon (dark): a soft flat disc with a radial halo, drawn on the sky at (cx, cy)
function drawCelestial(g: CanvasRenderingContext2D, w: number, h: number, t: Theme, cx: number, cy: number, r: number, alpha: number) {
  if (alpha <= 0.001) return
  g.save()
  const disc = t === 'light' ? '224, 52, 60' : '236, 228, 212'
  const halo = g.createRadialGradient(cx, cy, 0, cx, cy, r * 2.6)
  halo.addColorStop(0, `rgba(${disc}, ${(t === 'light' ? 0.5 : 0.42) * alpha})`)
  halo.addColorStop(1, `rgba(${disc}, 0)`)
  g.fillStyle = halo
  g.fillRect(0, 0, w, h)
  g.globalAlpha = alpha * (t === 'light' ? 0.9 : 0.85)
  g.fillStyle = t === 'light' ? '#dd3a42' : '#ece4d4'
  g.beginPath()
  g.arc(cx, cy, r, 0, Math.PI * 2)
  g.fill()
  g.restore()
}

function roundBand(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.moveTo(x + r, y)
  g.arcTo(x + w, y, x + w, y + h, r)
  g.arcTo(x + w, y + h, x, y + h, r)
  g.arcTo(x, y + h, x, y, r)
  g.arcTo(x, y, x + w, y, r)
}

function grain(g: CanvasRenderingContext2D, w: number, h: number, t: Theme) {
  const n = Math.round((w * h) / 1600)
  g.fillStyle = t === 'light' ? 'rgba(40,30,30,0.04)' : 'rgba(255,245,235,0.03)'
  const r = rng(12345)
  for (let i = 0; i < n; i++) g.fillRect(r() * w, r() * h, 1, 1)
}

// ---------- tree ----------
type Bloom = { x: number; y: number; r: number }

function paintTree(g: CanvasRenderingContext2D, w: number, h: number, t: Theme, blooms: Bloom[]) {
  const bark = t === 'light' ? '#2a1d1f' : '#050405'

  // a dark hill the trunk grows out of, lower right
  g.fillStyle = t === 'light' ? 'rgba(42,29,31,0.9)' : 'rgba(5,4,5,0.95)'
  g.beginPath()
  g.moveTo(w, h)
  g.lineTo(w, h * 0.82)
  g.quadraticCurveTo(w * 0.7, h * 0.9, w * 0.4, h)
  g.closePath()
  g.fill()

  const r = rng(20260409)
  g.fillStyle = bark
  g.strokeStyle = bark
  const x0 = w * 0.84
  const y0 = h * 1.02

  // trunk → a long limb arching left across the top quarter, plus up and right limbs
  branch(g, x0, y0, -Math.PI / 2 - 0.12, Math.min(w, h) * 0.2, 0, r, blooms, w, h, t)
}

// one tapered, slightly gnarled segment; recurses into children and drops blossom clusters at the tips
function branch(
  g: CanvasRenderingContext2D, x: number, y: number, ang: number, len: number,
  depth: number, r: () => number, blooms: Bloom[], w: number, h: number, t: Theme,
) {
  const width = Math.max(1.2, 13 - depth * 2.1)
  const steps = Math.max(3, Math.round(len / 14))
  let cx = x
  let cy = y
  let a = ang
  g.lineCap = 'round'
  g.lineWidth = width
  for (let i = 0; i < steps; i++) {
    a += (r() - 0.5) * 0.22 // gnarl
    const nx = cx + (Math.cos(a) * len) / steps
    const ny = cy + (Math.sin(a) * len) / steps
    g.lineWidth = lerp(width, Math.max(1, width - 3), i / steps)
    g.beginPath()
    g.moveTo(cx, cy)
    g.lineTo(nx, ny)
    g.stroke()
    cx = nx
    cy = ny
  }

  // lenticels — short horizontal bark marks on the thick lower limbs
  if (depth < 2 && width > 5) {
    g.save()
    g.strokeStyle = t === 'light' ? 'rgba(255,240,235,0.12)' : 'rgba(180,160,170,0.12)'
    g.lineWidth = 1
    for (let i = 0; i < 4; i++) {
      const px = lerp(x, cx, r())
      const py = lerp(y, cy, r())
      g.beginPath()
      g.moveTo(px - 3, py)
      g.lineTo(px + 3, py)
      g.stroke()
    }
    g.restore()
    g.fillStyle = g.strokeStyle = t === 'light' ? '#2a1d1f' : '#050405'
  }

  if (depth >= 4 || len < 16) {
    // twig end → a blossom cluster; remember it so petals can spawn from the canopy
    blooms.push({ x: cx, y: cy, r: 16 + r() * 16 })
    return
  }

  // side branches along the limb, biased to keep the big arch heading left
  const kids = depth === 0 ? 3 : 2 + (r() < 0.5 ? 1 : 0)
  for (let i = 0; i < kids; i++) {
    const spread = 0.5 + r() * 0.7
    const dir = depth === 0 ? [-1, 0.5, 1][i] : r() < 0.6 ? -1 : 1
    branch(g, cx, cy, a + spread * dir, len * (0.66 + r() * 0.2), depth + 1, r, blooms, w, h, t)
  }
}

function paintBlossoms(g: CanvasRenderingContext2D, blooms: Bloom[], t: Theme) {
  const sets = t === 'light'
    ? { shadow: '#e899aa', mid: '#f2b3c0', hi: '#fbe0e4', core: '#d9667f' }
    : { shadow: '#6e4653', mid: '#8a5667', hi: '#caa6b2', core: '#52303c' }
  // passes: shadow pinks, then mids, then highlights (lighter toward upper-left), then flowers
  for (const pass of ['shadow', 'mid', 'hi'] as const) {
    g.fillStyle = sets[pass]
    const spread = pass === 'shadow' ? 1 : pass === 'mid' ? 0.72 : 0.44
    const off = pass === 'hi' ? -0.5 : 0
    const r = rng(pass === 'shadow' ? 11 : pass === 'mid' ? 22 : 33)
    for (const b of blooms) {
      const n = 5 + Math.round(b.r / 5)
      for (let i = 0; i < n; i++) {
        const rr = b.r * spread
        g.beginPath()
        g.arc(b.x + (r() - 0.5 + off) * rr, b.y + (r() - 0.5 + off * 0.6) * rr, 2 + r() * 3, 0, Math.PI * 2)
        g.fill()
      }
    }
  }
  // a few tiny 5-petal flowers on the nearest clusters
  const r = rng(44)
  for (const b of blooms) {
    if (r() > 0.4) continue
    const fx = b.x + (r() - 0.5) * b.r
    const fy = b.y + (r() - 0.5) * b.r
    g.fillStyle = sets.hi
    for (let p = 0; p < 5; p++) {
      const a = (p / 5) * Math.PI * 2
      g.beginPath()
      g.arc(fx + Math.cos(a) * 2.6, fy + Math.sin(a) * 2.6, 2, 0, Math.PI * 2)
      g.fill()
    }
    g.fillStyle = sets.core
    g.beginPath()
    g.arc(fx, fy, 1.4, 0, Math.PI * 2)
    g.fill()
  }
}

// ---------- petals ----------
// a single sakura petal on a 12-wide unit path, tip notched
const PETAL = new Path2D('M0 6 C -3 3 -3 -3 0 -6 C 1 -4 1.4 -2 1.2 0 C 1.4 -1 2 -0.5 0 6 Z')

type Petal = {
  x: number; y: number; z: number // z: 0 far … 1 near
  vx: number; vy: number
  spin: number; dspin: number; roll: number; droll: number
  size: number; slip: number
  front: string; back: string
}

export default function Sakura() {
  const skyRef = useRef<HTMLCanvasElement>(null)
  const treeRef = useRef<HTMLCanvasElement>(null)
  const petalRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const sky = skyRef.current!
    const tree = treeRef.current!
    const petal = petalRef.current!
    const wrap = wrapRef.current!
    const sg = sky.getContext('2d')!
    const tg = tree.getContext('2d')!
    const pg = petal.getContext('2d')!
    const dpr = Math.min(devicePixelRatio || 1, 2)

    let W = 0
    let H = 0
    let theme = themeNow()
    let prevTheme: Theme | null = null
    let blooms: Bloom[] = []
    let petals: Petal[] = []
    const bgImg = {} as Record<Theme, HTMLCanvasElement>
    const frontImg = {} as Record<Theme, HTMLCanvasElement>
    const treeImg = {} as Record<Theme, HTMLCanvasElement>
    const wind = { x: -26, gust: 0 }
    const pointer = { x: 0.5, y: 0.5 }

    // theme-swap animation (moon down / sun up) runs on its own clock, below
    const SWAP = 1100

    const PINKS = {
      light: [['#f6c9d0', '#e3a6b1'], ['#f2b3c0', '#dd94a3'], ['#fbe0e4', '#edbcc6']],
      dark: [['#c9a3ad', '#9c7682'], ['#b890a0', '#8a6673'], ['#dcc0c8', '#a98d98']],
    }

    function spawn(fromCanopy: boolean): Petal {
      const z = Math.random()
      const pal = PINKS[theme][Math.floor(Math.random() * 3)]
      let x: number
      let y: number
      if (fromCanopy && blooms.length) {
        const b = blooms[Math.floor(Math.random() * blooms.length)]
        x = b.x + (Math.random() - 0.5) * b.r
        y = b.y + (Math.random() - 0.5) * b.r
      } else {
        // off the top, biased to the right where the canopy hangs
        x = W * (0.3 + Math.random() * 0.85)
        y = -20 - Math.random() * H * 0.3
      }
      return {
        x, y, z,
        vx: 0, vy: lerp(16, 42, z),
        spin: Math.random() * Math.PI * 2,
        dspin: (Math.random() - 0.5) * 2.2,
        roll: Math.random() * Math.PI * 2,
        droll: (Math.random() - 0.5) * 1.4,
        size: lerp(7, 15, z),
        slip: lerp(10, 26, Math.random()),
        front: pal[0],
        back: pal[1],
      }
    }

    // render one static layer for a theme into an offscreen canvas
    function makeLayer(paint: (g: CanvasRenderingContext2D) => void) {
      const c = document.createElement('canvas')
      c.width = Math.max(1, W * dpr)
      c.height = Math.max(1, H * dpr)
      const g = c.getContext('2d')!
      g.setTransform(dpr, 0, 0, dpr, 0, 0)
      paint(g)
      return c
    }

    function size() {
      const r = wrap.getBoundingClientRect()
      W = Math.max(1, Math.round(r.width))
      H = Math.max(1, Math.round(r.height))
      for (const c of [sky, tree, petal]) {
        c.width = W * dpr
        c.height = H * dpr
        c.style.width = W + 'px'
        c.style.height = H + 'px'
      }
      for (const g of [sg, tg, pg]) g.setTransform(dpr, 0, 0, dpr, 0, 0)

      // pre-render both themes; blooms come from the first tree render (geometry is seed-identical)
      for (const t of ['light', 'dark'] as const) {
        bgImg[t] = makeLayer((g) => paintSkyBack(g, W, H, t))
        frontImg[t] = makeLayer((g) => paintSkyFront(g, W, H, t))
      }
      blooms = []
      treeImg.dark = makeLayer((g) => { paintTree(g, W, H, 'dark', blooms); paintBlossoms(g, blooms, 'dark') })
      const tmp: Bloom[] = []
      treeImg.light = makeLayer((g) => { paintTree(g, W, H, 'light', tmp); paintBlossoms(g, tmp, 'light') })

      skyFrame(1)
      treeFrame(1)

      // area-scaled petal count
      const k = Math.min(1.3, Math.max(0.5, Math.sqrt((W * H) / (1440 * 900))))
      const want = Math.round(100 * k)
      petals = Array.from({ length: want }, () => {
        const p = spawn(Math.random() < 0.5)
        p.y = Math.random() * H // seed spread so the first frame is full
        return p
      })
    }

    // cross-fade one pre-rendered layer pair: the current theme underneath, the previous fading out on top
    function layer(g: CanvasRenderingContext2D, imgs: Record<Theme, HTMLCanvasElement>, p: number) {
      g.globalAlpha = 1
      g.drawImage(imgs[theme], 0, 0, W, H)
      if (p < 1 && prevTheme) {
        g.globalAlpha = 1 - p
        g.drawImage(imgs[prevTheme], 0, 0, W, H)
        g.globalAlpha = 1
      }
    }

    // composite the sky back to front: gradient, then the sun/moon, then mist and ridges over them —
    // so the outgoing body sets behind the mountains while the incoming one rises from behind them
    function skyFrame(p: number) {
      sg.setTransform(dpr, 0, 0, dpr, 0, 0)
      sg.clearRect(0, 0, W, H)
      layer(sg, bgImg, p)
      const cx = W * 0.66
      const cy = H * 0.36
      const r = Math.min(W, H) * 0.14
      const D = H * 0.6
      const e = easeInOut(p)
      drawCelestial(sg, W, H, theme, cx, cy + D * (1 - e), r, clamp01(p * 1.3))
      if (p < 1 && prevTheme) drawCelestial(sg, W, H, prevTheme, cx, cy + D * e, r, clamp01((1 - p) * 1.3))
      layer(sg, frontImg, p)
    }

    function treeFrame(p: number) {
      tg.setTransform(dpr, 0, 0, dpr, 0, 0)
      tg.clearRect(0, 0, W, H)
      layer(tg, treeImg, p)
    }

    function drawPetals(dt: number) {
      pg.clearRect(0, 0, W, H)
      wind.gust *= 0.96
      if (Math.random() < 0.01) wind.gust = (Math.random() - 0.3) * 40
      const pointerWind = (pointer.x - 0.5) * 60
      const vx = wind.x + wind.gust + pointerWind

      for (const p of petals) {
        p.spin += p.dspin * dt
        p.roll += p.droll * dt
        p.x += (p.vx + vx * p.z) * dt + Math.sin(p.spin) * p.slip * dt
        p.y += p.vy * dt
        if (p.y > H + 24 || p.x < -40 || p.x > W + 40) {
          Object.assign(p, spawn(Math.random() < 0.5))
          p.y = -20
          continue
        }
        const face = Math.cos(p.spin)
        pg.save()
        pg.translate(p.x, p.y)
        pg.rotate(p.roll)
        pg.scale(face, 1)
        pg.globalAlpha = lerp(0.55, 1, p.z)
        pg.fillStyle = face < 0 ? p.back : p.front
        pg.scale(p.size / 12, p.size / 12)
        pg.fill(PETAL)
        pg.restore()
      }
    }

    // swap progress on its own clock, so the moon→sun slide is independent of the petal dt
    let swapProgress = 1
    let swapLast = performance.now()
    let raf = 0
    let last = performance.now()
    function frame(now: number) {
      const dt = Math.min((now - last) / 1000, 1 / 30)
      last = now
      drawPetals(dt)
      if (prevTheme) {
        swapProgress += (now - swapLast) / SWAP
        swapLast = now
        const p = clamp01(swapProgress)
        skyFrame(p)
        treeFrame(p)
        if (p >= 1) prevTheme = null
      }
      raf = requestAnimationFrame(frame)
    }

    size()
    const ro = new ResizeObserver(() => size())
    ro.observe(wrap)

    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf)
      else {
        last = swapLast = performance.now()
        raf = requestAnimationFrame(frame)
      }
    }
    document.addEventListener('visibilitychange', onVis)

    // pointer parallax on the tree + a gentle wind
    const onMove = (e: PointerEvent) => {
      pointer.x = e.clientX / innerWidth
      pointer.y = e.clientY / innerHeight
      const px = (pointer.x - 0.5) * 24
      const py = (pointer.y - 0.5) * 14
      tree.style.transform = `translate(${-px}px, ${-py}px)`
      sky.style.transform = `translate(${-px * 0.4}px, ${-py * 0.4}px)`
    }
    window.addEventListener('pointermove', onMove)

    // a petal-lifting gust when the visitor enters
    const onEnterGust = () => {
      for (const p of petals) {
        p.vy = -lerp(40, 120, p.z)
        p.vx = -lerp(60, 160, p.z)
        p.dspin *= 2.4
      }
      wind.gust = -120
    }
    window.addEventListener('gate-enter', onEnterGust)

    const onTheme = () => {
      const next = themeNow()
      if (next === theme) return
      prevTheme = theme
      theme = next
      swapProgress = 0
      swapLast = performance.now()
      if (reduced) {
        prevTheme = null
        skyFrame(1)
        treeFrame(1)
      }
    }
    const mo = new MutationObserver(onTheme)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    if (reduced) {
      drawPetals(0) // one still frame
    } else {
      raf = requestAnimationFrame(frame)
    }

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      mo.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('gate-enter', onEnterGust)
    }
  }, [])

  return (
    <div ref={wrapRef} aria-hidden className="gate-sakura pointer-events-none absolute inset-0 overflow-hidden">
      <canvas ref={skyRef} className="absolute inset-0 will-change-transform" />
      <canvas ref={treeRef} className="gate-tree absolute inset-0 scale-[1.04] will-change-transform" />
      <canvas ref={petalRef} className="absolute inset-0" />
    </div>
  )
}
