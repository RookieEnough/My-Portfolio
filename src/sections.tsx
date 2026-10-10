import { Fragment, useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode } from 'react'
import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import { avatar, experience, profile, projects, resume, resumeName, systems, type Project } from './content'
import { sfx, useAudio } from './audio'
import { ArrowUpRight, Check, Copy, Download, Merge, PullRequest } from './icons'
import { Reveal, SplitFlap, coarse, reduced, webgl, type Cue } from './ui'
import { EngraveFilter, LogoMark, socialLogo, type Logo } from './brands'
import Fluid from './Fluid'

const KANJI = '〇一二三四五六七八九'
const kanji = (n: number) => (n <= 10 ? (n === 10 ? '十' : KANJI[n]) : (n >= 20 ? KANJI[Math.floor(n / 10)] : '') + '十' + (n % 10 ? KANJI[n % 10] : ''))
const pad = (n: number) => String(n).padStart(2, '0')

export function SectionHead({ n, label, jp, title, cue }: { n: string; label: string; jp: string; title: string; cue?: Cue }) {
  return (
    <header className="mb-14 grid gap-6 md:mb-20 md:grid-cols-12">
      <p className="meta flex items-baseline gap-3 text-muted md:col-span-3">
        <span className="text-fg">{n}</span> / {label} <span className="jp text-base">{jp}</span>
      </p>
      <Reveal text={title} cue={cue} className="h-sec md:col-span-9" />
    </header>
  )
}

// the featured title, split so its letters can land one by one; the whole word is what gets read
const Letters = ({ text }: { text: string }) => (
  <>
    <span className="sr-only">{text}</span>
    {text.split(' ').map((w, i) => (
      <Fragment key={i}>
        {i > 0 && ' '}
        <span aria-hidden className="inline-block whitespace-nowrap">
          {[...w].map((c, j) => (
            <span key={j} className="tc-l inline-block">
              {c}
            </span>
          ))}
        </span>
      </Fragment>
    ))}
  </>
)

// Evangelion-style episode title card, used when a project has no cover image
function TitleCard({ p, n, big }: { p: Project; n: number; big?: boolean }) {
  if (p.cover) return <img src={p.cover} alt="" className="size-full object-cover" />
  return (
    <div className="title-card @container size-full p-[6%]">
      <div data-tc="top" className="flex items-start justify-between" style={{ fontSize: '4.2cqw' }}>
        <span>EPISODE:{n}</span>
        <span className="meta text-[#8f8a7f]" style={{ fontSize: big ? '1.8cqw' : '2.6cqw' }}>{p.year}</span>
      </div>
      <div className="t uppercase" style={{ fontSize: p.title.length > 12 ? '10.5cqw' : '14cqw' }}>
        {big ? <Letters text={p.title} /> : p.title}
      </div>
      <div data-tc="foot" className="flex items-end justify-between gap-4" style={{ fontSize: '4.6cqw' }}>
        <span>第{kanji(n)}話</span>
        <span className="max-w-[60%] text-right font-[500]" style={{ fontSize: '2.8cqw' }}>
          {p.tagline}
        </span>
      </div>
    </div>
  )
}

const Links = ({ p }: { p: Project }) => (
  <div className="flex flex-wrap gap-3">
    {p.links?.map((l, i) => (
      <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className={'key-btn' + (i === 0 ? ' primary' : '')}>
        {l.label} <ArrowUpRight />
      </a>
    ))}
  </div>
)

