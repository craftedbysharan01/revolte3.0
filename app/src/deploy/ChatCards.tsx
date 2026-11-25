import { useEffect, useRef } from 'react'
import { Icon } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { Spin } from '@/chat/bits'
import { WHERE_LABEL, VALID_NAME, deployNow, saveVars, setDep, type Dep } from './state'
import { YAML } from './yaml'

const summary = (d: Dep) => `Deploy · ${d.name} → ${d.where === 'cloud' ? 'Revolte Cloud' : d.where === 'aws' ? 'AWS' : 'Google Cloud'} · ${d.region} · ${d.preset}`

function Worked({ text }: { text: string }) {
  return (
    <p className="flex items-center gap-2 text-[14px] text-muted-foreground">
      <span className="grid size-4 place-items-center rounded-full bg-success text-background"><Icon name="check" size={10} /></span> {text}
    </p>
  )
}

/** Chat messages after the wizard: D09 variables, D11 finishing, D12 ready. */
export function DeployChat({ onNote }: { onNote: (s: string) => void }) {
  const d = useStore((s) => s.dep)
  const end = useRef<HTMLDivElement>(null)
  useEffect(() => {
    end.current?.scrollIntoView({ block: 'end' })
  }, [d.chat])
  if (d.chat === 'none') return null
  const rows = d.vars
  const secret = d.varTab === 'secrets'
  const filled = rows.every((r) => r.key.trim() && r.name.trim())
  const edit = (i: number, patch: Partial<{ name: string; key: string }>) => setDep({ vars: rows.map((r, j) => (j === i ? { ...r, ...patch } : r)), varBad: false })
  return (
    <div ref={end} className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-300">
      <p className="flex items-center gap-2 text-[12px] text-muted-foreground"><Icon name="rocket" size={12} /> {summary(d)}</p>

      {d.chat === 'generating' && (
        <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Spin size={14} /> Working · writing deployment.yml for {d.name}…</p>
      )}

      {(d.chat === 'vars' || d.chat === 'finishing' || d.chat === 'ready') && (
        <>
          <Worked text={d.chat === 'ready' ? 'Worked for 48s · deployment.yml generated' : 'Worked for 18s · 6 steps'} />
          {d.chat !== 'ready' && <p className="text-[14px] leading-6">deployment.yml is almost ready. It needs 3 values the code reads at start-up. Add them below.</p>}
        </>
      )}

      {d.chat === 'vars' && (
        <section aria-label="Variables" className="rounded-xl border border-border-subtle bg-surface p-4">
          <h3 className="text-[14px] font-medium">Variables</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">deployment.yml reads these values at start-up. Enter a name and key for each one.</p>
          <div className="mt-3 inline-flex gap-0.5 rounded-lg bg-background p-0.5" role="tablist">
            {(['secrets', 'variables'] as const).map((t) => (
              <button key={t} role="tab" aria-selected={d.varTab === t} className={cn('rounded-md px-2.5 py-1 text-[13px] capitalize', d.varTab === t ? 'bg-selected text-foreground' : 'text-muted-foreground')} onClick={() => setDep({ varTab: t })}>{t}</button>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-[1fr_1fr_auto] items-center gap-x-2 gap-y-2">
            <span className="text-[12px] text-muted-foreground">Variable name</span><span className="text-[12px] text-muted-foreground">Variable key</span><span />
            {rows.map((r, i) => (
              <div key={i} className="contents">
                <input aria-label="Variable name" className={cn('h-9 rounded-md border bg-transparent px-3 text-[13px] outline-none focus:border-foreground/60', d.varBad && !VALID_NAME.test(r.name) ? 'border-danger' : 'border-input')} value={r.name} onChange={(e) => edit(i, { name: e.target.value })} />
                <div className="relative">
                  <input aria-label="Variable key" type={secret ? 'password' : 'text'} placeholder="Enter key" className="h-9 w-full rounded-md border border-input bg-transparent px-3 pr-9 text-[13px] outline-none placeholder:text-subtle-foreground focus:border-foreground/60" value={r.key} onChange={(e) => edit(i, { key: e.target.value })} />
                  <Icon name="search" size={14} className="absolute top-1/2 right-3 -translate-y-1/2 text-muted-foreground" />
                </div>
                <button aria-label={`Remove ${r.name}`} className="text-muted-foreground hover:text-foreground" onClick={() => setDep({ vars: rows.filter((_, j) => j !== i) })}><Icon name="trash" size={14} /></button>
              </div>
            ))}
          </div>
          {d.varBad && <p className="mt-2 flex items-center gap-1.5 text-[12px] text-danger" role="alert"><Icon name="danger" size={12} /> A variable name can only use capital letters, numbers and underscores, and cannot start with a number.</p>}
          <div className="mt-3 flex items-center justify-between">
            <button className="flex items-center gap-1.5 text-[13px] hover:underline" onClick={() => setDep({ vars: [...rows, { name: '', key: '' }] })}><Icon name="addCircle" size={14} /> Add variable</button>
            <button aria-label="Save variables" disabled={!filled || rows.length === 0} className="grid size-7 place-items-center rounded-md bg-foreground text-background disabled:bg-selected disabled:text-muted-foreground" onClick={saveVars}><Icon name="arrowUp" size={14} /></button>
          </div>
        </section>
      )}

      {d.chat === 'finishing' && (
        <>
          <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Icon name="check" size={14} className="text-success" /> {rows.length} variables saved to Secrets</p>
          <p className="flex items-center gap-2 text-[14px] text-muted-foreground"><Spin size={14} /> Finishing deployment.yml…</p>
        </>
      )}

      {d.chat === 'ready' && (
        <section aria-label="deployment.yml is ready" className="rounded-xl border border-border-subtle bg-surface p-4">
          <h3 className="flex items-center gap-2 text-[15px] font-medium"><Icon name="doc" size={16} /> deployment.yml is ready</h3>
          <ul className="mt-3 flex flex-col gap-2.5 text-[13px]">
            <li className="flex items-center gap-2.5"><Icon name="server" size={14} className="text-muted-foreground" /> {d.where === 'cloud' ? 'Revolte Cloud' : WHERE_LABEL[d.where]} · {d.region}</li>
            <li className="flex items-center gap-2.5"><Icon name="widget" size={14} className="text-muted-foreground" /> Web service · Node 20 · 2 vCPU · 4 GB · 2 replicas</li>
            <li className="flex items-center gap-2.5"><Icon name="database" size={14} className="text-muted-foreground" /> Postgres 16 · 30 GB</li>
            <li className="flex items-center gap-2.5"><Icon name="key" size={14} className="text-muted-foreground" /> {rows.length} variables saved to Secrets</li>
            <li className="flex items-center gap-2.5"><Icon name="shield" size={14} className="text-muted-foreground" /> Checks before deploy: tests, code quality, SAST</li>
          </ul>
          <div className="mt-3 flex items-center justify-between rounded-lg bg-background px-3 py-2.5 text-[13px]">
            <span>deployment.yml <span className="text-muted-foreground">· 42 lines</span></span>
            <button className="underline underline-offset-2" onClick={() => setDep({ yamlOpen: true })}>View YAML</button>
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12px] text-muted-foreground">Deploy now opens the application, where you review the config and launch.</p>
            <Button size="sm" className="h-8 gap-1.5 text-[13px]" onClick={deployNow}><Icon name="rocket" size={14} /> Deploy now</Button>
          </div>
        </section>
      )}

      <Dialog open={d.yamlOpen} onOpenChange={(o) => setDep({ yamlOpen: o })}>
        <DialogContent className="max-w-[560px] border-border-subtle bg-card">
          <DialogTitle className="text-[16px]">deployment.yml</DialogTitle>
          <DialogDescription className="sr-only">The generated deployment configuration</DialogDescription>
          <pre className="max-h-[60vh] overflow-auto rounded-lg bg-background p-3 font-mono text-[12px] leading-5">{YAML}</pre>
          <Button variant="outline" size="sm" className="self-end border-input bg-transparent" onClick={() => (navigator.clipboard?.writeText(YAML), onNote('Copied.'))}>Copy</Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
