// Small hand-drawn line icons, 24×24, inherit text color.
import type { ReactNode, SVGProps } from 'react'

const Svg = ({ children, ...p }: SVGProps<SVGSVGElement> & { children: ReactNode }) => (
  <svg viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden {...p}>
    {children}
  </svg>
)

export const Sun = () => (
  <Svg>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
  </Svg>
)
export const Moon = () => (
  <Svg>
    <path d="M20 14.6A8.5 8.5 0 0 1 9.4 4a8.5 8.5 0 1 0 10.6 10.6Z" />
  </Svg>
)
export const Speaker = ({ off }: { off?: boolean }) => (
  <Svg>
    <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
    {off ? <path d="m16 9.5 5 5m0-5-5 5" /> : <path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" />}
  </Svg>
)
export const Play = () => (
  <Svg fill="currentColor" stroke="none">
    <path d="M7.5 5.2v13.6a.8.8 0 0 0 1.2.7l11-6.8a.8.8 0 0 0 0-1.4l-11-6.8a.8.8 0 0 0-1.2.7Z" />
  </Svg>
)
export const Pause = () => (
  <Svg fill="currentColor" stroke="none">
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </Svg>
)
export const Next = ({ className }: { className?: string }) => (
  <Svg fill="currentColor" stroke="none" className={className}>
    <path d="M5 6.2v11.6a.8.8 0 0 0 1.2.7l9-5.8a.8.8 0 0 0 0-1.4l-9-5.8a.8.8 0 0 0-1.2.7Z" />
    <rect x="16.5" y="5.5" width="2.5" height="13" rx="1" />
  </Svg>
)
export const ArrowUpRight = () => (
  <Svg>
    <path d="M7 17 17 7M8.5 7H17v8.5" />
  </Svg>
)
export const Copy = () => (
  <Svg>
    <rect x="8.5" y="8.5" width="11" height="11" rx="2" />
    <path d="M15.5 8.5V6.5a2 2 0 0 0-2-2h-7a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h2" />
  </Svg>
)
export const Download = () => (
  <Svg>
    <path d="M12 4v11m-4.5-4.5L12 15l4.5-4.5M5 19.5h14" />
  </Svg>
)
export const PullRequest = () => (
  <Svg>
    <circle cx="6" cy="5.5" r="2.2" />
    <circle cx="6" cy="18.5" r="2.2" />
    <circle cx="18" cy="18.5" r="2.2" />
    <path d="M6 7.7v8.6M18 16.3V9.5a3 3 0 0 0-3-3h-4.5m2.2-2.4-2.4 2.4 2.4 2.4" />
  </Svg>
)
export const Merge = () => (
  <Svg>
    <circle cx="6" cy="5.5" r="2.2" />
    <circle cx="6" cy="18.5" r="2.2" />
    <circle cx="18" cy="12" r="2.2" />
    <path d="M6 7.7v8.6M6 7.7c0 3 2.5 4.3 5 4.3h4.8" />
  </Svg>
)
export const Check = () => (
  <Svg>
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </Svg>
)