// ---------- work, as episodes ----------
export function Work() {
  const [featured, ...rest] = [...projects.filter((p) => p.featured), ...projects.filter((p) => !p.featured)]
  const tilt = useRef<HTMLDivElement>(null)
  const plate = useRef<HTMLDivElement>(null)
  const card = useRef<HTMLDivElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const preview = useRef<HTMLDivElement>(null)
  const [hovered, setHovered] = useState(-1)

  useLayoutEffect(() => {
    if (reduced) return
    let off = () => {}
    const ctx = gsap.context(() => {
      const c = card.current
      const t = tilt.current
      if (c && t) {
        const tc = c.querySelector<HTMLElement>('.title-card')
        // The card never moves; it unrolls in place like a hanging scroll. A thin rod draws out along its top edge
        // from the centre, the picture rolls down from it while the shot inside settles out of a slight zoom.
        // Played once on a clock rather than scrubbed, so it runs the same however the wheel is spun.
        // The shadow lives on a plate behind the card (the clip-path would cut it off) and comes up last.
        const tl = gsap
          .timeline({ scrollTrigger: { trigger: t, start: 'top 72%', once: true } })
          .fromTo(c, { clipPath: 'inset(0% 50% 99.4% 50% round 2px)' }, { clipPath: 'inset(0% 0% 99.4% 0% round 2px)', duration: 0.45, ease: 'power3.inOut' })
          .to(c, { clipPath: 'inset(0% 0% 0% 0% round 12px)', duration: 1.3, ease: 'power3.inOut' })
          .from(c.firstElementChild, { scale: 1.15, duration: 1.9, ease: 'expo.out' }, 0.45) // the title card, or a cover image
          .from(plate.current, { opacity: 0, duration: 0.8, ease: 'power2.out' }, 1.3)
        // Then each row of the title card plays its beat: the header drops in, the letters land one by one, the
        // footer follows. The card can be taller than the window, so a row waits until it is both unrolled and on
        // screen; otherwise its moment would play out below the fold.
        if (tc) {
          const q = gsap.utils.selector(tc)
          const beat = (sel: string, unrolled: number, vars: gsap.TweenVars) => {
            const els = q(sel)
            if (!els.length) return
            const tw = gsap.from(els, { ...vars, paused: true })
            let n = 0
            const go = () => ++n === 2 && tw.play()
            tl.call(go, [], unrolled)
            ScrollTrigger.create({ trigger: els[0], start: 'top 94%', once: true, onEnter: go })
          }
          beat('[data-tc=top] > *', 0.55, { y: -16, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08 })
          beat('.tc-l', 1.05, { yPercent: 60, opacity: 0, filter: 'blur(8px)', duration: 1, ease: 'expo.out', stagger: 0.04, clearProps: 'filter' })
          beat('[data-tc=foot] > *', 1.45, { y: 16, opacity: 0, duration: 0.8, ease: 'power3.out', stagger: 0.1 })
        }
      }
      // with a mouse the card leans a few degrees toward the pointer, and settles back when it leaves
      if (t && !coarse) {
        gsap.set(t, { transformPerspective: 1000 })
        const rx = gsap.quickTo(t, 'rotationX', { duration: 0.9, ease: 'power3' })
        const ry = gsap.quickTo(t, 'rotationY', { duration: 0.9, ease: 'power3' })
        const move = (e: PointerEvent) => {
          if (e.pointerType !== 'mouse') return
          const r = t.getBoundingClientRect()
          rx(((e.clientY - r.top) / r.height - 0.5) * -6)
          ry(((e.clientX - r.left) / r.width - 0.5) * 8)
        }
        const leave = () => (rx(0), ry(0))
        t.addEventListener('pointermove', move)
        t.addEventListener('pointerleave', leave)
        off = () => {
          t.removeEventListener('pointermove', move)
          t.removeEventListener('pointerleave', leave)
        }
      }
      gsap.from(list.current!.children, {
        y: 40,
        opacity: 0,
        duration: 0.8,
        ease: 'power3.out',
        stagger: 0.07,
        scrollTrigger: { trigger: list.current, start: 'top 85%', once: true },
      })
    })
    return () => {
      off()
      ctx.revert()
    }
  }, [])

  // hover preview follows the pointer and leans into the motion; it only animates while a row is hovered
  const showing = useRef(false)
  const wake = useRef(() => {})
  useEffect(() => {
    showing.current = hovered >= 0
    wake.current()
  }, [hovered])
  useEffect(() => {
    const el = preview.current
    if (!el || reduced) return
    let x = innerWidth / 2, y = innerHeight / 2, px = x, py = y, w = 0, h = 0, raf = 0, until = 0
    const tick = (now: number) => {
      const dx = x - px
      px += dx * 0.14
      py += (y - py) * 0.14
      const left = x + w + 40 > innerWidth ? px - w - 32 : px + 32
      el.style.transform = `translate3d(${left}px, ${py - h / 2}px, 0) perspective(700px) rotateY(${Math.max(-18, Math.min(18, dx * 0.12))}deg) rotate(${Math.max(-6, Math.min(6, dx * 0.04))}deg)`
      // keep following through the fade-out, then sleep
      if (showing.current) until = now + 400
      raf = now < until || Math.abs(dx) > 0.2 || Math.abs(y - py) > 0.2 ? requestAnimationFrame(tick) : 0
    }
    wake.current = () => {
      if (!showing.current || raf) return
      // measured once per hover, not per frame; zero while the preview is hidden on small screens
      w = el.offsetWidth
      h = el.offsetHeight
      if (!w) return
      px = x
      py = y
      raf = requestAnimationFrame(tick)
    }
    const move = (e: PointerEvent) => {
      x = e.clientX
      y = e.clientY
      if (showing.current && !raf && w) raf = requestAnimationFrame(tick)
    }
    window.addEventListener('pointermove', move, { passive: true })
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('pointermove', move)
      wake.current = () => {}
    }
  }, [])

  return (
    <section data-solid id="work" className="relative bg-bg px-5 pt-32 pb-24 md:px-8">
      <SectionHead n="02" label="Work" jp="作品" title="Shipped, *starred*, downloaded." />

      {featured && (
        <article className="grid gap-10 md:grid-cols-12 md:gap-8">
          <div ref={tilt} className="relative self-start md:col-span-7">
            <div ref={plate} aria-hidden className="absolute inset-0 rounded-xl shadow-2xl" />
            <div ref={card} className="relative overflow-hidden rounded-xl" style={{ aspectRatio: '4 / 3' }}>
              <TitleCard p={featured} n={1} big />
            </div>
          </div>
          <div className="flex flex-col justify-between gap-8 md:col-span-5">
            <div>
              <p className="meta text-muted">EP.01 · {featured.year} · featured</p>
              <h3 className="mt-4 text-[clamp(2.4rem,5vw,4.5rem)] font-[850] leading-[0.9] [font-stretch:70%] uppercase">{featured.title}</h3>
              <p className="mt-3 font-serif text-xl text-red">{featured.tagline}</p>
              <p className="body mt-5">{featured.description}</p>
              <p className="meta mt-5 text-muted">{featured.tags?.join(' / ')}</p>
            </div>
            <Links p={featured} />
          </div>
          {!!featured.stats?.length && (
            <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line md:col-span-12 md:grid-cols-4">
              {featured.stats.map((s) => (
                <div key={s.label} className="bg-bg p-5 md:p-7">
                  <dd className="text-[clamp(1.7rem,3.4vw,3rem)] font-[800] [font-stretch:80%]">
                    <SplitFlap value={s.value} />
                  </dd>
                  <dt className="meta mt-3 text-muted">{s.label}</dt>
                </div>
              ))}
            </dl>
          )}
        </article>
      )}

      <ul ref={list} className="mt-24 border-b border-line" onPointerLeave={() => setHovered(-1)}>
        {rest.map((p, i) => (
          <li key={p.slug} className="border-t border-line">
            <a
              href={p.links?.[0]?.url}
              target="_blank"
              rel="noreferrer"
              data-cursor="open"
              onPointerEnter={() => setHovered(i)}
              onFocus={() => setHovered(i)}
              onBlur={() => setHovered(-1)}
              className="group grid grid-cols-[3.2rem_1fr_auto] items-baseline gap-x-4 gap-y-1 py-6 md:grid-cols-[5rem_1.1fr_1fr_8rem_2rem] md:py-8"
            >
              <span className="meta text-muted">EP.{pad(i + 2)}</span>
              <span className="text-[clamp(1.9rem,4vw,3.6rem)] font-[850] leading-[0.95] [font-stretch:70%] uppercase transition-[translate,color] duration-500 ease-[cubic-bezier(.2,.8,.2,1)] group-hover:translate-x-3 group-hover:text-red">
                {p.title}
              </span>
              <span className="meta self-center text-right text-muted md:hidden">{p.year}</span>
              <span className="body col-start-2 col-end-4 md:col-auto md:self-center">{p.tagline}</span>
              <span className="meta hidden self-center text-muted md:block">{p.year}</span>
              <span className="hidden self-center justify-self-end text-xl opacity-40 transition-[opacity,rotate] duration-300 group-hover:rotate-45 group-hover:opacity-100 md:block">
                <ArrowUpRight />
              </span>
            </a>
          </li>
        ))}
      </ul>

      <div ref={preview} className={'preview hidden md:block' + (hovered >= 0 ? ' on' : '')} aria-hidden>
        {rest.map((p, i) => (
          <div key={p.slug} className="absolute inset-0 transition-opacity duration-300" style={{ opacity: hovered === i ? 1 : 0 }}>
            <TitleCard p={p} n={i + 2} />
          </div>
        ))}
      </div>
    </section>
  )
}

