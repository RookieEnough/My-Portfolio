import { Suspense, lazy, memo, useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type MouseEvent } from 'react'
import { flushSync } from 'react-dom'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { profile, resume, resumeName, skills, tracks } from './content'
import { audio, sfx } from './audio'
import { rig } from './rig'
import type { KeyInfo, Via } from './Keyboard'
import { Cursor, Mixer, MusicPlayer, Stream, coarse, reduced, webgl, type Cue } from './ui'
import { Contact, Footer, Hire, Log, ModelCard, SectionHead, Systems, Work } from './sections'
import { Download, Moon, PullRequest, Sun } from './icons'
import { LogoMark } from './brands'

// memo: opening the site re-renders App, and an unchanged board shouldn't redraw its whole 3D tree mid-transition
const Keyboard = lazy(() => import('./Keyboard').then((m) => ({ default: memo(m.default) })))
const Sakura = lazy(() => import('./Sakura'))

// Wide screens: the keyboard flies from the hero into the toolkit (without motion it just stays in the hero).
// Tall screens (phones, portrait tablets): there is no room beside the hero copy, so it sits inline in the toolkit.
// Same breakpoint the 3D pose uses for portrait.
const tall = matchMedia('(max-aspect-ratio: 9/10)')
const subTall = (f: () => void) => (tall.addEventListener('change', f), () => tall.removeEventListener('change', f))
const usePortrait = () => useSyncExternalStore(subTall, () => tall.matches)

// the board crosses the toolkit title on its way down, so in flight the title waits until it has landed
const LANDED: Cue = { trigger: '#toolkit', start: 'top 6%' }

const LETTERS = 'QWERTYUIOPASDFGHJKLZXCVBNM'
const NAV: [id: string, label: string][] = [
  ['toolkit', 'Stack'],
  ['work', 'Work'],
  ['systems', 'Systems'],
  ['experience', 'Experience'],
  ['hire', 'Hire me'],
]

let lenis: Lenis | null = null
const go = (id: string) => {
  const el = document.getElementById(id)
  if (!el) return
  if (lenis) lenis.scrollTo(el, { duration: 1.6 })
  else el.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth' })
}
const goLink = (id: string) => (e: MouseEvent) => {
  e.preventDefault()
  go(id)
}

// the last key touched lives outside React state, so a hover re-renders the readouts and nothing else
let touched: KeyInfo | null = null
const keySubs = new Set<() => void>()
const showKey = (k: KeyInfo) => {
  if (k === touched) return
  touched = k
  keySubs.forEach((f) => f())
}
const subKey = (f: () => void) => (keySubs.add(f), () => void keySubs.delete(f))

// A fixed, bottom-anchored box: in the hero a readout that grew with each note changed the page height, the browser's
// scroll anchoring nudged scrollY to compensate, and the keyboard (flown by scroll) jumped on every hover
function Readout() {
  const k = useSyncExternalStore(subKey, () => touched)
  return (
    <div className="flex h-[7.5rem] max-w-xs flex-col justify-end overflow-hidden text-right" aria-live="polite">
      {k ? (
        <>
          <p className="meta flex items-baseline justify-end gap-2 text-muted">
            <span className="kbd text-fg">{k.letter ?? k.name}</span>
            {k.kana && <span className="jp">{k.kana}</span>}
          </p>
          <p className="mt-2 flex items-center justify-end gap-2.5 text-2xl font-[800] leading-none [font-stretch:78%] uppercase">
            {k.logo && (
              <span className="tool-chip" style={{ background: k.color, color: k.ink }} aria-hidden>
                <LogoMark logo={k.logo} className="size-full" />
              </span>
            )}
            {k.name}
          </p>
          {k.note && <p className="mt-1.5 line-clamp-3 text-sm leading-snug text-muted">{k.note}</p>}
        </>
      ) : (
        <p className="meta text-muted">{coarse ? 'Tap' : 'Hover or type on'} the keyboard. Every key is a tool I use.</p>
      )}
    </div>
  )
}

