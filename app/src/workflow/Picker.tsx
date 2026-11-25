import { useEffect, useMemo, useState } from 'react'
import { Icon, type IconName } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { GithubMark } from '@/ui/Icon'
import { TEMPLATES, closePicker, fillWorkflow, type Template } from './state'

const TABS = ['All', 'Build', 'Review', 'Fix', 'Docs', 'Saved'] as const

/** A small, live picture of the run, shown on hover (H05a). */
function Preview({ t, col }: { t: Template; col: number }) {
  const nodes = t.id === 'reviewed' ? ['Trigger', 'Developer', 'Code reviewer', 'Approval', 'Create draft PR'] : t.id === 'hotfix' ? ['Trigger', 'Developer', 'Security scan', 'Hotfix PR'] : t.id === 'docs' ? ['Trigger', 'Docs writer', 'Review', 'Docs PR'] : ['Trigger', 'Developer', 'QA', 'Create draft PR']
  return (
    <div className={cn("pointer-events-none absolute top-[70%] z-20 w-[560px] rounded-xl", col === 0 ? "left-0" : col === 2 ? "right-0" : "left-1/2 -translate-x-1/2")}><div className="rounded-xl border border-border-subtle bg-[#0c0c0d] p-4 shadow-2xl [background-image:radial-gradient(#202023_1px,transparent_1px)] [background-size:12px_12px] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-150">
      <div className="flex items-center">
        {nodes.map((n, i) => (
          <div key={n} className="flex min-w-0 flex-1 items-center">
            <span className="min-w-0 flex-1 truncate rounded-md border border-border-subtle bg-[#141416] px-2 py-2 text-center text-[11px] motion-safe:animate-in motion-safe:fade-in-0" style={{ animationDelay: `${i * 60}ms`, animationFillMode: 'both' }}>{n}</span>
            {i < nodes.length - 1 && <span className="h-px w-3 shrink-0 bg-border" />}
          </div>
        ))}
      </div>
      </div>
    </div>
  )
}