// ---------- systems: the architecture behind Orion, as a live pipeline + ADRs ----------
export function Systems() {
  const s = systems
  const root = useRef<HTMLElement>(null)
  const [active, setActive] = useState<string | null>(null)
  const adr = (id: string) => s.decisions.findIndex((d) => d.node === id)
  const label = (id: string) => s.pipeline.find((n) => n.id === id)?.label ?? id

  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      gsap
        .timeline({ scrollTrigger: { trigger: '.pipe', start: 'top 82%', once: true } })
        .from('.pipe-node', { y: 28, opacity: 0, duration: 0.7, ease: 'power3.out', stagger: 0.1 })
        .from('.pipe-link', { scale: 0, duration: 0.5, ease: 'power2.inOut', stagger: 0.1 }, 0.25)
      gsap.from('.adr', {
        y: 70,
        opacity: 0,
        duration: 0.9,
        ease: 'power3.out',
        stagger: 0.1,
        scrollTrigger: { trigger: '.adr-grid', start: 'top 85%', once: true },
      })
    }, root)
    return () => ctx.revert()
  }, [])

  const node = (n: (typeof s.pipeline)[number] | typeof s.side, i: number, cls = '') => {
    const id = 'id' in n ? n.id : ''
    const a = adr(id)
    const hot = a >= 0
    return (
      <div
        className={'pipe-node ' + cls + (hot ? ' hot' : '') + (hot && active === id ? ' on' : '')}
        tabIndex={hot ? 0 : undefined}
        data-cursor={hot ? `ADR-${pad(a + 1)}` : undefined}
        onPointerEnter={hot ? () => setActive(id) : undefined}
        onPointerLeave={hot ? () => setActive(null) : undefined}
        onFocus={hot ? () => setActive(id) : undefined}
        onBlur={hot ? () => setActive(null) : undefined}
      >
        <span className="meta flex justify-between gap-2 opacity-70">
          <span>{i ? pad(i) : 'CI'}</span>
          {hot && <span className="text-red">ADR-{pad(a + 1)}</span>}
        </span>
        <span className="text-lg font-[750] leading-tight [font-stretch:82%]">{n.label}</span>
        <span className="meta !text-[0.62rem] leading-snug opacity-70">{n.sub}</span>
      </div>
    )
  }

  return (
    <section ref={root} data-solid id="systems" className="relative border-t border-line bg-bg px-5 py-32 md:px-8">
      <SectionHead n="03" label="Systems" jp="設計" title={s.title} />
      <div className="grid items-end gap-8 md:grid-cols-12">
        <p className="body md:col-span-5 md:col-start-4">{s.intro}</p>
        <a href={s.doc.url} target="_blank" rel="noreferrer" className="key-btn w-fit md:col-span-3 md:col-start-10 md:justify-self-end">
          {s.doc.label} <ArrowUpRight />
        </a>
      </div>

      <ol className="pipe mt-20 flex flex-col lg:flex-row lg:items-end" aria-label="Orion Store data pipeline">
        {s.pipeline.map((n, i) => (
          <li key={n.id} className="flex flex-col lg:min-w-0 lg:flex-1 lg:flex-row lg:items-center" style={{ '--i': i } as CSSProperties}>
            {i > 0 && <span className="pipe-link" aria-hidden />}
            <div className="flex min-w-0 flex-1 flex-col">
              {n.id === s.side.into && (
                <>
                  {node(s.side, 0, 'side')}
                  <span className="pipe-link v" aria-hidden />
                </>
              )}
              {node(n, i + 1, i === s.pipeline.length - 1 ? 'end' : '')}
            </div>
          </li>
        ))}
      </ol>

      <div className="adr-grid mt-20 grid gap-4 md:grid-cols-2">
        {s.decisions.map((d, i) => (
          <article
            key={d.node}
            className={'adr' + (active === d.node ? ' on' : '')}
            onPointerEnter={() => setActive(d.node)}
            onPointerLeave={() => setActive(null)}
          >
            <header className="meta flex items-baseline justify-between gap-4 text-muted">
              <span>
                <span className="text-red">ADR-{pad(i + 1)}</span> · {label(d.node)}
              </span>
              <span>accepted</span>
            </header>
            <h3 className="mt-6 text-[clamp(1.7rem,2.7vw,2.5rem)] font-[800] leading-[0.95] [font-stretch:74%]">{d.title}</h3>
            <dl className="mt-6 grid gap-4">
              <div>
                <dt className="meta text-muted">Problem</dt>
                <dd className="mt-1.5 text-[0.98rem] leading-relaxed">{d.problem}</dd>
              </div>
              <div>
                <dt className="meta text-muted">Decision</dt>
                <dd className="mt-1.5 text-[0.98rem] leading-relaxed">{d.decision}</dd>
              </div>
            </dl>
            <p className="mt-8 flex flex-wrap items-baseline gap-x-4 gap-y-1 border-t border-line pt-5">
              <span className="adr-result text-[clamp(1.9rem,3.2vw,2.8rem)] font-[850] leading-none [font-stretch:70%]">{d.result}</span>
              <span className="meta text-muted">{d.resultNote}</span>
            </p>
          </article>
        ))}
      </div>
    </section>
  )
}

