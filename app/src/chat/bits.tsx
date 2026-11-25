import { useEffect, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** The brand spinner (Figma export), used for every "running" state. */
export function Spin({ size = 14, className }: { size?: number; className?: string }) {
  return <img src={`${import.meta.env.BASE_URL}assets/spinner.svg`} alt="" width={size} height={size} className={cn('spin shrink-0', className)} />
}

/** Re-renders every second while `on` so live "· 12s" counters tick. */
export function useNow(on: boolean) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (!on) return
    const t = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(t)
  }, [on])
  return now
}

export const fmtSecs = (s: number) => (s >= 60 ? `${Math.floor(s / 60)}m ${String(s % 60).padStart(2, '0')}s` : `${s}s`)

export function Overline({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('text-[10px] font-semibold tracking-[0.7px] uppercase text-subtle-foreground', className)}>{children}</span>
}
