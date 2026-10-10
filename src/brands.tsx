// Logos for the keyboard keys and the contact cards.
// Brand marks come from simple-icons (CC0) as 24×24 SVG paths. Ideas without a logo
// (RAG, embeddings…) get a line glyph drawn on the same 24×24 grid.
// A file in content/icons/ named after a skill or social ("ollama.svg") replaces the built-in logo.
import {
  siAndroid, siAndroidstudio, siAnthropic, siArchlinux, siClaude, siClaudecode, siCloudflare, siCursor, siDeepseek, siDiscord, siDocker,
  siFastapi, siFigma, siFirebase, siGit, siGithub, siGithubactions, siGithubcopilot, siGitlab, siGmail, siGnubash, siGo,
  siGooglecloud, siGooglegemini, siHuggingface, siJavascript, siJupyter, siKaggle, siKubernetes, siLangchain, siLinux,
  siLmstudio, siMeta, siMetaai, siMistralai, siMongodb, siN8n, siNextdotjs, siNodedotjs, siNumpy, siNvidia, siOllama, siPandas, siPerplexity, siPostgresql,
  siPython, siPytorch, siReact, siRedis, siRust, siScikitlearn, siStreamlit, siSupabase, siTailwindcss, siTensorflow,
  siThreedotjs, siTypescript, siUbuntu, siVercel, siVite, siX,
} from 'simple-icons'
import { iconFiles, slug } from './content'

export type Glyph = { fill?: string; stroke?: string }
export type Logo = { glyph: Glyph; src?: undefined } | { src: string; glyph?: undefined }
type Brand = { glyph: Glyph; color: string; ink?: string }

const INK = '#1b1a18'
const SNOW = '#fbf8f1'
const PAPER = '#ebe5d6'
const RED = '#c62a32'

// simple-icons dropped OpenAI and LinkedIn, so their paths are inlined here (from simple-icons v12, CC0)
const OPENAI =
  'M22.2819 9.8211a5.9847 5.9847 0 0 0-.5157-4.9108 6.0462 6.0462 0 0 0-6.5098-2.9A6.0651 6.0651 0 0 0 4.9807 4.1818a5.9847 5.9847 0 0 0-3.9977 2.9 6.0462 6.0462 0 0 0 .7427 7.0966 5.98 5.98 0 0 0 .511 4.9107 6.051 6.051 0 0 0 6.5146 2.9001A5.9847 5.9847 0 0 0 13.2599 24a6.0557 6.0557 0 0 0 5.7718-4.2058 5.9894 5.9894 0 0 0 3.9977-2.9001 6.0557 6.0557 0 0 0-.7475-7.0729zm-9.022 12.6081a4.4755 4.4755 0 0 1-2.8764-1.0408l.1419-.0804 4.7783-2.7582a.7948.7948 0 0 0 .3927-.6813v-6.7369l2.02 1.1686a.071.071 0 0 1 .038.052v5.5826a4.504 4.504 0 0 1-4.4945 4.4944zm-9.6607-4.1254a4.4708 4.4708 0 0 1-.5346-3.0137l.142.0852 4.783 2.7582a.7712.7712 0 0 0 .7806 0l5.8428-3.3685v2.3324a.0804.0804 0 0 1-.0332.0615L9.74 19.9502a4.4992 4.4992 0 0 1-6.1408-1.6464zM2.3408 7.8956a4.485 4.485 0 0 1 2.3655-1.9728V11.6a.7664.7664 0 0 0 .3879.6765l5.8144 3.3543-2.0201 1.1685a.0757.0757 0 0 1-.071 0l-4.8303-2.7865A4.504 4.504 0 0 1 2.3408 7.872zm16.5963 3.8558L13.1038 8.364 15.1192 7.2a.0757.0757 0 0 1 .071 0l4.8303 2.7913a4.4944 4.4944 0 0 1-.6765 8.1042v-5.6772a.79.79 0 0 0-.407-.667zm2.0107-3.0231l-.142-.0852-4.7735-2.7818a.7759.7759 0 0 0-.7854 0L9.409 9.2297V6.8974a.0662.0662 0 0 1 .0284-.0615l4.8303-2.7866a4.4992 4.4992 0 0 1 6.6802 4.66zM8.3065 12.863l-2.02-1.1638a.0804.0804 0 0 1-.038-.0567V6.0742a4.4992 4.4992 0 0 1 7.3757-3.4537l-.142.0805L8.704 5.459a.7948.7948 0 0 0-.3927.6813zm1.0976-2.3654l2.602-1.4998 2.6069 1.4998v2.9994l-2.5974 1.4997-2.6067-1.4997Z'
