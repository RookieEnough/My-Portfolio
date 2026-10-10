// The 3D compact disc in the music player: a 90s Discman with the lid open.
// Spins up when music plays, coasts to a stop when it pauses, and the rainbow
// shimmers with the bass.
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Environment, Lightformer } from '@react-three/drei'
import * as THREE from 'three'
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { audio } from './audio'
import { profile } from './content'

const HOLE = 0.2
const T = 0.03 // disc thickness
const RPS = 100 / 3 / 60 // a lazy 33⅓ rpm, slow enough to read the label as it turns

// circular grooves: anisotropy runs along the tangent, which gives a CD its radial light streak
function grooveMap() {
  const n = 256
  const data = new Uint8Array(n * n * 4)
  for (let y = 0; y < n; y++)
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n - 0.5
      const v = (y + 0.5) / n - 0.5
      const r = Math.hypot(u, v) || 1
      const i = (y * n + x) * 4
      data[i] = ((-v / r) * 0.5 + 0.5) * 255
      data[i + 1] = ((u / r) * 0.5 + 0.5) * 255
      data[i + 2] = 255
      data[i + 3] = 255
    }
  const t = new THREE.DataTexture(data, n, n)
  t.needsUpdate = true
  return t
}

// printed label: crimson outer band with lettering, a big ink 音, and the track title
function labelTexture(title: string) {
  const S = 1024
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  const C = S / 2
  const R = (f: number) => f * C
  g.translate(C, C)

  g.fillStyle = '#c62a32'
  g.beginPath()
  g.arc(0, 0, R(0.985), 0, Math.PI * 2)
  g.arc(0, 0, R(0.8), 0, Math.PI * 2, true)
  g.fill()

  const ring = `${profile.alias.toUpperCase()} FM · VOL.01 · PROMPTS IN → PRODUCTS OUT · ルーキー · `
  g.fillStyle = '#f4efe6'
  g.font = `700 ${R(0.075)}px "JetBrains Mono Variable", monospace`
  g.textBaseline = 'middle'
  const chars = [...ring.repeat(2)]
  const step = (Math.PI * 2) / chars.length
  chars.forEach((ch, i) => {
    g.save()
    g.rotate(i * step)
    g.translate(0, -R(0.89))
    g.fillText(ch, -g.measureText(ch).width / 2, 0)
    g.restore()
  })

  // ink block with the kanji, like a hand-printed promo disc
  g.save()
  g.rotate(-0.5)
  g.fillStyle = '#141412'
  g.beginPath()
  g.arc(0, 0, R(0.76), -0.55, 0.55)
  g.arc(0, 0, R(0.42), 0.55, -0.55, true)
  g.closePath()
  g.fill()
  g.fillStyle = '#f4efe6'
  g.font = `800 ${R(0.26)}px "Shippori Mincho B1", serif`
  g.textAlign = 'center'
  g.translate(R(0.59), 0)
  g.rotate(Math.PI / 2)
  g.fillText('音', 0, R(0.02))
  g.restore()

  g.fillStyle = '#141412'
  g.textAlign = 'center'
  g.font = `800 condensed ${R(0.1)}px "Archivo Variable", sans-serif`
  const t = title.length > 22 ? title.slice(0, 21) + '…' : title
  g.save()
  g.rotate(2.2)
  g.fillText(t.toUpperCase(), 0, R(0.62))
  g.font = `600 ${R(0.045)}px "JetBrains Mono Variable", monospace`
  g.fillText('DIGITAL AUDIO · 74 MIN · SIDE A', 0, R(0.72))
  g.restore()

  return canvasTexture(c)
}

