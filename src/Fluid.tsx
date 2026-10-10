// Ink marbling (suminagashi) behind the contact section, on a real fluid solver.
// Drops of ink land on water and push the older rings outward (Jaffer's
// area-preserving drop map). The cursor drags through them like a marbling comb,
// and a stable-fluids solver on the GPU carries the swirl. Raw WebGL2, no deps.
import { useEffect, useRef } from 'react'
import { sfx } from './audio'
import { reduced } from './ui'

type FBO = { tex: WebGLTexture; fb: WebGLFramebuffer; w: number; h: number }
type Pair = { read: FBO; write: FBO; swap(): void }
type Uniforms = Record<string, number | number[] | FBO>
type Drop = { at: number; x: number; y: number; r: number; c: number[]; loud: boolean }

const VERT = `#version 300 es
in vec2 a;
out vec2 uv;
void main() { uv = a * .5 + .5; gl_Position = vec4(a, 0, 1); }`

const HEAD = `#version 300 es
precision highp float;
precision highp sampler2D;
in vec2 uv;
out vec4 o;
uniform vec2 tx;
#define L(s) texture(s, uv - vec2(tx.x, 0))
#define R(s) texture(s, uv + vec2(tx.x, 0))
#define B(s) texture(s, uv - vec2(0, tx.y))
#define T(s) texture(s, uv + vec2(0, tx.y))
`

const FRAG = {
  advect: `uniform sampler2D V, S; uniform float dt, keep; uniform vec4 sub;
void main() {
  vec4 v = keep * texture(S, uv - dt * texture(V, uv).xy * tx) - sub;
  v.b = max(v.b, 0.);
  o = v;
}`,
  splat: `uniform sampler2D S; uniform vec2 p; uniform vec3 c; uniform float r, aspect;
void main() { vec2 d = uv - p; d.x *= aspect; o = texture(S, uv) + vec4(c * exp(-dot(d, d) / r), 0); }`,
  // new ink fills the disc; everything outside is pushed out so area is preserved
  drop: `uniform sampler2D S; uniform vec2 p; uniform vec3 c; uniform float r, aspect, px;
void main() {
  vec2 d = uv - p; d.x *= aspect;
  float l = length(d);
  vec2 q = d * sqrt(1. - r * r / max(l * l, r * r)); q.x /= aspect;
  o = mix(vec4(c, 1), texture(S, p + q), smoothstep(r - px, r + px, l));
}`,
  curl: `uniform sampler2D V;
void main() { o = vec4(.5 * (R(V).y - L(V).y - T(V).x + B(V).x), 0, 0, 1); }`,
  vorticity: `uniform sampler2D V, C; uniform float curl, dt;
void main() {
  vec2 f = .5 * vec2(abs(T(C).x) - abs(B(C).x), abs(R(C).x) - abs(L(C).x));
  f = f / (length(f) + 1e-4) * curl * texture(C, uv).x * vec2(1, -1);
  o = vec4(clamp(texture(V, uv).xy + f * dt, -1e3, 1e3), 0, 1);
}`,
  divergence: `uniform sampler2D V;
void main() {
  vec2 c = texture(V, uv).xy;
  float l = uv.x - tx.x < 0. ? -c.x : L(V).x;
  float r = uv.x + tx.x > 1. ? -c.x : R(V).x;
  float b = uv.y - tx.y < 0. ? -c.y : B(V).y;
  float t = uv.y + tx.y > 1. ? -c.y : T(V).y;
  o = vec4(.5 * (r - l + t - b), 0, 0, 1);
}`,
  scale: `uniform sampler2D S; uniform float k;
void main() { o = k * texture(S, uv); }`,
  pressure: `uniform sampler2D P, D;
void main() { o = vec4(.25 * (L(P).x + R(P).x + B(P).x + T(P).x - texture(D, uv).x), 0, 0, 1); }`,
  gradient: `uniform sampler2D P, V;
void main() { o = vec4(texture(V, uv).xy - vec2(R(P).x - L(P).x, T(P).x - B(P).x), 0, 1); }`,
  // r = sumi ink, g = vermilion ink, b = freshness. Drawn as crisp printed bands
  // with a darker pigment edge, the way real marbled paper looks.
  display: `uniform sampler2D D; uniform vec3 ink, red; uniform vec4 look;
void main() {
  vec3 d = texture(D, uv).rgb;
  vec2 w = max(fwidth(d.rg), vec2(1e-3));
  vec2 fill = smoothstep(.5 - w, .5 + w, d.rg);
  vec2 edge = 1. - smoothstep(w * .5, w * 1.4, abs(d.rg - .5));
  float fade = smoothstep(0., .5, d.b);
  float i = max(fill.x * look.x, edge.x * look.y) * fade;
  float s = max(fill.y * look.z, edge.y * look.w) * fade;
  o = vec4(red, 1) * s + vec4(ink, 1) * i * (1. - s);
}`,
}

const FORCE = 6000
const STYLUS = 0.0012
const rgb = (hex: string) => [0, 2, 4].map((i) => parseInt(hex.trim().slice(1).slice(i, i + 2), 16) / 255)

