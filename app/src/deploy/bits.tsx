import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/solar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'

export const field = 'h-9 w-full rounded-md border border-input bg-transparent px-3 text-[14px] outline-none placeholder:text-subtle-foreground focus:border-foreground/60'

export function Label({ children }: { children: ReactNode }) {
  return <p className="mb-1.5 text-[13px] font-medium">{children}</p>
}

/** A shadcn-style select: button + popover list. */
export function Pick({ value, placeholder, icon, items, onPick, disabled, className, open: o, onOpen }: { value: string; placeholder?: string; icon?: IconName; items: { id: string; label: string; right?: string }[]; onPick: (id: string) => void; disabled?: boolean; className?: string; open?: boolean; onOpen?: (o: boolean) => void }) {
  const [own, setOwn] = useState(false)
  const open = o ?? own
  const setOpen = onOpen ?? setOwn
  return (
    <Popover open={open && !disabled} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={disabled} className={cn(field, 'flex items-center gap-2 text-left disabled:opacity-60', !value && 'text-muted-foreground', className)}>
          {icon && <Icon name={icon} size={16} className="shrink-0 text-muted-foreground" />}
          <span className="min-w-0 flex-1 truncate">{value || placeholder}</span>
          <Icon name="down" size={14} className="shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-(--radix-popover-trigger-width) border-border-subtle bg-card p-1">
        {items.map((it) => (
          <button key={it.id} type="button" className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-[13px] hover:bg-selected" onClick={() => (onPick(it.id), setOpen(false))}>
            <span className="min-w-0 flex-1 truncate">{it.label}</span>
            {it.right && <span className="text-[12px] text-muted-foreground">{it.right}</span>}
            {value === it.id && <Icon name="check" size={14} />}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export function Switch({ on, onChange, label }: { on: boolean; onChange: (b: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)} className={cn('relative h-5 w-9 shrink-0 rounded-full transition-colors', on ? 'bg-foreground' : 'bg-input')}>
      <span className={cn('absolute top-0.5 left-0.5 size-4 rounded-full bg-background transition-transform', on && 'translate-x-4')} />
    </button>
  )
}

export function Steps({ n }: { n: number }) {
  return (
    <div className="flex gap-1.5" aria-label={`Step ${n} of 4`}>
      {[1, 2, 3, 4].map((i) => (
        <span key={i} className={cn('h-0.5 flex-1 rounded-full', i <= n ? 'bg-foreground' : 'bg-border-subtle')} />
      ))}
    </div>
  )
}
