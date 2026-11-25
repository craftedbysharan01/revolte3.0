import type { ReactNode } from 'react'

/**
 * Thin-stroke icon set modelled on the Solar "linear" style used in the design system
 * (1px stroke, 16/20/24 grid). Logo, spinner and auth background are exact Figma exports.
 */
const P: Record<string, ReactNode> = {
  user: (
    <>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c0-3.6 3.1-5.8 7-5.8s7 2.2 7 5.8" />
    </>
  ),
  mail: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="3" />
      <path d="m4.5 7.5 6.3 4.7a2 2 0 0 0 2.4 0l6.3-4.7" />
    </>
  ),
  lock: (
    <>
      <rect x="4.5" y="10" width="15" height="10" rx="3" />
      <path d="M8 10V8a4 4 0 0 1 8 0v2" />
      <circle cx="12" cy="15" r="1.2" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="2.8" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4 4l16 16" />
      <path d="M10 6a9 9 0 0 1 2-.5c6 0 9.5 6.5 9.5 6.5a17 17 0 0 1-3 3.8M6.2 7.7A16.6 16.6 0 0 0 2.5 12S6 18.5 12 18.5a9 9 0 0 0 3.4-.7" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  x: <path d="m6 6 12 12M18 6 6 18" />,
  check: <path d="m5 12.5 4.5 4.5L19 7.5" />,
  globe: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.6 2.6 3.8 5.6 3.8 9S14.6 18.4 12 21c-2.6-2.6-3.8-5.6-3.8-9S9.4 5.6 12 3Z" />
    </>
  ),
  users: (
    <>
      <circle cx="9.5" cy="8" r="3.3" />
      <path d="M3.5 19.5c0-3.3 2.6-5.3 6-5.3s6 2 6 5.3" />
      <path d="M16 5a3 3 0 0 1 0 6M18.5 14.7c1.6.7 2.5 2.1 2.5 4.3" />
    </>
  ),
  bulb: (
    <>
      <path d="M9 18h6M10 21h4" />
      <path d="M12 3a6 6 0 0 0-3.6 10.8c.7.6 1.1 1.3 1.1 2.2h5c0-.9.4-1.6 1.1-2.2A6 6 0 0 0 12 3Z" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  arrowRight: <path d="M4 12h15M13 6l6 6-6 6" />,
  download: <path d="M12 4v11m0 0 4-4m-4 4-4-4M5 19h14" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  plus: <path d="M12 5v14M5 12h14" />,
  send: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
  chat: (
    <>
      <path d="M4 5h16v11H9l-5 4V5Z" />
    </>
  ),
  cube: (
    <>
      <path d="M12 3 20 7.5v9L12 21l-8-4.5v-9L12 3Z" />
      <path d="M12 12 4 7.5M12 12l8-4.5M12 12v9" />
    </>
  ),
  folder: <path d="M3.5 7.5a2 2 0 0 1 2-2h4l2 2.5h7a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V7.5Z" />,
  doc: (
    <>
      <rect x="5" y="3.5" width="14" height="17" rx="2.5" />
      <path d="M9 8.5h6M9 12h6M9 15.5h3" />
    </>
  ),
  plug: (
    <>
      <path d="M9 3v5M15 3v5M6 8h12v3a6 6 0 0 1-12 0V8ZM12 17v4" />
    </>
  ),
  model: (
    <>
      <circle cx="12" cy="12" r="2" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9" ry="3.8" transform="rotate(120 12 12)" />
    </>
  ),
  bot: (
    <>
      <rect x="4.5" y="8" width="15" height="11" rx="3" />
      <path d="M12 8V4.5M9 13v1M15 13v1M2.5 13v2M21.5 13v2" />
    </>
  ),
  server: (
    <>
      <rect x="4" y="4" width="16" height="6.5" rx="2" />
      <rect x="4" y="13.5" width="16" height="6.5" rx="2" />
      <path d="M8 7.2h.01M8 16.8h.01" />
    </>
  ),
  inbox: (
    <>
      <path d="M4 13.5 6.5 5h11L20 13.5V18a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 18v-4.5Z" />
      <path d="M4 13.5h4.5l1 2h5l1-2H20" />
    </>
  ),
  panel: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="3" />
      <path d="M9.5 4.5v15" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  edit: (
    <>
      <path d="M5 19h4l10-10-4-4L5 15v4Z" />
    </>
  ),
  code: <path d="m9 8-5 4 5 4M15 8l5 4-5 4M13.5 5.5l-3 13" />,
  refresh: (
    <>
      <path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3" />
      <path d="M18 3v4h-4M6 21v-4h4" />
    </>
  ),
  database: (
    <>
      <ellipse cx="12" cy="6" rx="7" ry="3" />
      <path d="M5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3" />
    </>
  ),
  shield: <path d="M12 3 5 6v5.5c0 4.3 2.8 7.5 7 9.5 4.2-2 7-5.2 7-9.5V6l-7-3Z" />,
  stop: <rect x="7" y="7" width="10" height="10" rx="2.2" fill="currentColor" />,
  play: <path d="M8 5.5v13l10-6.5-10-6.5Z" />,
  external: <path d="M14 5h5v5M19 5l-8 8M17 14v3.5a1.5 1.5 0 0 1-1.5 1.5h-9A1.5 1.5 0 0 1 5 17.5v-9A1.5 1.5 0 0 1 6.5 7H10" />,
  branch: (
    <>
      <circle cx="7" cy="5.5" r="2" />
      <circle cx="7" cy="18.5" r="2" />
      <circle cx="17" cy="9" r="2" />
      <path d="M7 7.5v9M17 11c0 3-3 3.5-10 5.5" />
    </>
  ),
}