// ---------- hire: a pull request into your team ----------
export function Hire() {
  const h = profile.hire
  const box = useRef<HTMLDivElement>(null)
  const [passed, setPassed] = useState(reduced ? h.checks.length : 0)
  const [running, setRunning] = useState(false)
  const done = passed >= h.checks.length

  // CI runs when the card scrolls in: each check spins, then passes
  useEffect(() => {
    if (reduced) return
    let timer = 0
    const io = new IntersectionObserver(
      ([e]) => {
        if (!e.isIntersecting) return
        io.disconnect()
        setRunning(true)
        let n = 0
        const next = () => {
          setPassed(++n)
          if (n < h.checks.length) {
            sfx.pass()
            timer = window.setTimeout(next, 380 + Math.random() * 260)
          } else sfx.chime()
        }
        timer = window.setTimeout(next, 700)
      },
      { threshold: 0.35 },
    )
    io.observe(box.current!)
    return () => (io.disconnect(), clearTimeout(timer))
  }, [h.checks.length])

  const mail = `mailto:${profile.email}?subject=${encodeURIComponent(h.subject)}`

  return (
    <section data-solid id="hire" className="relative border-t border-line bg-bg px-5 py-32 md:px-8">
      <SectionHead n="06" label="Hire" jp="採用" title="This PR is ready to *merge*." />
      <div className="grid items-start gap-10 lg:grid-cols-12">
        <div ref={box} className="pr overflow-hidden rounded-2xl border border-line bg-card lg:col-span-8">
          <header className="border-b border-line p-5 md:p-7">
            <div className="flex flex-wrap items-center gap-3">
              <span className="pr-state">
                <PullRequest /> Open
              </span>
              <h3 className="text-[clamp(1.4rem,2.6vw,2.2rem)] font-[800] leading-tight [font-stretch:78%]">
                {h.title} <span className="font-[450] text-muted">#1</span>
              </h3>
            </div>
            <p className="mt-3 font-mono text-[0.8rem] text-muted">
              <span className="text-fg">{profile.alias.toLowerCase()}</span> {h.summary.replace(/your-team:main/, '')}
              <code className="rounded bg-bg px-1.5 py-0.5 text-fg">your-team:main</code>
            </p>
          </header>

          <div className="p-5 md:p-7">
            <p className="flex items-center gap-3 font-[750]" aria-live="polite">
              <span className={'pr-status ' + (done ? 'passed' : running ? 'running' : 'queued')}>{done && <Check />}</span>
              {done ? 'All checks have passed' : running ? 'Running checks…' : 'Checks queued'}
              <span className="meta ml-auto text-muted">
                {passed} / {h.checks.length}
              </span>
            </p>
            <ul className="mt-5">
              {h.checks.map((c, i) => {
                const state = i < passed ? 'passed' : running && i === passed ? 'running' : 'queued'
                return (
                  <li key={c.title} className="grid grid-cols-[1.4rem_5.6rem_1fr] items-start gap-x-4 border-t border-line py-4 md:grid-cols-[1.4rem_7rem_1fr]">
                    <span className={'pr-status mt-1 ' + state}>{state === 'passed' && <Check />}</span>
                    <SplitFlap value={c.value} className="text-xl font-[800] md:text-2xl" />
                    <div>
                      <p className="font-[750]">{c.title}</p>
                      <p className="mt-0.5 text-[0.95rem] leading-relaxed text-muted">{c.note}</p>
                    </div>
                  </li>
                )
              })}
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-line pt-5">
              <span className="meta mr-2 text-muted">Labels</span>
              {h.roles.map((r) => (
                <span key={r} className="pr-label">
                  {r}
                </span>
              ))}
            </div>
          </div>

          <footer className="flex flex-wrap items-center gap-3 border-t border-line bg-bg/40 p-5 md:p-7">
            <a href={mail} className={'key-btn' + (done ? ' primary' : '')} data-cursor="email">
              <Merge /> Merge pull request
            </a>
            {resume && (
              <a href={resume} download={resumeName} className="key-btn" data-cursor="pdf">
                Download résumé <Download />
              </a>
            )}
            <span className="meta w-full text-muted sm:ml-auto sm:w-auto">
              {done ? 'No conflicts with your-team:main' : 'Waiting on checks'}
            </span>
          </footer>
        </div>

        <aside className="lg:col-span-4">
          <div className="flex items-start justify-between gap-6">
            <p className="meta text-muted">
              Recruiter TL;DR <span className="jp ml-2 text-base">要約</span>
            </p>
            <span className="hanko text-xl" aria-hidden>
              採用
            </span>
          </div>
          <dl className="mt-6">
            {h.facts.map((f) => (
              <div key={f.k} className="grid grid-cols-[7.5rem_1fr] gap-4 border-t border-line py-4 last:border-b">
                <dt className="meta pt-0.5 text-muted">{f.k}</dt>
                <dd className="leading-snug">{f.v}</dd>
              </div>
            ))}
          </dl>
          <p className="body mt-6 !text-[0.95rem]">
            Fastest route: email{' '}
            <a href={mail} className="underline decoration-red underline-offset-4 hover:text-red">
              {profile.email}
            </a>
            .
          </p>
        </aside>
      </div>
    </section>
  )
}