const LINKEDIN =
  'M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z'
// not in simple-icons at all: Codex (the >_ is cut out of the cloud) and Google Antigravity, from lobe-icons (MIT)
const CODEX =
  'M8.086.457a6.105 6.105 0 013.046-.415c1.333.153 2.521.72 3.564 1.7a.117.117 0 00.107.029c1.408-.346 2.762-.224 4.061.366l.063.03.154.076c1.357.703 2.33 1.77 2.918 3.198.278.679.418 1.388.421 2.126a5.655 5.655 0 01-.18 1.631.167.167 0 00.04.155 5.982 5.982 0 011.578 2.891c.385 1.901-.01 3.615-1.183 5.14l-.182.22a6.063 6.063 0 01-2.934 1.851.162.162 0 00-.108.102c-.255.736-.511 1.364-.987 1.992-1.199 1.582-2.962 2.462-4.948 2.451-1.583-.008-2.986-.587-4.21-1.736a.145.145 0 00-.14-.032c-.518.167-1.04.191-1.604.185a5.924 5.924 0 01-2.595-.622 6.058 6.058 0 01-2.146-1.781c-.203-.269-.404-.522-.551-.821a7.74 7.74 0 01-.495-1.283 6.11 6.11 0 01-.017-3.064.166.166 0 00.008-.074.115.115 0 00-.037-.064 5.958 5.958 0 01-1.38-2.202 5.196 5.196 0 01-.333-1.589 6.915 6.915 0 01.188-2.132c.45-1.484 1.309-2.648 2.577-3.493.282-.188.55-.334.802-.438.286-.12.573-.22.861-.304a.129.129 0 00.087-.087A6.016 6.016 0 015.635 2.31C6.315 1.464 7.132.846 8.086.457zm-.804 7.85a.848.848 0 00-1.473.842l1.694 2.965-1.688 2.848a.849.849 0 001.46.864l1.94-3.272a.849.849 0 00.007-.854l-1.94-3.393zm5.446 6.24a.849.849 0 000 1.695h4.848a.849.849 0 000-1.696h-4.848z'
const ANTIGRAVITY =
  'M21.751 22.607c1.34 1.005 3.35.335 1.508-1.508C17.73 15.74 18.904 1 12.037 1 5.17 1 6.342 15.74.815 21.1c-2.01 2.009.167 2.511 1.507 1.506 5.192-3.517 4.857-9.714 9.715-9.714 4.857 0 4.522 6.197 9.714 9.715z'

const dot = (x: number, y: number, r = 1.35) => `M${x - r} ${y}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`
const ring = (x: number, y: number, r: number) => dot(x, y, r)