// 100vw rather than inset-0: when the page unlocks, its scrollbar slides over the gate's edge instead of narrowing it
// (which moved everything on it and redrew the sakura canvas mid-transition)
function Gate({ onEnter, dark, onToggleTheme }: { onEnter: (sound: boolean) => void; dark: boolean; onToggleTheme: () => void }) {
  return (
    <div id="gate" data-solid role="dialog" aria-modal="true" aria-labelledby="gate-title" className="fixed inset-y-0 left-0 z-[90] w-screen flex flex-col justify-between gap-8 overflow-hidden bg-bg px-5 pt-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] md:px-8">
      <Suspense fallback={null}>
        <Sakura />
      </Suspense>
      {/* a soft scrim down the left keeps the copy legible over the canopy */}
      <div aria-hidden className="gate-scrim pointer-events-none absolute inset-0" />
      <div className="meta relative flex items-center justify-between text-muted">
        <span>{profile.alias} · portfolio</span>
        <div className="flex items-center gap-4">
          <button onClick={onToggleTheme} className="grid size-10 place-items-center rounded-full border border-line bg-bg/50 backdrop-blur transition-colors hover:border-red hover:text-fg" aria-label={dark ? 'Switch to light mode (sunrise)' : 'Switch to dark mode (moonrise)'} data-cursor={dark ? 'light' : 'dark'}>
            {dark ? <Sun /> : <Moon />}
          </button>
          <span>{new Date().getFullYear()}</span>
        </div>
      </div>
      <div className="relative max-md:mt-auto">
        <p className="jp text-2xl md:text-3xl">ようこそ</p>
        <h2 id="gate-title" className="h-sec mt-4 max-w-[12ch]">
          This site has sound.
        </h2>
        <p className="body mt-5 max-w-md">
          Mechanical key clicks, split-flap boards and {tracks.length ? 'my current playlist' : 'a lo-fi loop composed live in your browser'}. Headphones recommended.
        </p>
        {/* the audio device opens while the button is held, so the click that starts the transition has less to do
            (a mouse press is a user gesture; a touch only becomes one when the finger lifts) */}
        <div className="mt-10 flex flex-wrap gap-3" onPointerDown={(e) => e.pointerType === 'mouse' && audio.warm()} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && audio.warm()}>
          <button autoFocus onClick={() => onEnter(true)} className="key-btn primary">
            Enter with sound <span aria-hidden>↵</span>
          </button>
          <button onClick={() => onEnter(false)} className="key-btn">
            Enter muted
          </button>
        </div>
      </div>
      <div className="meta relative flex justify-between text-muted">
        <span>{profile.name}</span>
        <span className="hidden sm:inline">{profile.roles.slice(0, 2).join(' · ')}</span>
      </div>
    </div>
  )
}

// the sections below the toolkit never take props, so as one constant element React skips them on every App render
// (opening the site renders App twice, once at the click and once when the gate leaves)
const SECTIONS = (
  <>
    <Work />
    <Systems />
    <Log />
    <ModelCard />
    <Hire />
    <Contact />
    <Footer />
  </>
)

