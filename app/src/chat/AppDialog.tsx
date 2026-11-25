import { useEffect, useMemo, useState } from 'react'
import { Icon } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { setState, useStore } from '@/store'
import { chooseApplication } from './engine'

/** Projects and their applications (Figma EC13a). */
const PROJECTS: { name: string; apps: string[] }[] = [
  { name: 'PAMS', apps: ['Payments API', 'Webhook monitor'] },
  { name: 'Acme payments', apps: ['Ledger service', 'Admin console'] },
  { name: 'Customer portal', apps: ['Web app', 'Mobile API', 'Design system'] },
]

/** EC12-EC16: Choose application (also opened from Create application). */
export function AppDialog({ onNote }: { onNote: (s: string) => void }) {
  const open = useStore((s) => s.appDialog)
  const id = useStore((s) => s.activeChat)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<{ app: string; project: string; isNew?: boolean } | null>(null)
  const [list, setList] = useState(false)
  const [openP, setOpenP] = useState<string | null>('PAMS')
  useEffect(() => {
    if (open) {
      setQ('')
      setPicked(null)
      setList(false)
      setOpenP('PAMS')
    }
  }, [open])
  const close = () => setState({ appDialog: false })
  const needle = q.trim().toLowerCase()
  const shown = useMemo(() => PROJECTS.map((p) => ({ ...p, apps: p.apps.filter((a) => !needle || a.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle)) })).filter((p) => p.apps.length), [needle])
  const choose = () => {
    if (!picked || !id) return
    chooseApplication(id, picked.app)
    close()
    onNote(`Application chosen|Code from this chat goes to ${picked.isNew ? picked.app : 'acme/' + picked.app.toLowerCase().replace(/\s+/g, '-')}.`)
  }
  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent className="max-w-[440px] gap-0 border-border-subtle bg-card p-0">
        <DialogHeader className="px-6 pt-5 pb-0 text-left">
          <DialogTitle className="text-[16px]">Choose application</DialogTitle>
          <DialogDescription className="text-[13px] leading-[18px] text-muted-foreground">Search your projects for the application this chat belongs to, or create a new one.</DialogDescription>
        </DialogHeader>
        <div className="relative px-6 pt-4 pb-5">
          <label htmlFor="app-name" className="mb-1.5 block text-[13px] text-muted-foreground">
            Application name
          </label>
          <div className="relative">
            {picked && <Icon name="box" size={14} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground" />}
            <Input
              id="app-name"
              role="combobox"
              aria-expanded={list}
              autoComplete="off"
              placeholder="Search or choose application"
              value={picked ? picked.app : q}
              className={cn('h-9 border-input bg-transparent text-[13px]', picked && 'pl-9')}
              onFocus={() => setList(true)}
              onChange={(e) => {
                setPicked(null)
                setQ(e.target.value)
                setList(true)
              }}
            />
          </div>
          {picked && (
            <p className="mt-2.5 flex items-center gap-2 text-[12px] text-muted-foreground">
              <Icon name="lock" size={13} /> {picked.isNew ? 'A new application in Unassigned. Connect GitHub to give it a repository.' : `In ${picked.project}. Code from this chat goes to acme/${picked.app.toLowerCase().replace(/\s+/g, '-')}.`}
            </p>
          )}
          {list && !picked && (
            <div className="absolute inset-x-6 top-[88px] z-10 max-h-[280px] overflow-y-auto rounded-xl border border-border-subtle bg-card p-1.5 shadow-xl" role="listbox">
              {shown.length === 0 && <p className="px-3 py-3 text-[13px] text-muted-foreground">No application matches “{q}”.</p>}
              {shown.map((p) => {
                const expanded = needle ? true : openP === p.name
                return (
                  <div key={p.name}>
                    <button className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] hover:bg-selected" aria-expanded={expanded} onClick={() => setOpenP(expanded ? null : p.name)}>
                      <Icon name="folder" size={15} bold={expanded} /> {p.name}
                      <Icon name={expanded ? 'up' : 'down'} size={13} className="ml-auto text-muted-foreground" />
                    </button>
                    {expanded &&
                      p.apps.map((a) => (
                        <button key={a} role="option" aria-selected={false} className="flex h-9 w-full items-center gap-2.5 rounded-md pr-2.5 pl-9 text-[13px] hover:bg-selected" onClick={() => (setPicked({ app: a, project: p.name }), setList(false))}>
                          <Icon name="box" size={14} className="text-muted-foreground" /> {a}
                        </button>
                      ))}
                  </div>
                )
              })}
              <div className="mt-1 border-t border-border-subtle pt-1">
                <button className="flex h-9 w-full items-center gap-2.5 rounded-md px-2.5 text-[13px] hover:bg-selected" onClick={() => (setPicked({ app: q.trim() || 'New application', project: 'Unassigned', isNew: true }), setList(false))}>
                  <Icon name="plus" size={14} /> Create new application{q.trim() ? `: ${q.trim()}` : ''}
                </button>
              </div>
            </div>
          )}
        </div>
        <footer className="flex justify-end gap-2 border-t border-border-subtle px-6 py-3.5">
          <Button variant="outline" size="sm" className="h-8 border-input bg-transparent text-[13px]" onClick={close}>
            Cancel
          </Button>
          <Button size="sm" className="h-8 text-[13px]" disabled={!picked} onClick={choose}>
            Choose application
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
