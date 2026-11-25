import { useEffect, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Popover, PopoverAnchor, PopoverContent } from '@/components/ui/popover'
import { Textarea } from '@/components/ui/textarea'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { getState, setState, useStore } from '@/store'
import { APP_URL } from '@/deploy/model'
import { GithubMark } from '@/ui/Icon'
import { Overline, Spin } from './bits'
import { openApp } from './openApp'
import { openWizard } from '@/deploy/state'
import { WorkflowPane } from '@/workflow/Run'
import { commitAndPush, createPr, githubConnected, retrySandbox, setBgOpen, setTab } from './engine'
import { fmtSecs, useNow } from './bits'
import { SANDBOX_APP } from './sandboxApp'
import { TASKS, type BgTask, type Chat, type Tab } from './types'

const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'overview', label: 'Overview', icon: 'widget' },
  { id: 'sandbox', label: 'Sandbox', icon: 'monitor' },
  { id: 'code', label: 'Code changes', icon: 'code' },
  { id: 'files', label: 'Files', icon: 'folder' },
  { id: 'workflow', label: 'Workflow', icon: 'routing' },
]

const verified = (c: Chat) => c.phase === 'done'

/* ---------- Progress ---------- */

type Item = { title: string; sub?: string; status: string; state: 'done' | 'active' | 'pending' | 'failed' | 'stopped'; nested?: { text: string; status: string; state: 'done' | 'running' | 'queued' | 'failed' }[] }

function progress(c: Chat): Item[] {
  const p = c.phase
  const answered = c.answers.length === 3
  const tasksDone = c.tasks.filter((t) => t === 'done').length
  const planDone = c.planApproved
  const grill: Item = (() => {
    if (p === 'sandbox-failed') return { title: 'Grill', sub: 'Sandbox did not start', status: 'Failed', state: 'failed' }
    if (p === 'thinking') return { title: 'Grill', sub: 'Reading your request', status: 'In progress', state: 'active' }
    if (p === 'asking') return { title: 'Grill', sub: '3 questions', status: 'Needs your answers', state: 'active' }
    if (p === 'lost' && !answered) return { title: 'Grill', sub: 'Connection lost', status: 'Paused', state: 'stopped' }
    if (c.skipped) return { title: 'Grill', sub: 'Used recommended answers', status: 'Skipped', state: 'done' }
    return { title: 'Grill', status: '3 answered', state: 'done' }
  })()
  const plan: Item = (() => {
    if (planDone) return { title: 'Plan', status: 'Approved', state: 'done' }
    if (p === 'planning') return { title: 'Plan', sub: 'Drafting the plan', status: 'In progress', state: 'active' }
    if (p === 'revising') return { title: 'Plan', sub: 'Applying your feedback', status: 'Revising', state: 'active' }
    if (p === 'plan') return { title: 'Plan', sub: 'Decisions and tasks', status: 'Needs your approval', state: 'active' }
    return { title: 'Plan', sub: 'Decisions and tasks', status: '', state: 'pending' }
  })()
  const taskStatus = (t: string, i: number) => (t === 'done' ? 'Done' : t === 'running' ? (c.review?.length ? 'Waiting for you' : 'Running') : i === c.tasks.findIndex((x) => x !== 'done') && p === 'stopped' ? 'Stopped' : 'Queued')
  const tasks: Item = (() => {
    if (!planDone) return { title: 'Tasks', sub: 'Split from your request', status: '', state: 'pending' }
    const nested = TASKS.map((text, i) => ({ text, status: taskStatus(c.tasks[i], i), state: (c.tasks[i] === 'done' ? 'done' : c.tasks[i] === 'running' ? 'running' : 'queued') as 'done' | 'running' | 'queued' }))
    if (p === 'developing') return { title: 'Tasks', sub: '5 tasks', status: 'In progress', state: 'active', nested }
    if (p === 'stopped' && c.resumeFrom === 'developing') return { title: 'Tasks', sub: `${tasksDone} of 5 done`, status: 'Stopped', state: 'stopped' }
    if (p === 'credits' || p === 'hours') return { title: 'Tasks', status: `${tasksDone} of 5`, state: 'done' }
    if (p === 'lost' && tasksDone < 5) return { title: 'Tasks', sub: `${tasksDone} of 5 done`, status: 'Paused', state: 'stopped' }
    return { title: 'Tasks', status: '5 of 5', state: 'done' }
  })()
  const buildDone = ['verifying', 'failed', 'done'].includes(p) || (p === 'stopped' && c.resumeFrom === 'verifying')
  const build: Item = (() => {
    if (p === 'credits') return { title: 'Build', sub: 'Paused: out of credits', status: 'Paused', state: 'stopped' }
    if (p === 'hours') return { title: 'Build', sub: 'Paused: sandbox hours used up', status: 'Paused', state: 'stopped' }
    if (buildDone) return { title: 'Build', status: 'Done', state: 'done' }
    return { title: 'Build', sub: 'Retry scheduler with backoff', status: '', state: 'pending' }
  })()
  const v = c.verify
  const verifyNested = [
    { text: 'Lint', status: v.lint === 'done' ? 'Passed' : v.lint === 'running' ? 'Running' : 'Queued', state: v.lint === 'done' ? 'done' : v.lint === 'running' ? 'running' : 'queued' },
    { text: 'Tests', status: v.tests === 'done' ? `${v.passed} of 24` : v.tests === 'failed' ? `${v.passed} of 24` : v.tests === 'running' ? `${v.passed || 23} of 24` : 'Queued', state: v.tests === 'done' ? 'done' : v.tests === 'failed' ? 'failed' : v.tests === 'running' ? 'running' : 'queued' },
    { text: 'Prettier', status: v.prettier === 'done' ? 'Passed' : v.prettier === 'running' ? 'Running' : 'Queued', state: v.prettier === 'done' ? 'done' : v.prettier === 'running' ? 'running' : 'queued' },
  ] as Item['nested']
  const verify: Item = (() => {
    if (p === 'done') return { title: 'Verify', status: 'Passed', state: 'done' }
    if (p === 'failed') return { title: 'Verify', sub: '1 test still fails after 3 attempts', status: 'Failed', state: 'failed', nested: verifyNested }
    if (p === 'verifying') return v.attempt > 1 && v.tests !== 'done' && v.prettier !== 'running' ? { title: 'Verify', sub: '1 test failed. Fixing and running again.', status: `Retry ${v.attempt} of 3`, state: 'active', nested: verifyNested } : { title: 'Verify', sub: v.attempt > 1 ? `Fixed on retry ${v.attempt}` : undefined, status: 'In progress', state: 'active', nested: verifyNested }
    if (p === 'stopped' && c.resumeFrom === 'verifying') return { title: 'Verify', status: 'Stopped', state: 'stopped' }
    return { title: 'Verify', sub: 'Tests, lint, Prettier', status: '', state: 'pending' }
  })()
  return [grill, plan, tasks, build, verify]
}

