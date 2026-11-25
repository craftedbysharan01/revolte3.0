import { useState } from 'react'
import { Icon } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { openApp } from '@/chat/openApp'
import { Spin } from '@/chat/bits'
import { Pick, Switch } from './bits'
import { APP_URL, BRANCHES, launch, openChat, saveAndLaunch, setDep } from './state'
import { YAML } from './yaml'

const TABS = ['Overview', 'YML config', 'Workflow runs', 'Logs', 'Pipelines', 'Environments', 'Pull requests', 'Storage', 'Database', 'Secrets', 'Settings']

function Card({ title, desc, children }: { title: string; desc: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-5">
      <h3 className="text-[15px] font-medium">{title}</h3>
      <p className="mt-1.5 mb-4 text-[13px] text-muted-foreground">{desc}</p>
      {children}
    </section>
  )
}

/** D13-D16b: Application page, YML config tab. */
export function AppPage({ onNote }: { onNote: (s: string) => void }) {
  const d = useStore((s) => s.dep)
  const [branch, setBranch] = useState('revolte/webhook-dashboard')
  const [env, setEnv] = useState('Production')
  const [checks, setChecks] = useState({ tests: true, quality: true, sast: true, ai: false })
  const live = d.launch === 'live'
  const going = d.launch === 'launching'
  const lines = YAML.split('\n')
  const CHECKS: [keyof typeof checks, string, string, boolean?][] = [
    ['tests', 'Automated tests', 'Makes sure each component works as expected.'],
    ['quality', 'Code quality', 'Readability, efficiency and lint rules.'],
    ['sast', 'SAST', 'Finds security issues before deployment.', true],
    ['ai', 'AI code review', 'The Code reviewer agent comments on risky changes.'],
  ]
  return (
    <div className="relative flex min-h-0 flex-1 flex-col" aria-label="Application">
      {d.toast && (
        <div role="status" className="absolute top-3 right-4 z-30 flex w-[360px] items-start gap-3 rounded-xl border border-border-subtle bg-card px-4 py-3 shadow-lg motion-safe:animate-in motion-safe:slide-in-from-top-2 motion-safe:fade-in-0">
          <span className="mt-0.5 grid size-4 place-items-center rounded-full bg-success text-background"><Icon name="check" size={10} /></span>
          <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">Webhook monitor is live</p><p className="truncate text-[13px] text-muted-foreground">{APP_URL}</p></div>
          <button aria-label="Close" className="text-muted-foreground" onClick={() => setDep({ toast: false })}><Icon name="close" size={14} /></button>
        </div>
      )}
      <header className="flex items-center justify-between px-6 pt-5">
        <p className="text-[14px]"><span className="text-muted-foreground">{d.project} / </span><span className="font-medium">{d.name}</span></p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="h-8 gap-1.5 border-input bg-transparent text-[13px]" onClick={openChat}><Icon name="chat" size={14} /> Open chat</Button>
          <button aria-label="More" className="grid size-8 place-items-center text-muted-foreground" onClick={() => onNote('Not available in the prototype.')}><Icon name="dots" size={16} /></button>
        </div>
      </header>
      <nav className="mt-3 flex gap-5 overflow-x-auto border-b border-border-subtle px-6" aria-label="Application sections">
        {TABS.map((t) => (
          <button key={t} aria-current={t === 'YML config'} className={cn('relative shrink-0 pt-1 pb-3 text-[13px]', t === 'YML config' ? 'text-foreground after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-foreground' : 'text-muted-foreground hover:text-foreground')} onClick={() => t !== 'YML config' && onNote(`${t} comes in a later module.`)}>{t}</button>
        ))}
      </nav>

      <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_minmax(0,440px)] gap-5 overflow-y-auto p-5">
        <div className="flex flex-col gap-4">
          <Card title="Deployment context" desc="Where the code comes from and where it deploys.">
            <div className="grid grid-cols-2 gap-3">
              <div><p className="mb-1.5 text-[13px]">Source branch</p><Pick value={branch} items={BRANCHES.map((b) => ({ id: b, label: b }))} onPick={setBranch} disabled={going || live} /></div>
              <div><p className="mb-1.5 text-[13px]">Target environment</p><Pick value={env} items={['Dev', 'QA', 'Staging', 'Production'].map((b) => ({ id: b, label: b }))} onPick={setEnv} disabled={going || live} /></div>
            </div>
            {env === 'Production' && <p className="mt-3 flex items-center gap-2 text-[13px]"><Icon name="warn" size={14} className="text-warning" /> Production deployment. This configuration applies straight to Production.</p>}
          </Card>
          <Card title="Checks before deploy" desc="Run on every push before Revolte builds the image.">
            <ul className="flex flex-col gap-4">
              {CHECKS.map(([k, t, s, rec]) => (
                <li key={k} className="flex items-center justify-between gap-4">
                  <div><p className="flex items-center gap-2 text-[13px] font-medium">{t}{rec && <span className="flex items-center gap-1 rounded-md border border-border-subtle bg-selected px-1.5 py-0.5 text-[11px] font-normal"><Icon name="star" size={10} bold /> Recommended</span>}</p><p className="text-[12px] text-muted-foreground">{s}</p></div>
                  <Switch on={checks[k]} label={t} onChange={(v) => setChecks({ ...checks, [k]: v })} />
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="flex min-h-0 flex-col overflow-hidden rounded-xl border border-border-subtle bg-surface">
          <div className="flex items-center gap-2 px-4 py-3 text-[13px]">
            <Icon name="doc" size={14} className="text-muted-foreground" /> deployment.yml
            <span className="ml-auto flex items-center gap-1.5 rounded-full bg-[#12301d] px-2 py-0.5 text-[12px] text-[#7fe0a0]"><span className="size-1.5 rounded-full bg-success" /> Valid</span>
            <button aria-label="Copy" className="text-muted-foreground" onClick={() => (navigator.clipboard?.writeText(YAML), onNote('Copied.'))}><Icon name="copy" size={14} /></button>
          </div>
          <pre className="min-h-0 flex-1 overflow-auto bg-background py-3 font-mono text-[12px] leading-[21px]">
            {lines.map((l, i) => (
              <div key={i} className="flex"><span className="w-10 shrink-0 pr-3 text-right text-subtle-foreground select-none">{i + 1}</span><span className="whitespace-pre text-muted-foreground">{l}</span></div>
            ))}
          </pre>
        </div>
      </div>

      <footer className="relative flex items-center justify-between gap-4 border-t border-border-subtle px-6 py-4">
        {(going || live) && <span className={cn('absolute -top-px left-0 h-0.5 transition-[width] duration-500', live ? 'bg-success' : 'bg-[#5b8def]')} style={{ width: `${live ? 100 : d.pct}%` }} />}
        {d.launch === 'launching' ? (
          <>
            <p className="text-[13px]"><b className="mr-2 font-medium">{d.pct}%</b> Provisioning your cloud. This takes a few minutes. <span className="ml-2 text-muted-foreground">{d.pct > 20 ? 'Secrets saved' : ''}{d.pct > 35 ? ' · Checks passed' : ''}{d.pct > 55 ? ' · Image built' : ''}</span></p>
            <Button size="sm" className="h-9 gap-2" disabled><Spin size={14} className="invert" /> Launching</Button>
          </>
        ) : live ? (
          <>
            <p className="flex items-center gap-2 text-[13px]"><span className="grid size-4 place-items-center rounded-full bg-success text-background"><Icon name="check" size={10} /></span><b className="font-medium">Webhook monitor is live.</b> <span className="text-muted-foreground">{APP_URL} · version 1 · health check passed</span></p>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9 border-input bg-transparent" onClick={() => onNote('Logs come in a later module.')}>View logs</Button>
              <Button size="sm" className="h-9 gap-1.5" onClick={openApp}><Icon name="out" size={13} /> Open app</Button>
            </span>
          </>
        ) : (
          <>
            <p className="text-[13px] text-muted-foreground">Launching deploys {branch} to {env} on Revolte Cloud · {d.region}. About $112 a month.</p>
            <Button size="sm" className="h-9" onClick={launch}>Launch application</Button>
          </>
        )}
      </footer>

      {/* D14 */}
      <Dialog open={d.launch === 'secrets'} onOpenChange={(o) => !o && setDep({ launch: 'idle' })}>
        <DialogContent showCloseButton={false} className="max-w-[500px] gap-0 border-border-subtle bg-card p-6">
          <button aria-label="Close" className="absolute top-5 right-5 text-muted-foreground" onClick={() => setDep({ launch: 'idle' })}><Icon name="close" size={16} /></button>
          <DialogTitle className="text-[20px] font-semibold">Missing deployment secrets</DialogTitle>
          <DialogDescription className="mt-1 text-[14px] leading-5 text-muted-foreground">2 variables in deployment.yml have no value for Production. Add them to launch.</DialogDescription>
          {(['STRIPE_SECRET_KEY', 'SENTRY_DSN'] as const).map((n, i) => (
            <div key={n} className="mt-4"><p className="mb-1.5 text-[13px] font-medium">{n}</p><input className="h-9 w-full rounded-md border border-input bg-transparent px-3 text-[14px] outline-none placeholder:text-subtle-foreground focus:border-foreground/60" type="password" placeholder="Enter value" value={d.secrets[i]} onChange={(e) => { const s: [string, string] = [...d.secrets]; s[i] = e.target.value; setDep({ secrets: s }) }} /></div>
          ))}
          <button className="mt-4 flex items-center gap-1.5 text-[13px]" onClick={() => onNote('Extra variables are added from Secrets in the real product.')}><Icon name="plus" size={13} /> Add another variable</button>
          <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground"><Icon name="lock" size={13} /> Saved encrypted to Webhook monitor Secrets. Never written to the repository.</p>
          <div className="mt-4 flex justify-end gap-2">
            <Button variant="outline" size="sm" className="h-9 border-input bg-transparent" onClick={() => setDep({ launch: 'idle' })}>Cancel</Button>
            <Button size="sm" className="h-9" disabled={!d.secrets[0].trim() || !d.secrets[1].trim()} onClick={saveAndLaunch}>Save and launch</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* D16a */}
      <Dialog open={d.sugg && live} onOpenChange={(o) => setDep({ sugg: o })}>
        <DialogContent showCloseButton={false} className="max-w-[520px] gap-0 overflow-hidden border-border-subtle bg-card p-0">
          <button aria-label="Close" className="absolute top-4 right-4 z-10 text-white/80" onClick={() => setDep({ sugg: false })}><Icon name="close" size={16} /></button>
          <div className="grid h-[232px] place-items-center bg-gradient-to-br from-[#e8845a] via-[#b8573a] to-[#5a2c22] p-6">
            <div className="flex flex-col items-center gap-5 text-[13px] text-white">
              <span className="flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2"><Icon name="chat" size={14} /> Build a webhook delivery dashboard</span>
              <span className="flex gap-3">{['Trigger', 'Developer', 'QA', 'Deploy'].map((t) => <span key={t} className="flex items-center gap-2 rounded-lg bg-black/70 px-3 py-2">{t}</span>)}</span>
              <span className="text-[12px] text-white/90">One prompt. The same steps, every time.</span>
            </div>
          </div>
          <div className="p-6">
            <p className="flex items-center gap-2 text-[13px]"><span className="size-1.5 rounded-full bg-success" /> Webhook monitor is live</p>
            <DialogTitle className="mt-3 text-[20px] font-semibold">Next time, let a workflow do these steps</DialogTitle>
            <DialogDescription className="mt-2 text-[14px] leading-5 text-muted-foreground">You planned, built, tested and deployed this in chat. A workflow runs the same steps on its own from one prompt, and you review the result.</DialogDescription>
          </div>
          <div className="flex items-center justify-between border-t border-border-subtle px-6 py-4">
            <button className="text-[13px]" onClick={() => setDep({ sugg: false })}>Not now</button>
            <span className="flex gap-2">
              <Button variant="outline" size="sm" className="h-9 gap-1.5 border-input bg-transparent" onClick={openApp}>Open app <Icon name="out" size={12} /></Button>
              <Button size="sm" className="h-9 gap-1.5" onClick={() => (setDep({ sugg: false }), onNote('Workflow saved|Next time this runs from one prompt.'))}><Icon name="star" size={13} bold /> Turn this into a workflow</Button>
            </span>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