export type IconName = keyof typeof P

export function Icon({ name, size = 16, className }: { name: IconName; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
    >
      {P[name]}
    </svg>
  )
}

/** Filled "danger" dot used by helper rows (Icon/danger-circle bold). */
export function DangerDot({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 14 14" aria-hidden="true" className="dot dot-danger">
      <circle cx="7" cy="7" r="7" fill="currentColor" />
      <path d="M7 3.6v4" stroke="#0f0f10" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="7" cy="10.2" r=".9" fill="#0f0f10" />
    </svg>
  )
}

export function WarnTriangle({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="dot dot-warning">
      <path d="M8 1.6 15 14H1L8 1.6Z" fill="currentColor" stroke="currentColor" strokeLinejoin="round" strokeWidth="1.2" />
      <path d="M8 6.2v3.4" stroke="#0f0f10" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="8" cy="11.8" r=".8" fill="#0f0f10" />
    </svg>
  )
}

export function InfoDot({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true" className="dot dot-info">
      <circle cx="8" cy="8" r="8" fill="currentColor" />
      <path d="M8 7.2v4.2" stroke="#0f0f10" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="8" cy="4.7" r=".95" fill="#0f0f10" />
    </svg>
  )
}

export function GithubMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 .2a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.23.48-2.7-1.07-2.7-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.22 1.88.87 2.34.66.07-.52.28-.87.5-1.07-1.78-.2-3.65-.89-3.65-3.95 0-.87.31-1.59.83-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 .2Z" />
    </svg>
  )
}

export function GoogleMark({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path fill="#4285F4" d="M15.7 8.2c0-.5 0-1-.1-1.4H8v2.7h4.3a3.7 3.7 0 0 1-1.6 2.4v2h2.6c1.5-1.4 2.4-3.4 2.4-5.7Z" />
      <path fill="#34A853" d="M8 16c2.2 0 4-.7 5.3-2l-2.6-2c-.7.5-1.6.8-2.7.8-2.1 0-3.9-1.4-4.5-3.3H.8v2A8 8 0 0 0 8 16Z" />
      <path fill="#FBBC05" d="M3.5 9.5a4.8 4.8 0 0 1 0-3V4.5H.8a8 8 0 0 0 0 7l2.7-2Z" />
      <path fill="#EA4335" d="M8 3.2c1.2 0 2.3.4 3.1 1.2l2.3-2.3A8 8 0 0 0 .8 4.5l2.7 2C4.100 4.600 5.900 3.200 8 3.200Z" />
    </svg>
  )
}