function Marker({ state }: { state: Item['state'] }) {
  if (state === 'done') return <Icon name="check" size={13} className="motion-safe:animate-[pop_350ms_ease-out] text-muted-foreground" />
  if (state === 'failed') return <Icon name="close" size={13} className="text-foreground" />
  if (state === 'stopped') return <span className="size-2 rounded-[2px] bg-muted-foreground" />
  if (state === 'active') return <span className="size-2 rounded-full bg-foreground" />
  return <span className="size-2 rounded-full border border-subtle-foreground" />
}

function Progress({ c }: { c: Chat }) {
  const items = progress(c)
  return (
    <section aria-label="Progress" className="px-1">
      <h3 className="mb-3 text-[12px] text-muted-foreground">Progress</h3>
      <ol>
        {items.map((it, i) => (
          <li key={it.title} className="relative flex gap-3 pb-3.5 last:pb-0" aria-current={it.state === 'active' ? 'step' : undefined}>
            {i < items.length - 1 && <span className="absolute top-5 bottom-0 left-[7px] w-px bg-border-subtle" aria-hidden="true" />}
            <span className="grid h-[22px] w-4 shrink-0 place-items-center">
              <Marker state={it.state} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3 text-[14px] leading-[22px]">
                <span className={cn('font-medium', it.state === 'pending' ? 'text-muted-foreground' : 'text-foreground')}>{it.title}</span>
                <span className={cn('text-[13px]', it.state === 'active' ? 'font-medium text-foreground' : 'text-muted-foreground')}>{it.status}</span>
              </div>
              {it.sub && <p className="text-[12px] leading-4 text-subtle-foreground">{it.sub}</p>}
              {it.nested && (
                <ul className="mt-2.5 flex flex-col gap-1.5 pb-1">
                  {it.nested.map((n) => (
                    <li key={n.text} className="flex items-center gap-2.5 pl-1 text-[13px] leading-[18px]">
                      <span className="grid w-3 place-items-center">
                        {n.state === 'running' ? <Spin size={12} /> : n.state === 'done' ? <Icon name="check" size={12} className="text-muted-foreground" /> : n.state === 'failed' ? <Icon name="close" size={12} className="text-danger" /> : <span className="size-1.5 rounded-full border border-subtle-foreground" />}
                      </span>
                      <span className={n.state === 'queued' ? 'text-subtle-foreground' : n.state === 'failed' ? 'text-danger' : 'text-foreground'}>{n.text}</span>
                      <span className="ml-auto text-[12px] text-subtle-foreground">{n.status}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </li>
        ))}
      </ol>
    </section>
  )
}

/* ---------- EC06-EC08 Background tasks ---------- */

function BgRow({ b, open, onToggle }: { b: BgTask; open: boolean; onToggle: () => void }) {
  const now = useNow(b.state === 'running')
  const secs = Math.max(0, Math.round((now - b.startedAt) / 1000))
  return (
    <li>
      <button className="flex w-full items-start gap-2.5 py-1.5 text-left" aria-expanded={open} onClick={onToggle}>
        <Icon name="codeSquare" size={16} className="mt-0.5 text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-[13px]">
            {b.cmd} {b.state === 'running' && <span className="size-1.5 rounded-full bg-info" />}
          </span>
          <span className="text-[12px] text-subtle-foreground">Bash · {fmtSecs(secs || 1)}</span>
        </span>
      </button>
      {open && (
        <pre className="mb-2 overflow-x-auto rounded-lg border border-border-subtle bg-background p-3 font-mono text-[12px] leading-5 whitespace-pre-wrap" aria-label={`Output of ${b.cmd}`}>
          <span className="mb-1 flex justify-between font-sans text-[11px] text-subtle-foreground">
            <span>bash</span>
            <span>{fmtSecs(secs || 1)}</span>
          </span>
          {b.out.map((l, i) => (
            <span key={i} className={cn('flex gap-3', l.startsWith('✓') && 'text-success', l.startsWith('○') && 'text-muted-foreground')}>
              <span className="w-3 text-right text-subtle-foreground select-none">{i + 1}</span>
              {l}
            </span>
          ))}
        </pre>
      )}
    </li>
  )
}

export function BackgroundTasks({ c }: { c: Chat }) {
  const [openId, setOpenId] = useState<string | null>(null)
  const [fin, setFin] = useState(false)
  const run = (c.bg ?? []).filter((b) => b.state === 'running')
  const done = (c.bg ?? []).filter((b) => b.state === 'finished')
  return (
    <aside aria-label="Background tasks" className="flex min-h-0 flex-1 flex-col">
      <header className="flex items-center px-5 pt-5 text-[14px] font-medium">
        Background tasks
        <button aria-label="Close background tasks" className="ml-auto text-muted-foreground hover:text-foreground" onClick={() => setBgOpen(c.id, false)}>
          <Icon name="close" size={16} />
        </button>
      </header>
      <p className="px-5 pt-2 text-[13px] leading-[18px] text-muted-foreground">Commands Revolte started and left running. They keep going while Revolte works on other steps. Open one to see its live output.</p>
      <div className="mt-5 min-h-0 flex-1 overflow-y-auto px-5">
        <Overline>Running · {run.length}</Overline>
        <ul className="mt-2 flex flex-col">{run.map((b) => <BgRow key={b.id} b={b} open={openId === b.id} onToggle={() => setOpenId(openId === b.id ? null : b.id)} />)}</ul>
        {run.length === 0 && <p className="mt-2 text-[13px] text-subtle-foreground">Nothing is running.</p>}
        <button className="mt-4 flex items-center gap-1 text-[10px] font-semibold tracking-[0.7px] text-subtle-foreground uppercase" aria-expanded={fin} onClick={() => setFin(!fin)}>
          Finished · {done.length} <Icon name={fin ? 'down' : 'right'} size={11} />
        </button>
        {fin && <ul className="mt-2 flex flex-col">{done.map((b) => <BgRow key={b.id} b={b} open={openId === b.id} onToggle={() => setOpenId(openId === b.id ? null : b.id)} />)}</ul>}
      </div>
    </aside>
  )
}

/* ---------- Summary ---------- */

function Summary({ c }: { c: Chat }) {
  const accounts = useStore((s) => s.accounts)
  const session = useStore((s) => s.session)
  const ws = accounts.find((a) => a.email === session?.email)?.workspace?.name ?? 'Acme Corp'
  const gh = c.github.connected
  const app = gh && (c.github.pushed || c.github.pr)
  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-3.5" aria-label="Summary">
      <div className="flex items-center gap-2 text-[14px] font-medium">
        <Icon name="monitor" size={16} className="text-foreground" />
        {app ? 'Webhook dashboard' : 'Summary'}
        {c.app ? (
          <span className="ml-auto flex items-center gap-1.5 text-[12px] font-normal text-muted-foreground">
            <Icon name="box" size={13} /> {c.app}
          </span>
        ) : c.phase === 'done' ? (
          <button className="ml-auto text-[12px] font-normal text-foreground underline underline-offset-2" onClick={() => setState({ appDialog: true })}>
            Choose application
          </button>
        ) : (
          c.phase !== 'thinking' && <span className="ml-auto text-[12px] font-normal text-subtle-foreground">{ws}</span>
        )}
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-1 text-[13px]">
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5">
            <GithubMark size={11} />
            <Overline>Repo</Overline>
          </dt>
          <dd className="mt-1 truncate leading-[18px]">{gh ? c.github.repo : 'Not connected'}</dd>
        </div>
        <div className="min-w-0">
          <dt className="flex items-center gap-1.5">
            <Icon name="branch" size={11} className="text-subtle-foreground" />
            <Overline>Branch</Overline>
          </dt>
          <dd className="mt-1 truncate leading-[18px]">{gh ? c.github.branch : 'None yet'}</dd>
        </div>
      </dl>
      {c.sandbox === 'failed' || c.sandbox === 'disconnected' ? (
        <div className="mt-4 flex items-center justify-between">
          <span className="flex items-center gap-1.5 rounded-md bg-[#1c1c1e] px-2 py-1 text-[12px] text-muted-foreground">
            <span className="size-1.5 rounded-full bg-warning" /> Sandbox disconnected
          </span>
          <Button variant="outline" size="sm" className="h-7 border-input bg-transparent text-[12px]" onClick={() => retrySandbox(c.id)}>
            Reconnect
          </Button>
        </div>
      ) : (
        <span className="mt-4 inline-flex items-center gap-1.5 rounded-md bg-[#1c1c1e] px-2 py-1 text-[12px] text-muted-foreground">
          <span className={cn('size-1.5 rounded-full', c.sandbox === 'starting' ? 'bg-warning' : 'bg-success')} /> 2 vCPU | 4 GB | 40 GiB
        </span>
      )}
    </section>
  )
}

/* ---------- Pull request / GitHub ---------- */

export function GithubDialog({ id, open, onOpenChange, onDone }: { id: string; open: boolean; onOpenChange: (o: boolean) => void; onDone: (s: string) => void }) {
  const [gate, setGate] = useState<'idle' | 'waiting' | 'failed'>('idle')
  const [token, setToken] = useState(false)
  useEffect(() => {
    if (open) {
      setGate('idle')
      setToken(false)
    }
  }, [open])
  const connect = () => {
    setGate('waiting')
    setTimeout(() => {
      if (getState().net.offline || getState().net.failGithub) return setGate('failed')
      githubConnected(id)
      onOpenChange(false)
      onDone('GitHub connected|Webhook monitor is created and ready to commit.')
    }, 1800)
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 border-border-subtle bg-card p-0">
        <div className="p-6 pb-5">
          <DialogHeader className="mb-4 gap-1.5 text-left">
            <DialogTitle className="text-[20px] leading-7 font-semibold">Connect GitHub</DialogTitle>
            <DialogDescription className="text-[14px] leading-[22px] text-muted-foreground">Revolte needs access to a repository to push this build and open a pull request.</DialogDescription>
          </DialogHeader>
          {gate === 'failed' && (
            <p className="mb-3 flex items-start gap-2 rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-[13px]" role="alert">
              <Icon name="danger" size={14} className="mt-0.5 text-danger" /> GitHub did not finish connecting. Check that the Revolte app is installed, then try again.
            </p>
          )}
          {token ? (
            <div className="flex flex-col gap-3">
              <label className="text-[13px] font-medium" htmlFor="pat">
                Personal access token
              </label>
              <input id="pat" type="password" autoComplete="off" placeholder="ghp_…" className="h-9 rounded-md border border-input bg-transparent px-3 text-[14px] outline-none focus:border-foreground/60" />
              <Button className="h-9" onClick={connect}>
                Connect with token
              </Button>
            </div>
          ) : (
            <>
              <Button className="h-9 w-full gap-2 text-[14px]" disabled={gate === 'waiting'} onClick={connect}>
                {gate === 'waiting' ? <Spin size={14} className="invert" /> : <GithubMark size={16} />}
                {gate === 'waiting' ? 'Waiting for GitHub…' : gate === 'failed' ? 'Try again' : 'Continue to GitHub'}
                {gate !== 'waiting' && <Icon name="out" size={12} />}
              </Button>
              <div className="my-3 flex items-center gap-3 text-[12px] text-subtle-foreground before:h-px before:flex-1 before:bg-border-subtle after:h-px after:flex-1 after:bg-border-subtle">or</div>
              <Button variant="outline" className="h-9 w-full gap-2 border-input bg-transparent text-[14px]" disabled={gate === 'waiting'} onClick={() => setToken(true)}>
                <Icon name="key" size={16} /> Use a personal access token
              </Button>
            </>
          )}
          <p className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
            <Icon name="shield" size={14} /> Revolte asks for access to code and pull requests only.
          </p>
        </div>
        <div className="border-t border-border-subtle px-6 py-3.5">
          <button className="inline-flex items-center gap-1.5 text-[12px] text-foreground" onClick={() => onDone('How Revolte uses your data opens in the real product.')}>
            How Revolte uses your data <Icon name="out" size={11} />
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function PullRequest({ c, onConnect, onNote }: { c: Chat; onConnect: () => void; onNote: (s: string) => void }) {
  const [msg, setMsg] = useState('Add webhook monitor with retry alerts')
  const [form, setForm] = useState(false)
  const [title, setTitle] = useState('Add webhook monitor with retry alerts')
  const [desc, setDesc] = useState('Retries failed webhooks three times and alerts the team when they still fail.')
  const [err, setErr] = useState(false)
  const g = c.github
  const done = verified(c)

  if (g.pr)
    return (
      <>
        <h3 className="flex items-center gap-2 text-[14px] font-medium">
          <Icon name="branch" size={16} /> Pull request
        </h3>
        <p className="mt-2 text-[12px] leading-4 text-muted-foreground">Draft PR #{g.pr} is open on {g.repo} with a summary, changes, tests and decisions.</p>
        <div className="mt-3 flex gap-2">
          <Button size="sm" className="h-8 text-[13px]" onClick={() => onNote(`Draft PR #${g.pr} opens on GitHub in the real product.`)}>
            Open draft PR
          </Button>
          <Button variant="outline" size="sm" className="h-8 border-input bg-transparent text-[13px]" onClick={() => setTab(c.id, 'code')}>
            View changes
          </Button>
        </div>
      </>
    )

  if (g.pushed)
    return form ? (
      <div className="flex flex-col gap-2.5">
        <h3 className="text-[14px] font-medium">Create pull request</h3>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Icon name="branch" size={12} /> {g.branch} → main
        </p>
        <label className="text-[12px] font-medium" htmlFor="pr-title">
          Title <span className="font-normal text-subtle-foreground">Required</span>
        </label>
        <input
          id="pr-title"
          value={title}
          aria-invalid={err && !title.trim()}
          onChange={(e) => (setTitle(e.target.value), setErr(false))}
          className={cn('h-8 rounded-md border bg-transparent px-2.5 text-[13px] outline-none focus:border-foreground/60', err && !title.trim() ? 'border-danger' : 'border-input')}
        />
        {err && !title.trim() && (
          <p className="flex items-center gap-1.5 text-[12px] text-danger" role="alert">
            <Icon name="danger" size={12} /> Add a title to create the pull request.
          </p>
        )}
        <label className="text-[12px] font-medium" htmlFor="pr-desc">
          Description <span className="font-normal text-subtle-foreground">Optional</span>
        </label>
        <Textarea id="pr-desc" value={desc} onChange={(e) => setDesc(e.target.value)} className="min-h-16 resize-none border-input bg-transparent text-[13px] leading-[18px] dark:bg-transparent" />
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="h-8 border-input bg-transparent text-[13px]" onClick={() => setForm(false)}>
            Cancel
          </Button>
          <Button
            size="sm"
            className="h-8 flex-1 text-[13px]"
            onClick={() => {
              if (!title.trim()) return setErr(true)
              createPr(c.id)
              onNote('Draft PR #12 is open|Created on ' + g.repo + ' with the summary, changes and decisions.')
            }}
          >
            Create PR
          </Button>
        </div>
      </div>
    ) : (
      <div className="flex flex-col gap-2.5">
        <h3 className="text-[14px] font-medium">Pushed</h3>
        <p className="flex items-center gap-2 text-[13px]">
          <Icon name="checkCircle" size={14} bold className="text-success" /> Code pushed to {g.repo}
        </p>
        <p className="flex items-center justify-between text-[13px]">
          6 files changed <span className="text-[12px]"><span className="text-success">+398</span> <span className="text-danger">−24</span></span>
        </p>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Icon name="branch" size={12} /> {g.branch} → main
        </p>
        <div className="rounded-lg border border-border-subtle bg-[#18181a] px-3 py-2 text-[13px]">
          {msg}
          <p className="text-[12px] text-subtle-foreground">Commit {g.commit} · just now</p>
        </div>
        <p className="text-[12px] text-muted-foreground">Create a pull request when you are ready for review.</p>
        <Button className="h-9 w-full text-[13px]" onClick={() => setForm(true)}>
          Create PR
        </Button>
      </div>
    )

  if (done && g.connected)
    return (
      <div className="flex flex-col gap-2.5">
        <h3 className="text-[14px] font-medium">Commit and push</h3>
        <p className="flex items-center justify-between text-[14px] font-medium">
          6 files changed <span className="text-[13px]"><span className="text-success">+398</span> <span className="text-danger">−24</span></span>
        </p>
        <p className="flex items-center gap-1.5 text-[12px] text-muted-foreground">
          <Icon name="branch" size={12} /> {g.branch} → main
        </p>
        <label className="text-[13px] font-medium" htmlFor="commit-msg">
          Commit message
        </label>
        <Textarea id="commit-msg" value={msg} onChange={(e) => setMsg(e.target.value)} className="min-h-[88px] resize-none border-input bg-transparent text-[13px] leading-[18px] dark:bg-transparent" />
        <div className="flex">
          <Button className="h-9 flex-1 rounded-r-none text-[13px]" disabled={!msg.trim()} onClick={() => commitAndPush(c.id)}>
            Commit and push
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button aria-label="More commit actions" className="h-9 w-9 rounded-l-none border-l border-border bg-primary px-0">
                <Icon name="down" size={14} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onSelect={() => commitAndPush(c.id)}>Commit and push</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onNote('Commit only comes in a later module.')}>Commit</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => commitAndPush(c.id)}>Push</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    )

  return (
    <>
      <h3 className="flex items-center gap-2 text-[14px] font-medium">
        <Icon name="branch" size={16} /> Pull request
      </h3>
      <p className="mt-2 text-[12px] leading-4 text-muted-foreground">Opens when the build is verified. Connect GitHub to push it to a repository.</p>
      {done && (
        <Button size="sm" className="mt-3 h-8 text-[13px]" onClick={onConnect}>
          Connect GitHub
        </Button>
      )}
    </>
  )
}

/* ---------- tabs ---------- */

function SandboxSection({ c, onNote }: { c: Chat; onNote: (s: string) => void }) {
  if (!verified(c)) return null
  const live = useStore((s) => s.dep.launch === 'live')
  return (
    <>
    {live && (
      <section aria-label="Deployment" className="px-1">
        <h3 className="mb-2.5 text-[12px] text-muted-foreground">Deployed</h3>
        <div className="rounded-xl border border-border-subtle bg-surface p-3.5">
          <p className="flex items-center gap-2 text-[13px]">
            <span className="size-1.5 rounded-full bg-success" />
            <span className="min-w-0 flex-1 truncate">{APP_URL}</span>
            <button aria-label="Copy link" className="text-muted-foreground hover:text-foreground" onClick={() => onNote('Link copied.')}>
              <Icon name="copy" size={14} />
            </button>
          </p>
          <Button size="sm" className="mt-3 h-8 gap-1.5 text-[13px]" onClick={openApp}>
            Open app <Icon name="out" size={12} />
          </Button>
        </div>
      </section>
    )}

    <section aria-label="Sandbox" className="px-1">
      <h3 className="mb-2.5 text-[12px] text-muted-foreground">Sandbox</h3>
      <div className="rounded-xl border border-border-subtle bg-surface p-3.5">
        <p className="flex items-center gap-2 text-[13px]">
          <span className="size-1.5 rounded-full bg-success" />
          <span className="min-w-0 flex-1 truncate">webhook-monitor.sandbox.revolte.app</span>
          <button aria-label="Copy link" className="text-muted-foreground hover:text-foreground" onClick={() => onNote('Link copied.')}>
            <Icon name="copy" size={14} />
          </button>
          <button aria-label="Open sandbox" className="text-muted-foreground hover:text-foreground" onClick={() => setTab(c.id, 'sandbox')}>
            <Icon name="out" size={14} />
          </button>
        </p>
        <p className="mt-2 text-[12px] leading-4 text-muted-foreground">
          {c.github.connected ? `Connected to ${c.github.repo}. Deploy from the pull request for a permanent link.` : 'Temporary link. Copying it asks you to connect GitHub and deploy for a permanent one.'}
        </p>
      </div>
    </section>
    </>
  )
}

const ROWS = [
  ['acme-payments/hook', 'invoice.paid', '8 of 8', 'Failed'],
  ['shopline/events', 'order.created', '3 of 8', 'Retrying'],
  ['ledgerly/in', 'refund.issued', '1', 'Delivered'],
  ['northwind/hooks', 'invoice.paid', '2', 'Delivered'],
] as const

function SandboxTab({ c }: { c: Chat }) {
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setLoading(false), 1200)
    return () => clearTimeout(t)
  }, [])
  if (!verified(c) && c.sandbox !== 'failed')
    return <Empty icon="monitor" title="The sandbox opens when the build is ready" text="Revolte starts it as soon as there is something to show." />
  if (c.sandbox === 'failed')
    return (
      <Empty icon="danger" title="The sandbox did not load" text="Revolte could not reach the preview. Your work is safe." action="Try again" onAction={() => retrySandbox(c.id)} />
    )
  return (
    <div className="@container m-4 mt-3 flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-border-subtle bg-background">
      <div className="flex items-center gap-3 border-b border-border-subtle bg-surface px-3 py-2">
        <span className="flex gap-1.5" aria-hidden="true">
          <i className="size-2.5 rounded-full bg-[#ff5f57]" />
          <i className="size-2.5 rounded-full bg-[#febc2e]" />
          <i className="size-2.5 rounded-full bg-[#28c840]" />
        </span>
        <span className="flex gap-2.5 text-muted-foreground">
          <Icon name="left" size={14} />
          <Icon name="right" size={14} />
          <Icon name="refresh" size={14} />
        </span>
        <span className="flex h-7 min-w-0 flex-1 items-center gap-2 rounded-md bg-muted px-2.5 text-[12px] text-muted-foreground">
          <Icon name="lock" size={12} />
          <span className="truncate">https://webhook-monitor.sandbox.revolte.app/deliveries</span>
        </span>
        <span className="flex gap-2.5 text-muted-foreground">
          <Icon name="copy" size={14} />
          <Icon name="out" size={14} />
          <Icon name="phone" size={14} />
        </span>
      </div>
      {loading ? (
        <div className="grid flex-1 place-items-center text-[13px] text-muted-foreground">
          <span className="flex items-center gap-2">
            <Spin size={16} /> Opening the sandbox…
          </span>
        </div>
      ) : (
        <iframe title="Webhook monitor sandbox preview" style={{ animation: 'rvfade 500ms ease-out' }} srcDoc={SANDBOX_APP} sandbox="allow-scripts" className="min-h-0 w-full flex-1 border-0 bg-[#0f0f10]" />
      )}
    </div>
  )
}

const FILES = [
  ['retry.ts', 142, 18], ['backoff.ts', 38, 0], ['queue.ts', 24, 6], ['deliveries/page.tsx', 90, 40], ['[id]/page.tsx', 61, 0], ['DeliveryTable.tsx', 86, 12], ['RetryButton.tsx', 34, 0],
  ['alerts.ts', 54, 0], ['notify.ts', 29, 3], ['schema.ts', 18, 2], ['seed.ts', 45, 0], ['retry.spec.ts', 28, 57], ['alerts.spec.ts', 31, 0],
] as const
const DIFF: [string, string, string, string][] = [
  ['hunk', '', '', '@@ -12,6 +12,14 @@ export async function retry(job: Job) {'],
  ['del', '13', '', '  const delay = 1000;'],
  ['add', '', '13', '  const delay = backoff(job.attempt, {'],
  ['add', '', '14', '    base: 1000, max: 6 * HOUR });'],
  ['add', '', '15', '  if (job.attempt >= MAX_ATTEMPTS) {'],
  ['add', '', '16', '    await alertOnCall(job);'],
  ['add', '', '17', '    return markFailed(job);'],
  ['add', '', '18', '  }'],
  ['ctx', '14', '19', '  await queue.add(job, { delay });'],
  ['ctx', '15', '20', '}'],
  ['hunk', '', '', '@@ -48,4 +56,12 @@ export async function scheduleRetry(job: J…'],
  ['del', '57', '', '  queue.add(job);'],
  ['add', '', '57', '  const next = backoff(job.attempt, {'],
  ['add', '', '58', '    base: 1000, max: 6 * HOUR });'],
  ['add', '', '59', '  log.info("retry scheduled", { id: job.id, in: next });'],
  ['add', '', '60', '  return queue.add(job, { delay: next });'],
]

function CodeTab({ c, onConnect }: { c: Chat; onConnect: () => void }) {
  const [msg, setMsg] = useState('Add delivery filters and retry with backoff')
  const [file, setFile] = useState('retry.ts')
  const [touched, setTouched] = useState(false)
  if (!verified(c)) return <Empty icon="code" title="No code changes yet" text="Edited files show up here as Revolte builds." />
  return (
    <div className="@container flex min-h-0 flex-1 flex-col px-4 pt-3 pb-4">
      <div className="flex items-baseline justify-between">
        <h2 className="text-[14px] font-medium">13 files changed</h2>
        <span className="text-[13px]">
          <span className="text-success">+680</span> <span className="text-danger">−140</span>
        </span>
      </div>
      <p className="mt-2 mb-3 flex items-center gap-1.5 text-[12px] text-muted-foreground">
        <Icon name="branch" size={12} /> revolte/webhook-dashboard → main
      </p>
      <div className="flex min-h-0 flex-1 gap-2.5 @max-[560px]:flex-col">
        <div className="flex min-w-0 flex-[2] flex-col overflow-hidden rounded-lg border border-border-subtle bg-background">
          <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 text-[12px]">
            <Icon name="doc" size={14} className="text-muted-foreground" /> src/jobs/{file}
            <span className="ml-auto text-success">+142</span>
            <span className="text-danger">−18</span>
          </div>
          <div className="min-h-0 flex-1 overflow-auto font-mono text-[12px] leading-[22px]">
            {DIFF.map(([k, a, b, t], i) => (
              <div key={i} className={cn('flex whitespace-pre', k === 'add' && 'bg-[#10301d]', k === 'del' && 'bg-[#331614]', k === 'hunk' && 'bg-[#13171f] text-[#6f8fff]')}>
                <span className="w-9 shrink-0 pr-2 text-right text-subtle-foreground select-none">{a}</span>
                <span className="w-9 shrink-0 pr-2 text-right text-subtle-foreground select-none">{b}</span>
                <span className={cn('w-4 shrink-0 select-none', k === 'add' && 'text-success', k === 'del' && 'text-danger')}>{k === 'add' ? '+' : k === 'del' ? '−' : ''}</span>
                <span>{t}</span>
              </div>
            ))}
          </div>
        </div>
        <ul className="flex min-w-[150px] flex-1 flex-col overflow-auto rounded-lg border border-border-subtle bg-background p-1 @max-[560px]:max-h-40 @max-[560px]:flex-none" aria-label="Changed files">
          {FILES.map(([n, a, d]) => (
            <li key={n}>
              <button className={cn('flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[12px] text-muted-foreground hover:bg-selected', file === n && 'bg-selected text-foreground')} onClick={() => setFile(n)}>
                <Icon name="doc" size={13} />
                <span className="min-w-0 flex-1 truncate">{n}</span>
                <span className="text-success">+{a}</span>
                <span className={d ? 'text-danger' : 'text-subtle-foreground'}>−{d}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
      <label htmlFor="cm" className="mt-3 mb-1.5 text-[13px] font-medium">
        Commit message
      </label>
      <Textarea id="cm" aria-invalid={touched && !msg.trim()} value={msg} onChange={(e) => setMsg(e.target.value)} className="min-h-[72px] resize-none border-input bg-transparent text-[13px] dark:bg-transparent" />
      {touched && !msg.trim() && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12px] text-danger" role="alert">
          <Icon name="danger" size={12} /> Add a commit message to commit.
        </p>
      )}
      {c.github.connected ? (
        <Button className="mt-3 h-9 text-[13px]" disabled={!!c.github.pushed} onClick={() => (!msg.trim() ? setTouched(true) : commitAndPush(c.id))}>
          {c.github.pushed ? 'Pushed' : 'Commit and push'}
        </Button>
      ) : (
        <div className="mt-3 flex items-center gap-3 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-[12px] text-muted-foreground">
          <Icon name="info" size={14} /> Pushing needs GitHub.
          <Button size="sm" className="ml-auto h-7 text-[12px]" onClick={onConnect}>
            Connect GitHub
          </Button>
        </div>
      )}
    </div>
  )
}

function FilesTab({ c, onNote }: { c: Chat; onNote: (s: string) => void }) {
  if (!verified(c)) return <Empty icon="folder" title="No files yet" text="Plans, recordings and source snapshots appear here when the build finishes." />
  const rows: [IconName, string, string][] = [
    ['doc', 'implementation-plan.md', 'Plan · 3 decisions · 5 tasks'],
    ['play', 'dashboard-walkthrough.mp4', 'End-to-end recording · 1m 12s'],
    ['box', 'webhook-monitor.zip', 'Source snapshot · 284 KB'],
  ]
  return (
    <ul className="m-4 mt-3 rounded-xl border border-border-subtle bg-surface p-1.5">
      {rows.map(([ic, n, d]) => (
        <li key={n} className="flex items-center gap-3 rounded-lg px-2 py-2">
          <span className="grid size-8 place-items-center rounded-lg bg-muted">
            <Icon name={ic} size={16} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] leading-[18px] font-medium">{n}</p>
            <p className="text-[12px] text-subtle-foreground">{d}</p>
          </div>
          <button aria-label={`Download ${n}`} className="text-muted-foreground hover:text-foreground" onClick={() => onNote(`${n} would download in the real product.`)}>
            <Icon name="download" size={16} />
          </button>
        </li>
      ))}
    </ul>
  )
}

function Empty({ icon, title, text, action, onAction }: { icon: IconName; title: string; text: string; action?: string; onAction?: () => void }) {
  return (
    <div className="grid flex-1 place-items-center px-8 text-center">
      <div className="flex max-w-[260px] flex-col items-center gap-2">
        <span className="grid size-10 place-items-center rounded-xl border border-border-subtle bg-surface text-muted-foreground">
          <Icon name={icon} size={18} />
        </span>
        <p className="text-[14px] font-medium">{title}</p>
        <p className="text-[13px] leading-[18px] text-muted-foreground">{text}</p>
        {action && (
          <Button variant="outline" size="sm" className="mt-1 h-8 border-input bg-transparent text-[13px]" onClick={onAction}>
            {action}
          </Button>
        )}
      </div>
    </div>
  )
}

/* ---------- pane ---------- */

export function RightPane({ c, onNote, lead }: { c: Chat; onNote: (s: string) => void; lead?: ReactNode }) {
  const [gh, setGh] = useState(false)
  const [deploy, setDeploy] = useState(false)
  const ready = verified(c)
  const tab = c.tab
  const connect = () => {
    setDeploy(false)
    setState({ ghFor: 'deploy' })
  }
  return (
    <aside className="flex min-h-0 min-w-0 flex-1 flex-col" aria-label="Session">
      <div className="flex h-[62px] shrink-0 items-center justify-between gap-3 px-4">
        {lead}
        <div role="tablist" aria-label="Session views" className="flex items-center gap-0.5 rounded-[10px] border border-border-subtle bg-surface p-[3px]">
          {TABS.map((t) => {
            const on = tab === t.id
            const btn = (
              <button key={t.id} role="tab" aria-selected={on} aria-label={t.label} className={cn('flex h-7 items-center gap-1.5 rounded-md px-2 text-[13px] text-muted-foreground hover:text-foreground', on && 'bg-selected text-foreground')} onClick={() => setTab(c.id, t.id)}>
                <Icon name={t.icon} size={16} bold={on} />
                {on && <span>{t.label}</span>}
              </button>
            )
            return on ? btn : (
              <Tooltip key={t.id}>
                <TooltipTrigger asChild>{btn}</TooltipTrigger>
                <TooltipContent side="bottom">{t.label}</TooltipContent>
              </Tooltip>
            )
          })}
        </div>
        <Popover open={deploy} onOpenChange={setDeploy}>
          <Tooltip>
            <PopoverAnchor asChild>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="icon"
                    aria-label="Deploy"
                    aria-disabled={!ready}
                    className={cn('relative size-8 border-input bg-transparent text-muted-foreground', !ready && 'opacity-50', ready && !c.wf && 'text-foreground motion-safe:animate-[nudge_2.4s_ease-out_0.6s_3]')}
                    onClick={() => ready && (c.github.connected ? openWizard() : setDeploy(true))}
                  >
                    <Icon name="rocket" size={16} />
                  </Button>
                </span>
              </TooltipTrigger>
            </PopoverAnchor>
            <TooltipContent side="bottom">{ready ? 'Deploy' : 'Deploy opens after the build is verified'}</TooltipContent>
          </Tooltip>
          <PopoverContent align="end" className="w-[256px] border-border-subtle bg-card p-3.5">
            <h4 className="text-[13px] font-medium">Connect GitHub to deploy</h4>
            <p className="mt-1.5 text-[12px] leading-4 text-muted-foreground">Revolte pushes this build to a repository first, then deploys from it. You pick the repositories Revolte can use.</p>
            <div className="mt-3 flex items-center gap-3">
              <Button size="sm" className="h-7 gap-1.5 text-[12px]" onClick={connect}>
                <GithubMark size={12} /> Connect GitHub
              </Button>
              <button className="text-[12px] text-foreground" onClick={() => setDeploy(false)}>
                Not now
              </button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {tab === 'overview' && (
        <div className="flex min-h-0 flex-1 flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
          <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
            <Summary c={c} />
            <Progress c={c} />
            <SandboxSection c={c} onNote={onNote} />
          </div>
          <div className="shrink-0 px-5 pt-2 pb-4">
            <PullRequest c={c} onConnect={() => setGh(true)} onNote={onNote} />
          </div>
        </div>
      )}
      {tab === 'sandbox' && <SandboxTab c={c} />}
      {tab === 'code' && <CodeTab c={c} onConnect={() => setGh(true)} />}
      {tab === 'files' && <FilesTab c={c} onNote={onNote} />}
      {tab === 'workflow' && <WorkflowPane c={c} onNote={onNote} />}

      <GithubDialog id={c.id} open={gh} onOpenChange={setGh} onDone={onNote} />
    </aside>
  )
}