/** H05-H08: choose a workflow template. Revolte fills the one you choose with this plan. */
export function Picker() {
  const open = useStore((s) => s.wfPicker)
  const id = useStore((s) => s.activeChat)
  const [tab, setTab] = useState<(typeof TABS)[number]>('All')
  const [q, setQ] = useState('')
  const [sel, setSel] = useState('pr')
  const [hover, setHover] = useState<string | null>(null)
  useEffect(() => {
    if (open) (setTab('All'), setQ(''), setSel('pr'), setHover(null))
  }, [open])
  const list = useMemo(() => {
    const n = q.trim().toLowerCase()
    if (tab === 'Saved') return []
    return TEMPLATES.filter((t) => (tab === 'All' || t.tag === tab) && (!n || (t.title + ' ' + t.desc).toLowerCase().includes(n)))
  }, [q, tab])
  const chosen = TEMPLATES.find((t) => t.id === sel)
  const needsSetup = !!chosen?.setup
  return (
    <Dialog open={open} onOpenChange={(o) => !o && closePicker()}>
      <DialogContent showCloseButton={false} className="max-w-[1000px] gap-0 border-border-subtle bg-card p-0 sm:max-w-[1000px]">
        <button aria-label="Close" className="absolute top-5 right-5 text-muted-foreground hover:text-foreground" onClick={closePicker}><Icon name="close" size={16} /></button>
        <div className="px-6 pt-6">
          <DialogTitle className="text-[20px] font-semibold">Choose a workflow template</DialogTitle>
          <DialogDescription className="mt-1 text-[14px] text-muted-foreground">Start from a template. Revolte fills the one you choose with this plan.</DialogDescription>
          <label className="mt-4 flex h-9 items-center gap-2 rounded-md border border-input px-3 focus-within:border-foreground/60">
            <Icon name="search" size={15} className="text-muted-foreground" />
            <input className="flex-1 bg-transparent text-[14px] outline-none placeholder:text-subtle-foreground" placeholder="Search templates" value={q} onChange={(e) => setQ(e.target.value)} />
          </label>
          <div className="mt-3 inline-flex gap-0.5 rounded-lg bg-background p-0.5" role="tablist">
            {TABS.map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={cn('rounded-md px-2.5 py-1 text-[13px] transition-colors', tab === t ? 'bg-selected text-foreground' : 'text-muted-foreground hover:text-foreground')} onClick={() => setTab(t)}>{t}</button>
            ))}
          </div>
        </div>
        <div className="min-h-[300px] px-6 pt-3 pb-5">
          {tab === 'Saved' ? (
            <div className="grid h-[300px] place-items-center text-center">
              <div className="flex max-w-[300px] flex-col items-center gap-2">
                <span className="grid size-10 place-items-center rounded-xl border border-border-subtle bg-surface"><Icon name="routing" size={18} /></span>
                <p className="text-[14px] font-medium">No saved workflows yet</p>
                <p className="text-[13px] text-muted-foreground">Workflows you run from a chat are saved here, so the next one starts from one prompt.</p>
                <Button variant="outline" size="sm" className="mt-1 border-input bg-transparent" onClick={() => setTab('All')}>Browse templates</Button>
              </div>
            </div>
          ) : list.length === 0 ? (
            <div className="grid h-[300px] place-items-center text-center">
              <div className="flex flex-col items-center gap-2">
                <p className="text-[14px] font-medium">No template matches “{q}”</p>
                <p className="text-[13px] text-muted-foreground">Try another word, or start from Chat to pull request.</p>
                <Button variant="outline" size="sm" className="mt-1 border-input bg-transparent" onClick={() => (setQ(''), setSel('pr'))}>Clear search</Button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3" role="radiogroup" aria-label="Templates">
              {list.map((t, i) => {
                const on = sel === t.id
                return (
                  <div key={t.id} className="relative" onMouseEnter={() => setHover(t.id)} onMouseLeave={() => setHover(null)}>
                    <button
                      role="radio"
                      aria-checked={on}
                      onClick={() => setSel(t.id)}
                      onDoubleClick={() => !t.setup && id && fillWorkflow(id, t.id)}
                      className={cn('flex h-full w-full flex-col rounded-xl border p-4 text-left transition-[background-color,border-color,transform] duration-150 hover:-translate-y-0.5', on ? 'border-input bg-selected' : 'border-border-subtle hover:bg-surface')}
                    >
                      <span className="flex items-start justify-between">
                        <span className="grid size-9 place-items-center rounded-lg border border-border-subtle bg-background"><Icon name={t.icon as IconName} size={16} /></span>
                        {t.match && <span className="rounded-md bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">Matches this plan</span>}
                        {t.setup && <span className="flex items-center gap-1 rounded-md bg-[#3a2a12] px-1.5 py-0.5 text-[12px] text-[#f5b94a]"><span className="size-1.5 rounded-full bg-[#f5b94a]" /> Needs setup</span>}
                      </span>
                      <span className="mt-3 text-[14px] font-medium">{t.title}</span>
                      <span className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{t.desc}</span>
                      <span className="mt-4 flex items-center justify-between">
                        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[12px] text-muted-foreground">{t.tag}</span>
                        <span className="flex items-center gap-1">{t.jira && <span className="grid size-4 place-items-center rounded-sm bg-[#2684ff] text-[9px] font-bold text-white">J</span>}<GithubMark size={14} /></span>
                      </span>
                    </button>
                    {hover === t.id && <Preview t={t} col={i % 3} />}
                  </div>
                )
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-2 border-t border-border-subtle px-6 py-4">
          <span className="mr-auto text-[13px] text-muted-foreground">{needsSetup ? 'This template needs a docs connection first. Pick another to run now.' : chosen ? `${chosen.title} · filled with this plan` : ''}</span>
          <Button variant="outline" size="sm" className="h-9 border-input bg-transparent" onClick={closePicker}>Cancel</Button>
          <Button size="sm" className="h-9" disabled={!chosen || needsSetup || tab === 'Saved'} onClick={() => id && chosen && fillWorkflow(id, chosen.id)}>Use template</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