// line glyphs for the things that are ideas rather than products
export const GLYPHS = {
  llama: { stroke: 'M8.5 21.5V10.2c0-1.6-.7-2.5-.7-4.3V3.2l2.4 2.7h2.2l1.2-2.7.5 3.9 3.5 1.6c.9.4.9 2-.1 2.3l-4.2 1.1v9.4', fill: dot(12.6, 8.4, 0.9) },
  rag: { stroke: `M12.5 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h4M12.5 3 18 8.5V10M12.5 3v5.5H18M8 12.5h3.5M8 16h2${ring(16.4, 16.2, 3.1)}M18.6 18.5l2.4 2.4` },
  prompt: { stroke: 'M4.5 6.5 10 12l-5.5 5.5M12.5 18h7' },
  vectors: { stroke: `${ring(12, 12, 5.4)}M12 12l2.6-2.5M12 12l-2.3 2.9`, fill: [dot(12, 12, 1.6), dot(14.7, 9.4), dot(9.6, 15), dot(4, 5), dot(20, 4.6), dot(20.4, 19.2), dot(3.6, 19.4)].join('') },
  chroma: { stroke: ring(15.3, 12, 5.5), fill: dot(8.7, 12, 5.5) },
  sliders: { stroke: 'M6 4v16M12 4v16M18 4v16', fill: [dot(6, 14.5, 2.4), dot(12, 8, 2.4), dot(18, 15.5, 2.4)].join('') },
  embed: { stroke: 'M4 3.5V20h16.5', fill: [dot(9, 7.6), dot(12, 6), dot(11.3, 10.2), dot(16, 13.4), dot(19, 11.2), dot(18.4, 16)].join('') },
  shield: { stroke: 'M12 3l7 2.8v5.4c0 4.6-3 8.1-7 9.8-4-1.7-7-5.2-7-9.8V5.8zM8.8 12.2l2.2 2.2 4.4-4.6' },
  doc: { stroke: 'M14 3H7.5A2.5 2.5 0 0 0 5 5.5v13A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5V8zM14 3v5h5M8.5 13h7M8.5 16.5h4.5' },
  mail: { stroke: 'M4.5 5.5h15A1.5 1.5 0 0 1 21 7v10a1.5 1.5 0 0 1-1.5 1.5h-15A1.5 1.5 0 0 1 3 17V7a1.5 1.5 0 0 1 1.5-1.5zM3.5 6.5l8.5 6.5 8.5-6.5' },
  link: { stroke: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1' },
  bullet: { fill: 'M9 9.5C9 6.1 10.3 3.9 12 2.5c1.7 1.4 3 3.6 3 7z', stroke: 'M9 9.5h6v9H9zM9 12h6M8 18.5h8V21H8z' },
} satisfies Record<string, Glyph>

// near-black brand colours all become the same soft black, so dark keys still read as keycaps
const si = (i: { path: string; hex: string }, color?: string, ink?: string): Brand => ({
  glyph: { fill: i.path },
  color: color ?? (/^(000000|181717|191919|111111)$/i.test(i.hex) ? '#161615' : '#' + i.hex),
  ink,
})
const idea = (glyph: Glyph): Brand => ({ glyph, color: PAPER, ink: RED })

// keys are names with everything but letters and digits stripped: "Hugging Face" → "huggingface"
const BRANDS: Record<string, Brand> = {
  claude: si(siClaude),
  anthropic: si(siAnthropic, '#d4a27f', INK),
  // the indigo end of Codex's own gradient, with the prompt showing through in key colour
  codex: { glyph: { fill: CODEX }, color: '#3941ff' },
  gpt: { glyph: { fill: OPENAI }, color: '#10a37f' },
  openai: { glyph: { fill: OPENAI }, color: '#161615' },
  // Muse Spark ships under the Meta AI mark; a pale key keeps it apart from the Llama key next to it
  muse: { glyph: { fill: siMetaai.path }, color: '#ece4ff', ink: '#7a3cf0' },
  musespark: { glyph: { fill: siMetaai.path }, color: '#ece4ff', ink: '#7a3cf0' },
  metaai: { glyph: { fill: siMetaai.path }, color: '#ece4ff', ink: '#7a3cf0' },
  llama: si(siMeta),
  meta: si(siMeta),
  mistral: si(siMistralai),
  ollama: si(siOllama),
  huggingface: si(siHuggingface, undefined, INK),
  langchain: si(siLangchain, '#1c3c3c', SNOW),
  llamaindex: { glyph: GLYPHS.llama, color: '#8b5cf6' },
  python: si(siPython),
  pytorch: si(siPytorch),
  fastapi: si(siFastapi),
  faiss: { glyph: GLYPHS.vectors, color: '#4338ca' },
  chromadb: { glyph: GLYPHS.chroma, color: '#ff6446' },
  chroma: { glyph: GLYPHS.chroma, color: '#ff6446' },
  claudecode: si(siClaudecode, '#262624', '#d97757'),
  // a pale key in Google blue: the indigo FAISS key sits right beside it
  antigravity: { glyph: { fill: ANTIGRAVITY }, color: '#f3f2ee', ink: '#3186ff' },
  googleantigravity: { glyph: { fill: ANTIGRAVITY }, color: '#f3f2ee', ink: '#3186ff' },
  typescript: si(siTypescript),
  ghactions: si(siGithubactions),
  githubactions: si(siGithubactions),
  docker: si(siDocker),
  linux: si(siLinux, undefined, INK),
  cloudflare: si(siCloudflare),
  android: si(siAndroid),
  androidstudio: si(siAndroidstudio),
  react: si(siReact),
  cursor: si(siCursor, '#f3f2ee', INK),
  github: si(siGithub),
  gitlab: si(siGitlab),
  openbullet: { glyph: GLYPHS.bullet, color: '#b8873b' },
  // spares, so swapping a skill in skills.json picks up its logo automatically
  rag: idea(GLYPHS.rag),
  prompting: idea(GLYPHS.prompt),
  finetuning: idea(GLYPHS.sliders),
  embeddings: idea(GLYPHS.embed),
  security: idea(GLYPHS.shield),
  gemini: si(siGooglegemini),
  deepseek: si(siDeepseek),
  perplexity: si(siPerplexity),
  copilot: si(siGithubcopilot),
  lmstudio: si(siLmstudio),
  n8n: si(siN8n),
  tensorflow: si(siTensorflow),
  scikitlearn: si(siScikitlearn),
  numpy: si(siNumpy),
  pandas: si(siPandas, '#150458'),
  jupyter: si(siJupyter),
  kaggle: si(siKaggle),
  streamlit: si(siStreamlit),
  nvidia: si(siNvidia),
  javascript: si(siJavascript, undefined, INK),
  nodejs: si(siNodedotjs),
  node: si(siNodedotjs),
  nextjs: si(siNextdotjs),
  vite: si(siVite),
  threejs: si(siThreedotjs),
  tailwind: si(siTailwindcss),
  tailwindcss: si(siTailwindcss),
  rust: si(siRust, '#b7410e'),
  go: si(siGo),
  git: si(siGit),
  bash: si(siGnubash, '#2f3a2f'),
  ubuntu: si(siUbuntu),
  archlinux: si(siArchlinux),
  kubernetes: si(siKubernetes),
  postgresql: si(siPostgresql),
  postgres: si(siPostgresql),
  redis: si(siRedis),
  mongodb: si(siMongodb),
  supabase: si(siSupabase),
  firebase: si(siFirebase, undefined, INK),
  googlecloud: si(siGooglecloud),
  gcp: si(siGooglecloud),
  vercel: si(siVercel),
  figma: si(siFigma),
}

// sRGB relative luminance, to pick a logo colour that stays readable on the key
function luminance(hex: string) {
  const n = parseInt(hex.replace('#', '').replace(/^(.)(.)(.)$/, '$1$1$2$2$3$3'), 16)
  const lin = (c: number) => ((c /= 255) <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255)
}
export const inkFor = (bg: string) => (luminance(bg) > 0.45 ? INK : SNOW)

export type Tool = { logo?: Logo; color: string; ink: string }

// a skill's key: a dropped-in icon file wins, then the built-in logo; color/ink in skills.json override either
export function toolBrand(s: { name: string; icon?: string; color?: string; ink?: string }): Tool {
  const key = slug(s.icon ?? s.name)
  const file = iconFiles.get(key) ?? iconFiles.get(slug(s.name))
  const b = BRANDS[key]
  const color = s.color ?? b?.color ?? PAPER
  return {
    logo: file ? { src: file } : b && { glyph: b.glyph },
    color,
    ink: s.ink ?? (s.color ? inkFor(color) : (b?.ink ?? inkFor(color))),
  }
}

// contact cards: matched on the link's domain first, then the label
export function socialLogo(label: string, url = ''): Logo {
  const file = iconFiles.get(slug(label))
  if (file) return { src: file }
  const host = url.replace(/^\w+:\/\//, '').split(/[/?#]/)[0].replace(/^www\./, '')
  if (url.startsWith('mailto:')) return { glyph: /@(gmail|googlemail)\.com$/i.test(url) ? { fill: siGmail.path } : GLYPHS.mail }
  if (/\.pdf$/i.test(url) || slug(label) === 'resume') return { glyph: GLYPHS.doc }
  if (/github\.com$/.test(host)) return { glyph: { fill: siGithub.path } }
  if (/linkedin\.com$/.test(host)) return { glyph: { fill: LINKEDIN } }
  if (/(^|\.)(x|twitter)\.com$/.test(host)) return { glyph: { fill: siX.path } }
  if (/discord\.(gg|com)$/.test(host)) return { glyph: { fill: siDiscord.path } }
  const b = BRANDS[slug(label)]
  return { glyph: b?.glyph ?? GLYPHS.link }
}

// ---------- drawing ----------
const images = new Map<string, HTMLImageElement>()
export function preloadLogos(logos: (Logo | undefined)[]) {
  return Promise.all(
    logos.flatMap((l) => {
      if (!l?.src || images.has(l.src)) return []
      const img = new Image()
      img.src = l.src
      images.set(l.src, img)
      return [img.decode().catch(() => console.warn(`[icons] could not load ${l.src}`))]
    }),
  )
}

// draws a logo centred on (cx, cy), fitted in a size×size box. Glyphs take `color`; image files keep their own.
export function drawLogo(g: CanvasRenderingContext2D, logo: Logo, cx: number, cy: number, size: number, color: string) {
  g.save()
  if (logo.src !== undefined) {
    const img = images.get(logo.src)
    if (img?.complete && img.naturalWidth) {
      const k = size / Math.max(img.naturalWidth, img.naturalHeight)
      const w = img.naturalWidth * k
      const h = img.naturalHeight * k
      g.drawImage(img, cx - w / 2, cy - h / 2, w, h)
    }
  } else {
    g.translate(cx - size / 2, cy - size / 2)
    g.scale(size / 24, size / 24)
    g.fillStyle = g.strokeStyle = color
    if (logo.glyph.stroke) {
      g.lineWidth = 1.75
      g.lineCap = g.lineJoin = 'round'
      g.stroke(new Path2D(logo.glyph.stroke))
    }
    if (logo.glyph.fill) g.fill(new Path2D(logo.glyph.fill))
  }
  g.restore()
}

export function LogoMark({ logo, className, filter }: { logo: Logo; className?: string; filter?: string }) {
  if (logo.src !== undefined) return <img src={logo.src} alt="" className={className} draggable={false} />
  const { fill, stroke } = logo.glyph
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <g filter={filter}>
        {stroke && <path d={stroke} fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round" />}
        {fill && <path d={fill} fill="currentColor" />}
      </g>
    </svg>
  )
}

// blind deboss for the contact cards: the top lip throws a shadow into the cut, the bottom lip catches light.
// Units are the logos' 24×24 grid, so every card gets the same depth.
export function EngraveFilter() {
  return (
    <svg width="0" height="0" className="absolute" aria-hidden>
      <filter id="engrave" x="-10%" y="-10%" width="120%" height="120%" colorInterpolationFilters="sRGB">
        <feOffset in="SourceAlpha" dy="0.55" result="down" />
        <feGaussianBlur in="down" stdDeviation="0.22" result="downBlur" />
        <feComposite in="SourceAlpha" in2="downBlur" operator="out" result="topLip" />
        <feFlood floodColor="#000" floodOpacity="0.5" />
        <feComposite in2="topLip" operator="in" result="shade" />
        <feOffset in="SourceAlpha" dy="-0.4" result="up" />
        <feComposite in="SourceAlpha" in2="up" operator="out" result="bottomLip" />
        <feFlood floodColor="#fff" floodOpacity="0.28" />
        <feComposite in2="bottomLip" operator="in" result="light" />
        <feMerge>
          <feMergeNode in="SourceGraphic" />
          <feMergeNode in="shade" />
          <feMergeNode in="light" />
        </feMerge>
      </filter>
    </svg>
  )
}