export default function App() {
  const [entered, setEntered] = useState(false)
  const [gate, setGate] = useState(true)
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme !== 'light')
  const hero = useRef<HTMLElement>(null)
  const toolkit = useRef<HTMLElement>(null)
  const heroTail = useRef<HTMLDivElement>(null)
  const enteredRef = useRef(false)
  const portrait = usePortrait()
  const inline = webgl && portrait
  const travel = webgl && !reduced && !portrait

  // smooth scroll on GSAP's ticker so ScrollTrigger and Lenis share one clock
  useEffect(() => {
    history.scrollRestoration = 'manual'
    scrollTo(0, 0)
    if (reduced) return
    const l = new Lenis({ lerp: 0.1 })
    lenis = l
    if (!enteredRef.current) l.stop()
    l.on('scroll', ScrollTrigger.update)
    const raf = (t: number) => l.raf(t * 1000)
    gsap.ticker.add(raf)
    gsap.ticker.lagSmoothing(0)
    return () => {
      gsap.ticker.remove(raf)
      l.destroy()
      lenis = null
    }
  }, [])

  useEffect(() => {
    const root = document.documentElement
    if (!entered) return void (root.style.overflow = 'hidden')
    // Unlocked the page narrows by a scrollbar and all of it is laid out again (about 20 ms), so that waits for the
    // frame after the opening click instead of piling onto it; the gate's wipe is still at its slow start then
    const id = requestAnimationFrame(() =>
      setTimeout(() => {
        root.style.overflow = ''
        lenis?.start()
      }),
    )
    return () => cancelAnimationFrame(id)
  }, [entered])

  // a soft notch every so far the page travels, like the detents of a wheel; quicker scrolls click higher
  useEffect(() => {
    const NOTCH = 110 // px
    let last = scrollY
    let run = 0
    const on = () => {
      const d = Math.abs(scrollY - last)
      last = scrollY
      if (!enteredRef.current || (run += d) < NOTCH) return
      run %= NOTCH
      sfx.scroll(Math.min(1, d / 90))
    }
    addEventListener('scroll', on, { passive: true })
    return () => removeEventListener('scroll', on)
  }, [])

  // the fixed keyboard's flight (or, without motion, when it's on screen); inline it watches itself
  useLayoutEffect(() => {
    if (!webgl || inline) return
    const ctx = gsap.context(() => {
      if (travel) {
        let into: ScrollTrigger | undefined
        let out: ScrollTrigger | undefined
        const update = () => {
          rig.p = (into?.progress ?? 0) + (out?.progress ?? 0)
          rig.wake()
          rig.show(rig.p < 1.98)
        }
        into = ScrollTrigger.create({ trigger: toolkit.current, start: 'top bottom', end: 'top top', onUpdate: update, onRefresh: update })
        out = ScrollTrigger.create({ trigger: toolkit.current, start: 'bottom bottom', end: 'bottom top', onUpdate: update, onRefresh: update })
        // the hero's status lines sit just under the board, which drifts down slower than they scroll up
        gsap.to(heroTail.current, { autoAlpha: 0, ease: 'none', scrollTrigger: { trigger: toolkit.current, start: 'top bottom', end: 'top 90%', scrub: true } })
      } else {
        ScrollTrigger.create({ trigger: hero.current, start: 'top top', end: 'bottom top', onLeave: () => rig.show(false), onEnterBack: () => rig.show(true) })
      }
    })
    ScrollTrigger.refresh()
    return () => ctx.revert()
  }, [travel, inline])

  // scroll choreography
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      // nav gets a solid bar once content starts sliding under it
      ScrollTrigger.create({ start: 120, end: 'max', toggleClass: { targets: '.nav', className: 'stuck' } })
      if (!reduced) {
        gsap.set('.hero-name .line', { yPercent: 110 })
        gsap.set('.hero-fade, .nav', { opacity: 0, y: 16 })
        gsap.to('.hero-name', { yPercent: -16, ease: 'none', scrollTrigger: { trigger: hero.current, start: 'top top', end: 'bottom top', scrub: true } })
      }
    })
    document.fonts.ready.then(() => ScrollTrigger.refresh())
    return () => ctx.revert()
  }, [])

  // looping CSS (floating meishi, marquee, pipeline packets) still costs a style pass on every frame the page draws,
  // even far off screen, so a section's loops are parked while it is out of view
  useEffect(() => {
    const io = new IntersectionObserver((es) => es.forEach((e) => e.target.toggleAttribute('data-off', !e.isIntersecting)), { rootMargin: '200px 0px' })
    document.querySelectorAll('main > section, footer').forEach((s) => io.observe(s))
    return () => io.disconnect()
  }, [])

  // UI sounds for every link and button
  useEffect(() => {
    const ui = (t: EventTarget | null) => (t as Element | null)?.closest?.('a, button') ?? null
    const down = (e: PointerEvent) => ui(e.target) && sfx.click()
    const over = (e: PointerEvent) => {
      const el = ui(e.target)
      if (el && el !== ui(e.relatedTarget)) sfx.tick()
    }
    window.addEventListener('pointerdown', down)
    window.addEventListener('pointerover', over)
    return () => {
      window.removeEventListener('pointerdown', down)
      window.removeEventListener('pointerover', over)
    }
  }, [])

  const enter = (sound: boolean) => {
    audio.unlock(sound)
    sfx.whoosh()
    enteredRef.current = true
    setEntered(true)
    if (reduced) {
      rig.intro = performance.now() / 1000 - 100
      rig.wake()
      return setGate(false)
    }
    rig.intro = performance.now() / 1000 + 0.55
    rig.wake()
    dispatchEvent(new Event('gate-enter'))
    gsap
      .timeline({ onComplete: () => setGate(false) })
      .to('#gate', { clipPath: 'inset(0 0 100% 0)', duration: 1, ease: 'expo.inOut' })
      .to('.gate-sakura', { yPercent: -10, scale: 1.08, duration: 1, ease: 'expo.inOut' }, 0)
      .to('.hero-name .line', { yPercent: 0, duration: 1.2, ease: 'expo.out', stagger: 0.09 }, 0.55)
      .to('.hero-fade, .nav', { opacity: 1, y: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06 }, 0.8)
  }

  const onKey = useCallback((k: KeyInfo, via: Via) => {
    if (!enteredRef.current) return
    showKey(k)
    if (k.code === 'Enter' && (via === 'pointer' || (via === 'keyboard' && document.activeElement === document.body))) go('contact')
  }, [])

  const applyTheme = (next: 'light' | 'dark') => {
    const root = document.documentElement
    root.dataset.theme = next
    localStorage.setItem('theme', next)
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', next === 'dark' ? '#0d0d0c' : '#efeae0')
    setDark(next === 'dark')
  }

  const toggleTheme = (e: MouseEvent<HTMLButtonElement>) => {
    const next = dark ? 'light' : 'dark'
    const r = e.currentTarget.getBoundingClientRect()
    const root = document.documentElement
    root.style.setProperty('--vt-x', `${r.left + r.width / 2}px`)
    root.style.setProperty('--vt-y', `${r.top + r.height / 2}px`)
    sfx.toggle()
    if (document.startViewTransition && !reduced) document.startViewTransition(() => flushSync(() => applyTheme(next)))
    else applyTheme(next)
  }

  // on the gate the sakura canvas owns the transition (moon/sun slide), so skip the page view-transition
  const gateToggle = () => {
    sfx.toggle()
    applyTheme(dark ? 'light' : 'dark')
  }

  const [first, ...last] = profile.name.split(' ')
  const caption = (
    <>
      {skills.length} keys, {skills.length} tools. From frontier models to the Linux box they run on. <span className="kbd">↵</span> says hi.
    </>
  )

  return (
    <>
      {webgl && !inline && (
        <Suspense fallback={null}>
          <Keyboard dark={dark} onKey={onKey} />
        </Suspense>
      )}
      <Cursor />
      {gate && <Gate onEnter={enter} dark={dark} onToggleTheme={gateToggle} />}

      {/* a step above the music deck (z-50), so the mixer drops over a disc parked on the top edge */}
      <nav className="nav fixed inset-x-0 top-0 z-[51] flex items-center justify-between bg-linear-to-b from-bg/90 to-transparent px-5 py-4 md:px-8" aria-label="Main">
        <a href="#top" onClick={goLink('top')} className="flex items-baseline gap-2 text-xl font-[850] [font-stretch:72%] uppercase">
          {profile.alias} <span className="jp text-sm">ルーキー</span>
        </a>
        <ul className="meta hidden gap-6 md:flex lg:gap-8">
          {NAV.map(([id, label]) => (
            <li key={id}>
              <a href={`#${id}`} onClick={goLink(id)} className={'transition-colors hover:text-red' + (id === 'hire' ? ' text-red' : '')}>
                {label}
              </a>
            </li>
          ))}
        </ul>
        <div className="flex gap-2 text-[17px]">
          {resume && (
            <a href={resume} download={resumeName} className="meta flex h-10 items-center gap-2 rounded-full border border-line bg-bg/60 px-4 backdrop-blur transition-colors hover:border-red hover:text-red" data-cursor="pdf" aria-label="Download résumé (PDF)">
              <span className="hidden sm:inline">Résumé</span>
              <span className="sm:hidden">CV</span> <Download />
            </a>
          )}
          <Mixer />
          <button onClick={toggleTheme} className="grid size-10 place-items-center rounded-full border border-line bg-bg/60 backdrop-blur" aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'} data-cursor={dark ? 'light' : 'dark'}>
            {dark ? <Sun /> : <Moon />}
          </button>
        </div>
      </nav>

      <main className="relative z-10">
        <section ref={hero} id="top" className="relative flex min-h-svh flex-col px-5 pt-28 pb-24 md:px-8 md:pt-32 md:pb-8">
          <a href="#hire" onClick={goLink('hire')} className="hero-fade group mb-5 flex w-fit items-center gap-3" data-cursor="hire">
            <span className="pr-state">
              <PullRequest /> {profile.hire.badge}
            </span>
            <span className="meta text-muted transition-colors group-hover:text-fg">{profile.hire.looking} →</span>
          </a>
          <p className="hero-fade meta flex flex-wrap gap-x-3 gap-y-1 text-muted">
            {profile.roles.map((r, i) => (
              <span key={r}>
                {i > 0 && <span className="mr-3 text-red">/</span>}
                {r}
              </span>
            ))}
          </p>
          <h1 className="hero-name h-name mt-6">
            <span className="sr-only">{profile.name}</span>
            <span aria-hidden className="block overflow-clip pb-[0.04em]">
              <span className="line block">{first}</span>
            </span>
            <span aria-hidden className="block overflow-clip pb-[0.04em]">
              <span className="line block">{last.join(' ')}</span>
            </span>
          </h1>
          <div className="mt-8 max-w-[34rem]">
            <Stream text={profile.hero.lead} start={entered} className="body !text-lg md:!text-xl" />
            <div className="hero-fade mt-8 flex flex-wrap gap-3">
              <a href="#hire" onClick={goLink('hire')} className="key-btn primary">
                Hire me <span aria-hidden>↵</span>
              </a>
              {resume && (
                <a href={resume} download={resumeName} className="key-btn" data-cursor="pdf">
                  Résumé <Download />
                </a>
              )}
              <a href="#work" onClick={goLink('work')} className="key-btn">
                See the work <span aria-hidden>↓</span>
              </a>
            </div>
          </div>
          <span aria-hidden className="hero-fade jp vertical absolute top-32 right-5 hidden text-xl md:right-8 lg:block">
            {profile.nameJapanese}
          </span>
          {/* right-aligned so the fixed music deck owns the bottom-left corner */}
          <div className="hero-fade mt-auto pt-10">
            {/* readout above the status line, so its reserved room opens upward into the hero's empty middle */}
            <div ref={heroTail} className="flex flex-col items-end gap-4 text-right">
              {webgl && !inline && <Readout />}
              <p className="meta text-muted">
                status: <span className="text-fg">{profile.status}</span>
              </p>
            </div>
          </div>
        </section>

        <section ref={toolkit} id="toolkit" className={travel ? 'relative h-[200vh]' : 'relative bg-bg'} data-solid={travel ? undefined : true}>
          <div className={travel ? 'sticky top-0 flex h-svh flex-col px-5 pt-24 pb-8 md:px-8' : inline ? 'px-5 pt-24 pb-16 md:px-8' : 'px-5 py-32 md:px-8'}>
            <SectionHead n="01" label="Toolkit" jp="道具" title="Every key is a tool I *actually* use." cue={travel ? LANDED : undefined} />
            {travel ? (
              // right-aligned like the hero: the fixed music deck owns the bottom-left corner
              <div className="mt-auto flex items-end justify-end gap-10">
                <p className="meta max-w-sm text-muted">{caption}</p>
                <Readout />
              </div>
            ) : inline ? (
              <>
                <p className="meta mt-6 max-w-xs text-muted">{caption}</p>
                <Suspense fallback={<div className="kb-inline -mx-5 md:-mx-8" />}>
                  <Keyboard inline dark={dark} onKey={onKey} />
                </Suspense>
                <div className="flex justify-end">
                  <Readout />
                </div>
              </>
            ) : null}
            <ul className={travel || inline ? 'sr-only' : 'grid gap-3 sm:grid-cols-2 lg:grid-cols-3'}>
              {skills.map((s, i) => (
                <li key={s.name} className="flex gap-4 rounded-xl border border-line p-4">
                  <span className="kbd h-fit text-muted" aria-hidden>
                    {LETTERS[i]}
                  </span>
                  <div>
                    <p className="font-[750]">{s.name}</p>
                    <p className="text-sm text-muted">{s.note}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>

        {SECTIONS}
      </main>
      <MusicPlayer shown={entered} />
    </>
  )
}