// ---------- experience as a changelog ----------
export function Log() {
  const ref = useRef<HTMLOListElement>(null)
  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>(ref.current!.children).forEach((row) =>
        gsap.from(row, { y: 50, opacity: 0, duration: 0.9, ease: 'power3.out', scrollTrigger: { trigger: row, start: 'top 88%', once: true } }),
      )
    })
    return () => ctx.revert()
  }, [])
  return (
    <section data-solid id="experience" className="relative border-t border-line bg-bg px-5 py-32 md:px-8">
      <SectionHead n="04" label="Experience" jp="記録" title="The *changelog*." />
      <ol ref={ref}>
        {experience.map((e, i) => (
          <li key={e.role} className="grid gap-4 border-t border-line py-10 md:grid-cols-12">
            <p className="meta text-muted md:col-span-3">
              <span className="text-red">v{experience.length - i}.0</span> · {e.period}
            </p>
            <div className="md:col-span-4">
              <h3 className="text-[clamp(1.5rem,2.4vw,2.1rem)] font-[800] leading-tight [font-stretch:78%]">{e.role}</h3>
              <p className="mt-2 font-serif text-lg text-muted">{e.org}</p>
            </div>
            <ul className="space-y-3 md:col-span-5">
              {e.points.map((pt) => (
                <li key={pt} className="body grid grid-cols-[1.2rem_1fr]">
                  <span className="font-mono text-red">+</span>
                  {pt}
                </li>
              ))}
            </ul>
          </li>
        ))}
        <li className="grid gap-4 border-t border-line py-10 md:grid-cols-12">
          <p className="meta text-muted md:col-span-3">
            <span className="text-red">v0.1</span> · education
          </p>
          <ul className="grid gap-6 sm:grid-cols-3 md:col-span-9">
            {profile.education.map((ed) => (
              <li key={ed.title}>
                <h3 className="text-lg font-[750] leading-snug [font-stretch:85%]">{ed.title}</h3>
                <p className="meta mt-2 text-muted">
                  {ed.place}
                  {ed.period && ` · ${ed.period}`}
                </p>
              </li>
            ))}
          </ul>
        </li>
      </ol>
    </section>
  )
}