export default function Fluid({ className = '' }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current!
    const host = canvas.parentElement!
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true, antialias: false, depth: false, stencil: false })
    if (!gl || !(gl.getExtension('EXT_color_buffer_float') || gl.getExtension('EXT_color_buffer_half_float'))) return

    const compile = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'shader')
      return s
    }
    const program = (src: string) => {
      const p = gl.createProgram()!
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT))
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, HEAD + src))
      gl.bindAttribLocation(p, 0, 'a')
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p) ?? 'link')
      const locs = new Map<string, WebGLUniformLocation | null>()
      return (out: FBO | null, u: Uniforms) => {
        gl.useProgram(p)
        let unit = 0
        for (const k in u) {
          if (!locs.has(k)) locs.set(k, gl.getUniformLocation(p, k))
          const l = locs.get(k) ?? null
          const v = u[k]
          if (typeof v === 'number') gl.uniform1f(l, v)
          else if (!Array.isArray(v)) {
            gl.activeTexture(gl.TEXTURE0 + unit)
            gl.bindTexture(gl.TEXTURE_2D, v.tex)
            gl.uniform1i(l, unit++)
          } else if (v.length === 2) gl.uniform2fv(l, v)
          else if (v.length === 3) gl.uniform3fv(l, v)
          else gl.uniform4fv(l, v)
        }
        gl.bindFramebuffer(gl.FRAMEBUFFER, out?.fb ?? null)
        gl.viewport(0, 0, out?.w ?? gl.drawingBufferWidth, out?.h ?? gl.drawingBufferHeight)
        gl.drawArrays(gl.TRIANGLES, 0, 3)
      }
    }
    const target = (w: number, h: number): FBO => {
      const tex = gl.createTexture()!
      gl.bindTexture(gl.TEXTURE_2D, tex)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null)
      const fb = gl.createFramebuffer()!
      gl.bindFramebuffer(gl.FRAMEBUFFER, fb)
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0)
      if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) throw new Error('fbo')
      gl.viewport(0, 0, w, h)
      gl.clearColor(0, 0, 0, 0)
      gl.clear(gl.COLOR_BUFFER_BIT)
      return { tex, fb, w, h }
    }
    const pair = (w: number, h: number): Pair => {
      const p: Pair = { read: target(w, h), write: target(w, h), swap: () => ([p.read, p.write] = [p.write, p.read]) }
      return p
    }
    const free = (...f: FBO[]) => f.forEach((x) => (gl.deleteTexture(x.tex), gl.deleteFramebuffer(x.fb)))

    let P: { [K in keyof typeof FRAG]: ReturnType<typeof program> }
    try {
      P = Object.fromEntries(Object.entries(FRAG).map(([k, src]) => [k, program(src)])) as typeof P
      free(target(2, 2)) // float targets must be renderable
    } catch {
      return
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer())
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW)
    gl.enableVertexAttribArray(0)
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0)

    // ---------- fields ----------
    let vel: Pair | undefined, pres: Pair, dye: Pair, div: FBO, curl: FBO
    let aspect = 1, simTx = [0, 0], px = 0
    const maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE) as number
    const resize = () => {
      const dpr = Math.min(devicePixelRatio, 1.5)
      const w = Math.max(2, Math.round(canvas.clientWidth * dpr))
      const h = Math.max(2, Math.round(canvas.clientHeight * dpr))
      if (vel && w === canvas.width && h === canvas.height) return false
      canvas.width = w
      canvas.height = h
      aspect = w / h
      const grid = (n: number) => {
        const g = aspect > 1 ? [n * aspect, n] : [n, n / aspect]
        const k = Math.min(1, maxTex / Math.max(...g))
        return g.map((v) => Math.max(2, Math.round(v * k)))
      }
      if (vel) free(vel.read, vel.write, pres.read, pres.write, dye.read, dye.write, div, curl)
      const [sw, sh] = grid(128)
      const [dw, dh] = grid(Math.min(720, w, h))
      vel = pair(sw, sh)
      pres = pair(sw, sh)
      div = target(sw, sh)
      curl = target(sw, sh)
      dye = pair(dw, dh)
      simTx = [1 / sw, 1 / sh]
      px = 1.2 / dh
      return true
    }

    // ---------- ink ----------
    let pending: Drop[] = []
    const sequence = (x: number, y: number, at: number, loud = false) => {
      const n = 5 + Math.floor(Math.random() * 4)
      const vermilion = Math.random() < 0.35
      const r = (0.028 + Math.random() * 0.022) * Math.min(1, aspect)
      for (let i = 0; i < n; i++) {
        const ink = i % 2 === 0
        const c = !ink ? [0, 0, 1] : vermilion && i % 4 === 2 ? [0, 1, 1] : [1, 0, 1]
        pending.push({ at: at + i * 120, x, y, r: ink ? r : r * 0.75, c, loud })
      }
      pending.sort((a, b) => a.at - b.at)
    }
    const seed = (at: number) => {
      sequence(0.78, 0.68, at)
      sequence(0.92, 0.24, at + 500)
      sequence(0.3, 0.14, at + 1100)
    }
    const drop = (d: Drop) => {
      P.drop(dye.write, { S: dye.read, p: [d.x, d.y], c: d.c, r: d.r, aspect, px })
      dye.swap()
      if (d.loud) sfx.drop()
    }

    // ---------- the comb ----------
    const splats: number[][] = []
    const stir = () => {
      const a = Math.random() * Math.PI * 2
      const m = 160 + Math.random() * 220
      splats.push([0.15 + Math.random() * 0.7, 0.15 + Math.random() * 0.7, Math.cos(a) * m, Math.sin(a) * m, 0.006])
    }
    const step = (dt: number) => {
      for (const [x, y, dx, dy, r = STYLUS] of splats) {
        P.splat(vel!.write, { S: vel!.read, p: [x, y], c: [dx, dy, 0], r, aspect })
        vel!.swap()
      }
      splats.length = 0
      const v = vel!
      P.curl(curl, { tx: simTx, V: v.read })
      P.vorticity(v.write, { tx: simTx, V: v.read, C: curl, curl: 12, dt })
      v.swap()
      P.divergence(div, { tx: simTx, V: v.read })
      P.scale(pres.write, { S: pres.read, k: 0.8 })
      pres.swap()
      for (let i = 0; i < 20; i++) {
        P.pressure(pres.write, { tx: simTx, P: pres.read, D: div })
        pres.swap()
      }
      P.gradient(v.write, { tx: simTx, P: pres.read, V: v.read })
      v.swap()
      P.advect(v.write, { tx: simTx, V: v.read, S: v.read, dt, keep: Math.exp(-0.9 * dt), sub: [0, 0, 0, 0] })
      v.swap()
      P.advect(dye.write, { tx: simTx, V: v.read, S: dye.read, dt, keep: 1, sub: [0, 0, dt / 14, 0] })
      dye.swap()
    }

    // ---------- colours follow the theme ----------
    let ink = [1, 1, 1], red = [1, 0, 0], look = [0, 0, 0, 0]
    const colors = () => {
      const cs = getComputedStyle(document.documentElement)
      ink = rgb(cs.getPropertyValue('--fg'))
      red = rgb(cs.getPropertyValue('--red'))
      look = document.documentElement.dataset.theme === 'light' ? [0.07, 0.36, 0.1, 0.62] : [0.045, 0.26, 0.1, 0.52]
    }
    const render = () => P.display(null, { D: dye.read, ink, red, look })

    // reduced motion: one still print, no animation
    const still = () => {
      pending = []
      seed(0)
      pending.forEach(drop)
      pending = []
      render()
    }

    // ---------- loop ----------
    let raf = 0, last = 0, nextDrop = 0, nextStir = 0, seeded = false
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame)
      const dt = Math.max(0, Math.min((now - last) / 1000, 1 / 30))
      last = now
      if (!seeded) {
        seed(now)
        seeded = true
        nextDrop = now + 2600
      }
      if (now > nextDrop) {
        sequence(0.08 + Math.random() * 0.84, 0.08 + Math.random() * 0.84, now)
        nextDrop = now + 2600 + Math.random() * 1800
      }
      if (now > nextStir) {
        stir()
        nextStir = now + 1800 + Math.random() * 2200
      }
      while (pending.length && pending[0].at <= now) drop(pending.shift()!)
      step(dt)
      render()
    }

    colors()
    resize()
    if (reduced) still()

    const io = new IntersectionObserver(([e]) => {
      cancelAnimationFrame(raf)
      if (!e.isIntersecting || reduced) return
      last = performance.now()
      raf = requestAnimationFrame(frame)
    })
    io.observe(canvas)
    let t = 0
    const ro = new ResizeObserver(() => {
      clearTimeout(t)
      t = window.setTimeout(() => {
        if (!resize()) return
        seeded = false
        pending = []
        if (reduced) still()
      }, 150)
    })
    ro.observe(canvas)
    const mo = new MutationObserver(() => (colors(), reduced && render()))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })

    let prev: number[] | null = null
    const at = (e: PointerEvent) => {
      const b = canvas.getBoundingClientRect()
      return [(e.clientX - b.left) / b.width, 1 - (e.clientY - b.top) / b.height]
    }
    const move = (e: PointerEvent) => {
      if (reduced) return
      const p = at(e)
      if (prev) splats.push([p[0], p[1], (p[0] - prev[0]) * FORCE * Math.min(1, aspect), ((p[1] - prev[1]) * FORCE) / Math.max(1, aspect)])
      prev = p
    }
    const leave = () => (prev = null)
    const down = (e: PointerEvent) => {
      if (reduced || (e.target as Element).closest('a, button')) return
      const [x, y] = at(e)
      sequence(x, y, performance.now(), true)
    }
    host.addEventListener('pointermove', move)
    host.addEventListener('pointerleave', leave)
    host.addEventListener('pointerdown', down)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(t)
      io.disconnect()
      ro.disconnect()
      mo.disconnect()
      host.removeEventListener('pointermove', move)
      host.removeEventListener('pointerleave', leave)
      host.removeEventListener('pointerdown', down)
    }
  }, [])

  return <canvas ref={ref} className={className} aria-hidden />
}