// a picture disc: the song's cover art printed across the whole label, cropped to the circle
function pictureTexture(img: HTMLImageElement) {
  const S = 1024
  const C = S / 2
  const c = document.createElement('canvas')
  c.width = c.height = S
  const g = c.getContext('2d')!
  g.beginPath()
  g.arc(C, C, C, 0, Math.PI * 2)
  g.clip()
  // fill the disc whatever the image's shape, centred
  const k = S / Math.min(img.naturalWidth, img.naturalHeight)
  const w = img.naturalWidth * k
  const h = img.naturalHeight * k
  g.drawImage(img, (S - w) / 2, (S - h) / 2, w, h)
  // printed on plastic: the ink falls off a little at the hub and the rim, so the art sits on the disc
  const hub = 0.36 / 0.985
  const shade = g.createRadialGradient(C, C, C * hub, C, C, C)
  shade.addColorStop(0, 'rgba(0,0,0,0.38)')
  shade.addColorStop(0.1, 'rgba(0,0,0,0)')
  shade.addColorStop(0.88, 'rgba(0,0,0,0)')
  shade.addColorStop(1, 'rgba(0,0,0,0.4)')
  g.fillStyle = shade
  g.fillRect(0, 0, S, S)
  // the silver edge where the print stops
  g.strokeStyle = 'rgba(255,255,255,0.45)'
  g.lineWidth = 4
  g.beginPath()
  g.arc(C, C, C * hub + 2, 0, Math.PI * 2)
  g.stroke()
  return canvasTexture(c)
}

function canvasTexture(c: HTMLCanvasElement) {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

function discGeometry() {
  const s = new THREE.Shape().absarc(0, 0, 1, 0, Math.PI * 2, false)
  s.holes.push(new THREE.Path().absarc(0, 0, HOLE, 0, Math.PI * 2, true))
  const g = new THREE.ExtrudeGeometry(s, { depth: T, bevelEnabled: false, curveSegments: 128 })
  g.translate(0, 0, -T / 2)
  // planar UVs in 0..1 so the groove map lines up with the centre
  const pos = g.attributes.position
  const uv = g.attributes.uv
  for (let i = 0; i < uv.count; i++) uv.setXY(i, pos.getX(i) * 0.5 + 0.5, pos.getY(i) * 0.5 + 0.5)
  return g
}

// x/y lean the disc (-0.5..0.5 from the pointer, more when it's flung), wake asks for a frame,
// kick(v) whirls it by v rad/s on top of its spin (opening the player, landing after a drag)
export type Tilt = { x: number; y: number; wake: () => void; kick: (v: number) => void }
type DiscProps = { playing: boolean; title: string; cover?: string; tilt: RefObject<Tilt> }

function CD({ playing, title, cover, tilt }: DiscProps) {
  const invalidate = useThree((s) => s.invalidate)
  const speed = useRef(0)
  // leaning over a paused disc still tilts it, so the pointer asks for frames too
  useEffect(() => {
    const t = tilt.current
    t.wake = invalidate
    t.kick = (v) => {
      speed.current += v
      invalidate()
    }
    return () => void ((t.wake = () => {}), (t.kick = () => {}))
  }, [tilt, invalidate])
  const spin = useRef<THREE.Group>(null!)
  const rig = useRef<THREE.Group>(null!)
  const level = useRef(0)
  const data = useRef<Uint8Array<ArrayBuffer> | null>(null)
  const geo = useMemo(discGeometry, [])
  const grooves = useMemo(grooveMap, [])
  const [fonts, setFonts] = useState(false)
  useEffect(() => void document.fonts.ready.then(() => setFonts(true)), [])
  // the next track's art keeps the old picture on the disc until it has decoded, so a skip never flashes
  const [art, setArt] = useState<HTMLImageElement | null>(null)
  useEffect(() => {
    if (!cover) return
    let live = true
    const img = new Image()
    img.src = cover
    img
      .decode()
      .then(() => live && setArt(img))
      .catch(() => console.warn(`[music] could not load the cover ${cover}`))
    return () => void (live = false)
  }, [cover])
  const picture = cover ? art : null
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const label = useMemo(() => (picture ? pictureTexture(picture) : labelTexture(title)), [picture, title, fonts])
  useEffect(() => () => label.dispose(), [label])
  useEffect(() => () => (geo.dispose(), grooves.dispose()), [geo, grooves])

  const body = useMemo(
    () =>
      new THREE.MeshPhysicalMaterial({
        color: '#e8e8ea',
        metalness: 1,
        roughness: 0.2,
        iridescence: 1,
        iridescenceIOR: 1.8,
        iridescenceThicknessRange: [200, 700],
        anisotropy: 1,
        anisotropyMap: grooves,
        clearcoat: 1,
        clearcoatRoughness: 0.06,
      }),
    [grooves],
  )
  useEffect(() => () => body.dispose(), [body])

  // skipping a track whips the disc round, like a CD player seeking
  const firstTitle = useRef(true)
  useEffect(() => {
    if (firstTitle.current) return void (firstTitle.current = false)
    speed.current += 7
    invalidate()
  }, [title, invalidate])
  useEffect(() => invalidate(), [playing, invalidate])

  useFrame((_, dt) => {
    const h = Math.min(dt, 1 / 30)
    const target = playing ? RPS * Math.PI * 2 : 0
    speed.current += (target - speed.current) * (1 - Math.exp(-(playing ? 1.6 : 0.9) * h))
    spin.current.rotation.z -= speed.current * h

    const an = audio.analyser
    let bass = 0
    if (an && playing) {
      data.current ??= new Uint8Array(an.frequencyBinCount)
      an.getByteFrequencyData(data.current)
      bass = (data.current[2] + data.current[3] + data.current[4]) / 765
    }
    level.current += (bass - level.current) * (1 - Math.exp(-10 * h))
    body.iridescenceThicknessRange[1] = 700 + level.current * 500

    const t = tilt.current
    const k = 1 - Math.exp(-6 * h)
    rig.current.rotation.x += (-0.98 + t.y * 0.35 - rig.current.rotation.x) * k
    rig.current.rotation.y += (t.x * 0.4 - rig.current.rotation.y) * k
    rig.current.position.y += (level.current * 0.04 - rig.current.position.y) * k

    const settling = Math.abs(rig.current.rotation.x + 0.98 - t.y * 0.35) > 0.001 || Math.abs(rig.current.rotation.y - t.x * 0.4) > 0.001
    if (playing || speed.current > 0.02 || settling) invalidate()
  })

  return (
    <group ref={rig} rotation={[-0.98, 0, 0.18]}>
      {/* the Discman well and spindle */}
      <mesh position={[0, 0, -0.07]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[1.12, 1.12, 0.06, 96]} />
        <meshStandardMaterial color="#121211" roughness={0.85} />
      </mesh>
      <mesh position={[0, 0, -0.04]}>
        <torusGeometry args={[1.12, 0.035, 12, 96]} />
        <meshStandardMaterial color="#2b2a27" metalness={0.6} roughness={0.35} />
      </mesh>
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 0.01]}>
        <cylinderGeometry args={[0.11, 0.11, 0.09, 32]} />
        <meshStandardMaterial color="#8b867a" metalness={0.9} roughness={0.25} />
      </mesh>
      <group ref={spin}>
        <mesh geometry={geo} material={body} />
        {/* clear plastic hub */}
        <mesh position={[0, 0, T / 2 + 0.0005]}>
          <ringGeometry args={[HOLE, 0.34, 96]} />
          <meshPhysicalMaterial color="#d6d6d6" metalness={0.2} roughness={0.08} transparent opacity={0.35} clearcoat={1} />
        </mesh>
        <mesh position={[0, 0, T / 2 + 0.001]}>
          <ringGeometry args={[0.36, 0.985, 128, 1]} />
          <meshStandardMaterial map={label} transparent roughness={0.45} metalness={0.05} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      </group>
    </group>
  )
}

