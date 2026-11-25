import { useEffect, useRef, useState } from 'react'
import { Icon } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Spin, fmtSecs, useNow } from '@/chat/bits'
import { setTab } from '@/chat/engine'
import type { Chat } from '@/chat/types'
import { NODES, PR_NUMBER, openPicker, rerunWorkflow, runWorkflow, stopWorkflow, tpl } from './state'

const secs = (c: Chat, now: number) => (c.wf?.startedAt ? Math.max(1, Math.round(((c.wf.endedAt ?? now) - c.wf.startedAt) / 1000)) : 0)

function RunGlyph({ state }: { state: 'ready' | 'running' | 'done' | 'failed' }) {
  return (
    <span className={cn('relative grid size-9 shrink-0 place-items-center rounded-lg border border-border-subtle bg-background', state === 'done' && 'text-success', state === 'failed' && 'text-danger')}>
      {state === 'running' ? <Spin size={16} /> : <Icon name={state === 'done' ? 'checkCircle' : state === 'failed' ? 'danger' : 'routing'} size={16} />}
      {state === 'running' && <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full bg-[#5b8def] motion-safe:animate-ping" />}
    </span>
  )
}

/** Chat side of a workflow run: H09 ready, H11 running, H12 finished, H13 stopped at QA. */
export function WorkflowChat({ c, onNote }: { c: Chat; onNote: (s: string) => void }) {
  const now = useNow(c.wf?.stage === 'running')
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const t = setTimeout(() => box.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 120)
    return () => clearTimeout(t)
  }, [c.wf?.stage])
  const w = c.wf
  if (!w) return null
  const t = tpl(w.template)
  const who = ['Starting', 'Developer is working', 'QA is checking', 'Opening the draft PR'][Math.min(w.step, 3)]
  return (
    <div ref={box} className="flex scroll-mb-4 flex-col gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300">
      {w.stage === 'ready' && (
        <>
          <p className="text-[14px] leading-6">{t.title} is filled with the {4} steps of this plan for Webhook monitor. Run it now: it builds, tests and opens a draft pull request on its own, while you keep chatting.</p>
          <section className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-3.5 py-3" aria-label="Workflow ready">
            <RunGlyph state="ready" />
            <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">{t.title}</p><p className="truncate text-[12px] text-muted-foreground">Manual trigger, Developer, QA, Draft PR</p></div>
            <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={openPicker}>Change</Button>
            <Button size="sm" className="h-8 gap-1.5 text-[13px] shadow-[0_0_0_0_rgba(255,255,255,0.5)] motion-safe:animate-[nudge_2.4s_ease-out_1s_2]" onClick={() => runWorkflow(c.id)}><Icon name="play" size={13} /> Run workflow</Button>
          </section>
        </>
      )}
      {w.stage !== 'ready' && (
        <>
          {w.stage === 'running' && <p className="text-[14px] leading-6">Run 1 started on acme/webhook-monitor. You can keep chatting while it runs. The draft PR appears here when it is ready.</p>}
          <section className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-3.5 py-3" aria-label="Workflow run">
            <RunGlyph state={w.stage} />
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-medium">Run 1 · {t.title}</p>
              <p className="truncate text-[12px] text-muted-foreground">{w.stage === 'running' ? `${who} · ${fmtSecs(secs(c, now))}` : w.stage === 'done' ? `Finished in ${fmtSecs(secs(c, now))}` : 'Stopped at QA after 3 attempts'}</p>
            </div>
            <Button variant="outline" size="sm" className="h-8 border-input bg-transparent text-[13px]" onClick={() => setTab(c.id, 'workflow')}>View run</Button>
          </section>
          {w.stage === 'done' && (
            <>
              <p className="text-[14px] leading-6 motion-safe:animate-in motion-safe:fade-in-0">Done. The retry scheduler and the on-call alert are in place, all 24 tests pass, and draft PR #{c.github.pr ?? PR_NUMBER} is open on acme/webhook-monitor for you to review.</p>
              <section className="flex items-center gap-3 rounded-xl border border-success/30 bg-[#12201a] px-3.5 py-3 motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in-0" aria-label="Draft pull request">
                <span className="grid size-9 place-items-center rounded-lg bg-[#17301f] text-success"><Icon name="branch" size={16} /></span>
                <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">Draft PR #{c.github.pr ?? PR_NUMBER} · Add webhook monitor with retry alerts</p><p className="text-[12px] text-muted-foreground">revolte/webhook-dashboard → main · 6 files · +398 −24</p></div>
                <Button size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => onNote('Pull requests open on GitHub in the real product.')}>Review PR <Icon name="out" size={12} /></Button>
              </section>
              <p className="flex items-center gap-2 text-[13px] text-muted-foreground"><Icon name="star" size={13} bold className="text-info" /> Saved to your workflows. Next time, start it from one prompt.</p>
            </>
          )}
          {w.stage === 'failed' && (
            <>
              <p className="flex items-center gap-2 text-[14px] text-danger"><Icon name="danger" size={15} /> Workflow stopped. QA did not pass.</p>
              <p className="text-[14px] leading-6">One test still fails: the retry count resets when an endpoint times out twice. No pull request was opened. Tell me how to handle it, or run it again.</p>
              <div className="flex gap-2">
                <Button size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => rerunWorkflow(c.id)}><Icon name="restart" size={13} /> Run again</Button>
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

const OTHER = [
  { n: 'Nightly test coverage', id: '#002', t: '6m 40s', app: 'Payments API', s: 'Running' },
  { n: 'Review every PR', id: '#003', t: '38s', app: 'customer-banking-api', s: 'Queued' },
]

/** Right pane, Workflow tab: H09 steps before a run, H11-H13 runs with a live timeline. */
export function WorkflowPane({ c, onNote }: { c: Chat; onNote: (s: string) => void }) {
  const now = useNow(c.wf?.stage === 'running')
  const [open, setOpen] = useState(true)
  const w = c.wf
  if (!w)
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 px-8 text-center">
        <span className="grid size-10 place-items-center rounded-xl border border-border-subtle bg-surface"><Icon name="routing" size={18} /></span>
        <p className="text-[14px] font-medium">Run this chat as a workflow</p>
        <p className="max-w-[260px] text-[13px] leading-[18px] text-muted-foreground">A workflow repeats these steps on its own from one prompt: build, test, then a draft pull request.</p>
        <Button size="sm" className="mt-2 h-8 gap-1.5 text-[13px]" onClick={openPicker}><Icon name="star" size={13} bold className="text-info" /> Choose a workflow</Button>
      </div>
    )
  const t = tpl(w.template)
  const nodeState = (i: number): 'done' | 'running' | 'waiting' | 'failed' | 'skipped' => {
    if (w.stage === 'ready') return 'waiting'
    if (w.stage === 'done') return 'done'
    if (w.stage === 'failed') return i < 2 ? 'done' : i === 2 ? 'failed' : 'skipped'
    return i < w.step ? 'done' : i === w.step ? 'running' : 'waiting'
  }
  const status = (i: number) => {
    const s = nodeState(i)
    if (i === 0) return s === 'waiting' ? '' : ''
    if (s === 'running') return `Working · ${fmtSecs(secs(c, now))}`
    if (s === 'done') return i === 1 ? (w.stage === 'failed' ? '3 attempts' : '4s') : i === 2 ? 'Passed' : 'Opened'
    if (s === 'failed') return 'Stopped'
    if (s === 'skipped') return 'Skipped'
    return w.stage === 'ready' ? '' : 'Waiting'
  }
  const badge = w.stage === 'running' ? ['Running', 'bg-[#16264d] text-[#8fb0ff]', 'bg-[#5b8def]'] : w.stage === 'done' ? ['Success', 'bg-[#12301d] text-[#7fe0a0]', 'bg-success'] : w.stage === 'failed' ? ['Failed', 'bg-[#3a1717] text-[#ff8c8c]', 'bg-danger'] : ['Ready', 'bg-muted text-muted-foreground', 'bg-muted-foreground']
  if (w.stage === 'ready')
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="flex-1 overflow-y-auto p-4">
          <h3 className="mb-3 px-1 text-[12px] text-muted-foreground">Workflow steps</h3>
          <ol className="px-1">
            {NODES.map((n, i) => (
              <li key={n.title} className="relative flex gap-3 pb-4 last:pb-0 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1" style={{ animationDelay: `${i * 80}ms`, animationFillMode: 'both' }}>
                {i < NODES.length - 1 && <span className="absolute top-5 bottom-0 left-[7px] w-px bg-border-subtle" />}
                <span className="grid h-[22px] w-4 place-items-center"><span className="size-2 rounded-full border border-subtle-foreground" /></span>
                <div><p className="text-[14px] font-medium">{n.title === 'Manual' ? 'Manual trigger' : n.title}</p><p className="text-[12px] text-subtle-foreground">{n.sub.replace('acme/webhook-monitor', c.github.repo)}</p></div>
              </li>
            ))}
          </ol>
        </div>
        <div className="border-t border-border-subtle px-5 py-4">
          <p className="flex items-center gap-2 text-[14px] font-medium"><Icon name="routing" size={15} /> {t.title}</p>
          <p className="mt-1 text-[12px] text-muted-foreground">Ready. No runs yet.</p>
          <Button size="sm" className="mt-3 h-8 w-full gap-1.5 text-[13px]" onClick={() => runWorkflow(c.id)}><Icon name="play" size={13} /> Run workflow</Button>
        </div>
      </div>
    )
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <h3 className="px-1 text-[14px] font-medium">{w.stage === 'running' ? 'Running workflows' : 'Workflows'}</h3>
      <p className="mb-3 px-1 text-[12px] text-muted-foreground">{w.stage === 'running' ? 3 : 2} active · Webhook monitor · Acme Corp</p>
      <section className="rounded-xl border border-border-subtle bg-surface">
        <div className="flex items-start gap-2 px-3.5 py-3">
          <button aria-label={open ? 'Collapse' : 'Expand'} className="mt-0.5 text-muted-foreground" onClick={() => setOpen(!open)}><Icon name={open ? 'down' : 'right'} size={14} /></button>
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-medium">{t.title}</p>
            <p className="text-[12px] text-muted-foreground">#001 · {fmtSecs(secs(c, now))} · Webhook monitor</p>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="flex items-center gap-2">
              <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px]', badge[1])}><span className={cn('size-1.5 rounded-full', badge[2], w.stage === 'running' && 'motion-safe:animate-pulse')} /> {badge[0]}</span>
              {w.stage === 'running' && <button aria-label="Stop run" title="Stop run" className="grid size-4 place-items-center rounded-[3px] bg-muted-foreground/60 hover:bg-foreground" onClick={() => stopWorkflow(c.id)} />}
            </span>
            <button className="text-[12px] hover:underline" onClick={() => onNote('Run details open in the studio, which comes later.')}>View details</button>
          </div>
        </div>
        {open && (
          <ol className="border-t border-border-subtle px-3.5 py-3">
            {NODES.map((n, i) => {
              const s = nodeState(i)
              return (
                <li key={n.title} className="relative flex gap-3 pb-3.5 last:pb-0">
                  {i < NODES.length - 1 && <span className={cn('absolute top-[40px] -bottom-1 left-[7px] w-px transition-colors duration-500', s === 'done' ? 'bg-muted-foreground/50' : 'bg-border-subtle')} />}
                  <span className="mt-4 grid h-[22px] w-4 shrink-0 place-items-center">
                    {s === 'done' ? <Icon name="check" size={13} className="text-muted-foreground motion-safe:animate-[pop_350ms_ease-out]" /> : s === 'running' ? <span className="relative grid size-2 place-items-center"><span className="absolute size-2 rounded-full bg-foreground motion-safe:animate-ping" /><span className="size-2 rounded-full bg-foreground" /></span> : s === 'failed' ? <Icon name="close" size={13} className="text-danger" /> : <span className="size-2 rounded-full border border-subtle-foreground" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] text-subtle-foreground">{n.kind}</p>
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-[14px] font-medium', (s === 'waiting' || s === 'skipped') && 'text-muted-foreground')}>{n.title}</p>
                      <span className={cn('text-[13px]', s === 'running' ? 'text-foreground' : s === 'failed' ? 'text-foreground' : 'text-muted-foreground')}>{status(i)}</span>
                    </div>
                    <p className="text-[12px] text-subtle-foreground">{i === 0 ? `Started from chat · ${new Date(w.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : i === 2 && s === 'failed' ? '1 test failed' : i === 3 && w.stage === 'done' ? `PR #${c.github.pr ?? PR_NUMBER} on ${c.github.repo}` : i === 3 && s === 'skipped' ? 'Not opened' : n.sub.replace('acme/webhook-monitor', c.github.repo)}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        )}
      </section>
      {OTHER.map((o) => (
        <section key={o.id} className="mt-3 flex items-start gap-2 rounded-xl border border-border-subtle bg-surface px-3.5 py-3">
          <Icon name="right" size={14} className="mt-0.5 text-muted-foreground" />
          <div className="min-w-0 flex-1"><p className="text-[14px] font-medium">{o.n}</p><p className="text-[12px] text-muted-foreground">{o.id} · {o.t} · {o.app}</p></div>
          <span className={cn('flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[12px]', o.s === 'Running' ? 'bg-[#16264d] text-[#8fb0ff]' : 'bg-muted text-muted-foreground')}><span className={cn('size-1.5 rounded-full', o.s === 'Running' ? 'bg-[#5b8def]' : 'bg-muted-foreground')} /> {o.s}</span>
        </section>
      ))}
    </div>
  )
}