// ---------- model card + collectible card ----------
function Collectible() {
  const inner = useRef<HTMLDivElement>(null)
  const [flipped, setFlipped] = useState(false)
  const [flipping, setFlipping] = useState(false)
  const tilt = useRef({ x: 0, y: 0 })
  const apply = (f = flipped) => {
    const { x, y } = tilt.current
    inner.current!.style.transform = `rotateY(${(f ? 180 : 0) + x * 16}deg) rotateX(${-y * 12}deg)`
  }
  const move = (e: RPointerEvent<HTMLButtonElement>) => {
    if (reduced || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    tilt.current = { x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 }
    inner.current!.style.setProperty('--sx', `${((e.clientX - r.left) / r.width) * 100}%`)
    inner.current!.style.setProperty('--so', '1')
    if (!flipping) apply()
  }
  const leave = () => {
    tilt.current = { x: 0, y: 0 }
    inner.current!.style.setProperty('--so', '0')
    apply()
  }
  const flip = () => {
    const f = !flipped
    setFlipped(f)
    setFlipping(true)
    sfx.whoosh()
    apply(f)
    setTimeout(() => setFlipping(false), 800)
  }

  return (
    <button className="tcg block w-full max-w-[22rem] text-left" onPointerMove={move} onPointerLeave={leave} onClick={flip} data-cursor="flip" aria-label="Flip my trading card">
      <div ref={inner} className={'tcg-inner' + (flipping ? ' flipping' : '')}>
        <div className="tcg-face flex flex-col gap-3 bg-card p-3.5 text-fg">
          <div className="flex items-baseline justify-between px-1">
            <span className="text-xl font-[850] [font-stretch:75%] uppercase">{profile.alias}</span>
            <span className="meta">
              <span className="mr-2 rounded-sm bg-red px-1.5 py-0.5 font-bold text-white">SSR</span>Lv.99
            </span>
          </div>
          <div className="relative aspect-square overflow-hidden rounded-lg border border-line bg-bg">
            {avatar && <img src={avatar} alt={`${profile.name}'s avatar`} className="size-full object-cover" />}
            <span className="jp absolute right-2 top-2 text-2xl vertical [text-shadow:0_1px_0_rgb(0_0_0/0.5)]">ルーキー</span>
          </div>
          <p className="meta text-muted">Type: GenAI / Systems · Element: Open source</p>
          <div className="rounded-md border border-line p-3">
            <p className="text-sm font-[750]">
              【Ship It】 <span className="font-[450] text-muted">Turns a prompt into a product before the chai goes cold.</span>
            </p>
          </div>
          <div className="tcg-sheen" />
          <div className="meta mt-auto flex justify-between px-1 text-muted">
            <span>No. 001 / 001</span>
            <span>ATK 1.26M · DEF GPL-3.0</span>
          </div>
        </div>
        <div className="tcg-face tcg-back grid place-items-center overflow-hidden bg-red text-[#f4efe6]">
          <div className="absolute inset-0 grid content-center gap-1 opacity-15 meta leading-none" style={{ fontSize: 10 }} aria-hidden>
            {Array.from({ length: 34 }, (_, i) => (
              <span key={i} className="whitespace-nowrap" style={{ translate: `${(i % 2) * -30}px` }}>
                ROOKIEZ ルーキー ROOKIEZ ルーキー ROOKIEZ ルーキー ROOKIEZ
              </span>
            ))}
          </div>
          <div className="relative grid size-40 place-items-center rounded-full border-[3px] border-[#f4efe6]">
            <span className="font-serif text-7xl font-[800]">ル</span>
          </div>
          <span className="meta absolute bottom-5">tap to flip back</span>
        </div>
      </div>
    </button>
  )
}

export function ModelCard() {
  return (
    <section data-solid id="model" className="relative border-t border-line bg-bg px-5 py-32 md:px-8">
      <SectionHead n="05" label="Model card" jp="仕様" title="Every good model ships with *documentation*." />
      <div className="grid items-start gap-14 md:grid-cols-12">
        <div className="md:col-span-4 md:col-start-2">
          <Collectible />
        </div>
        <dl className="md:col-span-6 md:col-start-7">
          {profile.modelCard.map((row) => (
            <div key={row.k} className="grid grid-cols-[9rem_1fr] gap-4 border-t border-line py-4 last:border-b md:grid-cols-[11rem_1fr]">
              <dt className="meta pt-1 text-muted">{row.k}</dt>
              <dd className="text-lg leading-snug">{row.v}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  )
}

// ---------- contact: meishi (business cards) on a sheet of marbled ink ----------
const TONES = ['red', 'ink', 'paper', 'green', 'indigo', 'silver', 'violet'] as const
type Tone = (typeof TONES)[number]
const toneOf = (t?: string): Tone => (TONES.includes(t as Tone) ? (t as Tone) : 'paper')

type Card = {
  id: string
  label: string
  jp: string
  handle: string
  verb: string
  tone: Tone
  href?: string
  download?: string
  onClick?: () => void
  logo: Logo
  action: ReactNode
  stamp?: boolean
}

function Meishi({ c, n }: { c: Card; n: number }) {
  const card = useRef<HTMLDivElement>(null)
  const to = useRef<Record<'rx' | 'ry' | 'z', (v: number) => void> | null>(null)
  useLayoutEffect(() => {
    const el = card.current!
    const q = (p: string) => gsap.quickTo(el, p, { duration: 0.7, ease: 'power3.out' })
    to.current = { rx: q('rotationX'), ry: q('rotationY'), z: q('z') }
    gsap.set(el, { transformPerspective: 900 })
  }, [])
  const move = (e: RPointerEvent<HTMLElement>) => {
    if (reduced || e.pointerType !== 'mouse') return
    const r = e.currentTarget.getBoundingClientRect()
    const x = (e.clientX - r.left) / r.width
    const y = (e.clientY - r.top) / r.height
    to.current!.ry((x - 0.5) * 26)
    to.current!.rx((0.5 - y) * 20)
    to.current!.z(40)
    card.current!.style.setProperty('--mx', `${x * 100}%`)
    card.current!.style.setProperty('--my', `${y * 100}%`)
  }
  const leave = () => {
    to.current!.rx(0)
    to.current!.ry(0)
    to.current!.z(0)
  }
  const body = (
    <div ref={card} className="meishi-card">
      {/* the site's logo is blind-debossed into the card stock, so it takes the card's colour, not the brand's */}
      <div className="m-face">
        <LogoMark logo={c.logo} className="m-logo" filter="url(#engrave)" />
      </div>
      <div className="m-layer m-top meta">
        <span>No.{pad(n)}</span>
        <span className="jp text-sm" aria-hidden>
          {c.jp}
        </span>
      </div>
      <div className="m-layer m-mid">
        <span className="m-name">{c.label}</span>
        <span className="m-handle">{c.handle}</span>
      </div>
      <div className="m-layer m-foot meta">
        <span>{c.verb}</span>
        <span className={`text-base ${c.onClick || c.download ? '' : 'm-arrow'}`}>{c.action}</span>
      </div>
      {c.stamp && (
        <span className="m-stamp" aria-hidden>
          済
        </span>
      )}
      <div className="m-sheen" aria-hidden />
    </div>
  )
  const common = { className: `meishi tone-${c.tone}`, onPointerMove: move, onPointerLeave: leave, 'data-cursor': c.verb.toLowerCase() }
  return c.onClick ? (
    <button type="button" onClick={c.onClick} {...common} aria-label={`${c.label}: ${c.handle}. ${c.verb}`}>
      {body}
    </button>
  ) : (
    <a href={c.href} target={c.download ? undefined : '_blank'} rel="noreferrer" download={c.download} {...common} aria-label={`${c.label}: ${c.handle}. ${c.verb}`}>
      {body}
    </a>
  )
}

export function Contact() {
  const [copied, setCopied] = useState(false)
  const grid = useRef<HTMLUListElement>(null)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(profile.email)
      setCopied(true)
      sfx.chime()
      setTimeout(() => setCopied(false), 2400)
    } catch {
      location.href = `mailto:${profile.email}`
    }
  }

  // the deck is dealt onto the table when it scrolls in
  useLayoutEffect(() => {
    if (reduced) return
    const ctx = gsap.context(() => {
      gsap.from('.deal', {
        y: 220,
        rotationX: -65,
        rotationZ: (i) => (i % 2 ? 9 : -9) * (1 + (i % 3) * 0.4),
        opacity: 0,
        transformPerspective: 1000,
        transformOrigin: '50% 100%',
        duration: 1.2,
        ease: 'expo.out',
        stagger: 0.09,
        scrollTrigger: { trigger: grid.current, start: 'top 88%', once: true },
        onStart: () => sfx.whoosh(),
      })
    }, grid)
    return () => ctx.revert()
  }, [])

  const cards: Card[] = [
    {
      id: 'email',
      label: 'Email',
      jp: '手紙',
      handle: profile.email,
      verb: copied ? 'Copied' : 'Copy address',
      tone: 'red',
      onClick: copy,
      logo: socialLogo('Email', `mailto:${profile.email}`),
      action: copied ? <Check /> : <Copy />,
      stamp: copied,
    },
    ...(resume
      ? [
          {
            id: 'resume',
            label: 'Résumé',
            jp: '履歴',
            handle: resumeName,
            verb: 'Download PDF',
            tone: 'ink',
            href: resume,
            download: resumeName,
            logo: socialLogo('Résumé', resumeName),
            action: <Download />,
          } as Card,
        ]
      : []),
    ...profile.socials.map(
      (s): Card => ({
        id: s.label,
        label: s.label,
        jp: s.jp,
        handle: s.handle,
        verb: s.verb,
        tone: toneOf((s as { tone?: string }).tone),
        href: s.url,
        logo: socialLogo(s.label, s.url),
        action: <ArrowUpRight />,
      }),
    ),
  ]

  return (
    <section data-solid id="contact" className="relative flex min-h-svh flex-col justify-center overflow-hidden border-t border-line bg-bg px-5 py-32 md:px-8">
      {webgl && <Fluid className="pointer-events-none absolute inset-0 size-full" />}
      <EngraveFilter />
      {/* wide screens: the pitch on the left, the deck fanned out on the right, so neither side sits empty */}
      <div className="relative grid gap-16 xl:grid-cols-12 xl:items-center xl:gap-x-12">
        <div className="xl:col-span-6">
          <p className="meta mb-8 flex items-baseline gap-3 text-muted">
            <span className="text-fg">07</span> / Contact <span className="jp text-base">連絡</span>
          </p>
          <Reveal text="Let's build something people *actually* download." className="h-sec max-w-[14ch] !text-[clamp(3.2rem,9vw,9.5rem)] xl:!text-[clamp(3.2rem,6.6vw,8.5rem)]" />
          <p className="body mt-8 max-w-xl">{profile.hero.availability}</p>
        </div>
        <ul ref={grid} className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:col-span-6 xl:w-full xl:max-w-[48rem] xl:grid-cols-2 xl:justify-self-end">
          {cards.map((c, i) => (
            <li key={c.id} className="deal">
              <div className="meishi-float" style={{ animationDelay: `${i * -0.9}s` }}>
                <Meishi c={c} n={i + 1} />
              </div>
            </li>
          ))}
        </ul>
        <p className="sr-only" aria-live="polite">
          {copied ? 'Email address copied.' : ''}
        </p>
      </div>
      {webgl && !reduced && (
        <p className="meta pointer-events-none absolute right-5 bottom-6 hidden text-muted md:block md:right-8">
          <span className="jp mr-2">墨流し</span> click the water to drop ink · drag to comb
        </p>
      )}
    </section>
  )
}

// ---------- footer ----------
export function Footer() {
  const a = useAudio()
  const [time, setTime] = useState('')
  useEffect(() => {
    const f = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: profile.timezone })
    const tick = () => setTime(f.format(new Date()))
    tick()
    const id = setInterval(tick, 20_000)
    return () => clearInterval(id)
  }, [])
  const line = 'PROMPTS IN → PRODUCTS OUT · ルーキー · '
  return (
    <footer data-solid className="relative overflow-hidden border-t border-line bg-bg pb-24">
      <div className="overflow-hidden py-6" aria-hidden>
        <div className="marquee text-[clamp(3rem,10vw,9rem)] font-[900] leading-none [font-stretch:62%] text-fg/90">
          {[0, 1].map((k) => (
            <span key={k} className="whitespace-pre pr-[0.3em]">
              {line.repeat(3)}
            </span>
          ))}
        </div>
      </div>
      <div className="meta grid gap-4 px-5 text-muted md:grid-cols-3 md:px-8">
        <p>Designed & engineered by {profile.name}. React, three.js, GSAP, raw WebGL2.</p>
        <p>
          {profile.location.split(',')[0]} · <span className="text-fg">{time}</span> IST
        </p>
        <p className="md:text-right">
          now playing · <span className="text-fg">{a.playing ? a.title : 'silence'}</span>
        </p>
      </div>
    </footer>
  )
}

export { pad }