// a single element, so play/pause and track changes don't hand drei new children and re-shoot the reflections
const ENV = (
  <Environment resolution={128} frames={1}>
    <Lightformer intensity={3} position={[0, 3, 3]} scale={[6, 0.5, 1]} rotation={[-Math.PI / 4, 0, 0]} />
    <Lightformer intensity={2} position={[-3, 0, 2]} scale={[0.5, 6, 1]} rotation={[0, Math.PI / 3, 0]} />
    <Lightformer intensity={1.5} position={[3, -1, 2]} scale={[0.6, 4, 1]} rotation={[0, -Math.PI / 3, 0]} color="#e0343c" />
    <Lightformer intensity={1} position={[0, -3, 1]} scale={[5, 1, 1]} rotation={[Math.PI / 3, 0, 0]} />
  </Environment>
)

export default function Disc({ playing, title, cover, tilt }: DiscProps) {
  return (
    <Canvas
      frameloop="demand"
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true }}
      camera={{ position: [0, 0, 4.4], fov: 32 }}
      // size from the layout box: the press/lift scale on the disc must not grow the drawing past
      // its clipped frame (it got cut off on one side), and a fixed element never needs scroll offsets
      resize={{ offsetSize: true, scroll: false }}
      style={{ pointerEvents: 'none' }}
      aria-hidden
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[2, 3, 4]} intensity={1.2} />
      {ENV}
      <CD playing={playing} title={title} cover={cover} tilt={tilt} />
    </Canvas>
  )
}
