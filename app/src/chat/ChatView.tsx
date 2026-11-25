import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { RadioGroup } from '@/components/ui/radio-group'
import { cn } from '@/lib/utils'
import { useStore } from '@/store'
import { APP_URL } from '@/deploy/model'
import { Composer } from './ChatComposer'
import { openApp } from './openApp'
import { DeployChat } from '@/deploy/ChatCards'
import { WorkflowChat } from '@/workflow/Run'
import { fillWorkflow, openPicker } from '@/workflow/state'
import { Spin, fmtSecs, useNow } from './bits'
import { dismissWorkflow, answer, clearQueued, continueAfterFailure, allowEdit, approvePlan, denyEdit, queueMessage, setBgOpen, reconnect, requestChanges, resume, retrySandbox, sendFollowUp, sendQueuedNow, setQuestion, skipQuestions, stopRun, upgradeAndResume } from './engine'
import { PLAN_STEPS, QUESTIONS, type Chat, type LogItem, type Review } from './types'

const LOG_ICON: Record<LogItem['icon'], IconName> = { search: 'search', terminal: 'codeFile', edit: 'pen', test: 'checklist', lint: 'codeFile', think: 'stars', sparkle: 'stars', error: 'danger' }
const MUTED = 'text-muted-foreground'

/* ---------- small pieces ---------- */

function Row({ icon, children, className }: { icon: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={cn('flex items-center gap-2.5 text-[13px] leading-[18px]', className)}>
      <span className="grid w-4 place-items-center">{icon}</span>
      {children}
    </div>
  )
}

function PlanGlyph() {
  return (
    <span className="relative grid size-9 shrink-0 place-items-center" aria-hidden="true">
      <svg width="36" height="32" viewBox="0 0 36 32" fill="none">
        <path d="M2 8a3 3 0 0 1 3-3h8l3 3h15a3 3 0 0 1 3 3v15a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V8Z" fill="#e7a23a" />
        <rect x="8" y="2" width="20" height="14" rx="2" fill="#f4efe6" />
        <path d="M11 6h14M11 9h14M11 12h9" stroke="#b9b3a8" strokeWidth="1.2" strokeLinecap="round" />
        <path d="M2 14h32v12a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V14Z" fill="#f0b24a" />
        <text x="18" y="25" textAnchor="middle" fontSize="6" fontWeight="700" fill="#8a5a12">PLAN</text>
      </svg>
    </span>
  )
}

function UserBubble({ text }: { text: string }) {
  return <div className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 max-w-[366px] self-end rounded-2xl bg-muted px-4 py-3 text-[14px] leading-[22px] whitespace-pre-wrap [overflow-wrap:anywhere]">{text}</div>
}

function Agent({ text }: { text: string }) {
  return <p className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-500 text-[14px] leading-[22px]">{text}</p>
}

function Worked({ secs, steps, earlier }: { secs: number; steps: number; earlier?: boolean }) {
  return (
    <Collapsible>
      <CollapsibleTrigger className="group flex items-center gap-2.5 text-[13px] text-muted-foreground hover:text-foreground">
        <Icon name="checkCircle" size={16} bold className="motion-safe:animate-[pop_500ms_ease-out] text-success" />
        Worked for {fmtSecs(secs)} · {steps} steps
        <Icon name="down" size={12} className="transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <ul className="mt-2 ml-2 flex flex-col gap-1.5 border-l border-border-subtle pl-3 text-[13px] text-muted-foreground">
          {earlier && <li className="text-[12px] text-subtle-foreground">{steps - 3} earlier steps</li>}
          <li className="flex justify-between"><span><Icon name="pen" size={14} className="mr-2 inline" />Edited src/jobs/retry.ts</span><span className="text-success">+86 −4</span></li>
          <li><Icon name="checklist" size={14} className="mr-2 inline" />Ran 24 tests <span className="float-right text-subtle-foreground">24 passed</span></li>
          <li><Icon name="codeFile" size={14} className="mr-2 inline" />Ran lint and Prettier <span className="float-right text-subtle-foreground">2s</span></li>
        </ul>
      </CollapsibleContent>
    </Collapsible>
  )
}

function Answered({ c }: { c: Chat }) {
  return (
    <Collapsible className="rounded-xl border border-border-subtle">
      <CollapsibleTrigger className="group flex w-full items-center gap-2.5 px-3.5 py-2.5 text-[13px]">
        <Icon name="checkCircle" size={16} className={MUTED} />
        <span className="shrink-0 font-medium whitespace-nowrap">Answered {QUESTIONS.length} questions</span>
        <span className="ml-auto truncate pl-6 text-[12px] text-subtle-foreground group-data-[state=open]:hidden">{c.answers.join(' · ')}</span>
        <Icon name="down" size={12} className="text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent>
        <dl className="flex flex-col gap-3 border-t border-border-subtle px-3.5 py-3 text-[13px]">
          {QUESTIONS.map((q, i) => (
            <div key={q.q}>
              <dt className="text-[12px] text-muted-foreground">{q.q}</dt>
              <dd className="mt-0.5">{c.answers[i]}</dd>
            </div>
          ))}
        </dl>
      </CollapsibleContent>
    </Collapsible>
  )
}

/* ---------- Grill: questions ---------- */

function QuestionCard({ c }: { c: Chat }) {
  const q = QUESTIONS[c.qi]
  const [pick, setPick] = useState<string>(c.answers[c.qi] ?? q.options[0])
  const [own, setOwn] = useState('')
  const [custom, setCustom] = useState(false)
  useEffect(() => {
    const a = c.answers[c.qi]
    setPick(a ?? q.options[0])
    setCustom(!!a && !q.options.includes(a as never))
    setOwn(a && !q.options.includes(a as never) ? a : '')
  }, [c.qi]) // eslint-disable-line react-hooks/exhaustive-deps
  const last = c.qi === QUESTIONS.length - 1
  const value = custom ? own.trim() : pick
  const opt = 'flex h-[42px] w-full items-center gap-3 rounded-lg border border-input px-3 text-left text-[14px] hover:bg-selected'
  const dot = (on: boolean) => (
    <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border border-muted-foreground/60', on && 'border-foreground')}>{on && <span className="size-2 rounded-full bg-foreground" />}</span>
  )
  return (
    <section className="rounded-2xl border border-border-subtle bg-surface p-4" aria-label="Questions before planning">
      <div className="flex items-center justify-between text-[12px] text-muted-foreground">
        <span>A few questions before I plan</span>
        <span className="flex items-center gap-3">
          <button aria-label="Previous question" disabled={c.qi === 0} className="disabled:opacity-40" onClick={() => setQuestion(c.id, c.qi - 1)}>
            <Icon name="left" size={14} />
          </button>
          {c.qi + 1} of {QUESTIONS.length}
          <button aria-label="Next question" disabled={c.qi >= c.answers.length} className="disabled:opacity-40" onClick={() => setQuestion(c.id, c.qi + 1)}>
            <Icon name="right" size={14} />
          </button>
        </span>
      </div>
      <h3 className="mt-3 mb-3 text-[16px] leading-6 font-medium">{q.q}</h3>
      <RadioGroup
        value={custom ? '__own' : pick}
        onValueChange={(v) => {
          if (v === '__own') setCustom(true)
          else {
            setCustom(false)
            setPick(v)
          }
        }}
        className="gap-2"
      >
        {q.options.map((o, i) => (
          <button key={o} type="button" role="radio" aria-checked={!custom && pick === o} className={cn(opt, !custom && pick === o && 'bg-[#2a2a2d]')} onClick={() => (setCustom(false), setPick(o))}>
            {dot(!custom && pick === o)}
            <span>{o}</span>
            {i === 0 && (
              <span className="ml-auto flex items-center gap-1.5 text-[12px] text-foreground">
                <Icon name="star" size={13} bold /> Recommended
              </span>
            )}
          </button>
        ))}
        <label className={cn(opt, 'cursor-text text-muted-foreground', custom && 'bg-[#2a2a2d] text-foreground')} onClick={() => setCustom(true)}>
          {dot(custom)}
          <Icon name="pen" size={14} />
          <input
            aria-label="Type your own answer"
            value={own}
            onFocus={() => setCustom(true)}
            onChange={(e) => (setCustom(true), setOwn(e.target.value))}
            placeholder="Something else. Type your own answer"
            className="min-w-0 flex-1 bg-transparent text-[14px] text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>
      </RadioGroup>
      <div className="mt-4 flex items-center gap-3 text-[12px] text-subtle-foreground">
        <span className="flex gap-1" aria-hidden="true">
          {QUESTIONS.map((_, i) => (
            <i key={i} className={cn('h-[3px] w-3.5 rounded-full bg-muted', i <= c.qi && 'bg-foreground')} />
          ))}
        </span>
        Recommended answers are pre-selected
        <span className="grow" />
        <Button variant="ghost" size="sm" className="h-7 px-2 text-[13px] text-foreground" onClick={() => skipQuestions(c.id)}>
          Skip
        </Button>
        <Button size="sm" className="h-7 rounded-md bg-primary px-2.5 text-[13px] text-primary-foreground" disabled={!value} onClick={() => answer(c.id, value)}>
          {last ? 'Make the plan' : 'Next'}
        </Button>
      </div>
    </section>
  )
}

/* ---------- Plan ---------- */

function PlanDialog({ c, open, onOpenChange }: { c: Chat; open: boolean; onOpenChange: (o: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[560px] border-border-subtle bg-card">
        <DialogHeader>
          <DialogTitle>Plan.md</DialogTitle>
          <DialogDescription>{c.title}</DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto text-[14px] leading-[22px]">
          <section>
            <h4 className="mb-1 text-[12px] font-semibold tracking-wide text-subtle-foreground uppercase">Decisions</h4>
            {QUESTIONS.map((q, i) => (
              <p key={q.q} className="text-muted-foreground">
                {q.q} <span className="text-foreground">{c.answers[i] ?? q.options[0]}</span>
              </p>
            ))}
            {c.feedback.map((f) => (
              <p key={f} className="text-muted-foreground">
                Your change: <span className="text-foreground">{f}</span>
              </p>
            ))}
          </section>
          <section>
            <h4 className="mb-1 text-[12px] font-semibold tracking-wide text-subtle-foreground uppercase">Tasks</h4>
            <ol className="list-decimal pl-5">
              {PLAN_STEPS.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ol>
          </section>
          <section>
            <h4 className="mb-1 text-[12px] font-semibold tracking-wide text-subtle-foreground uppercase">Checks</h4>
            <p className="text-muted-foreground">Vitest, Playwright, lint and Prettier must pass before the build counts as verified.</p>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** H01-H04: how should Revolte proceed with this plan. A first build stays in chat so you see it live. */
function PlanChoice({ c }: { c: Chat }) {
  const veteran = useStore((s) => s.chats.some((x) => x.id !== c.id && x.phase === 'done'))
  const [pick, setPick] = useState<'workflow' | 'chat' | 'reject'>(veteran ? 'workflow' : 'chat')
  const opts: { id: 'workflow' | 'chat' | 'reject'; label: string; hint: string; rec?: boolean }[] = [
    { id: 'chat', label: 'Approve and build in chat', hint: 'Watch it build, then try it live in the sandbox.', rec: !veteran },
    { id: 'workflow', label: 'Approve and run as a workflow', hint: 'Runs on its own and opens a draft PR for review.', rec: veteran },
    { id: 'reject', label: 'Reject plan', hint: 'Tell Revolte what to change.' },
  ]
  const ordered = veteran ? [opts[1], opts[0], opts[2]] : opts
  const box = useRef<HTMLElement>(null)
  useEffect(() => {
    const t = setTimeout(() => box.current?.scrollIntoView({ block: 'end', behavior: 'smooth' }), 120)
    return () => clearTimeout(t)
  }, [])
  const go = () => {
    if (pick === 'chat') approvePlan(c.id)
    else if (pick === 'workflow') openPicker()
    else document.querySelector<HTMLTextAreaElement>('textarea[aria-label="Message Revolte"]')?.focus()
  }
  return (
    <section ref={box} className="scroll-mb-4 rounded-2xl border border-border-subtle bg-surface p-4 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300" aria-label="Approve the plan">
      <p className="text-[13px] text-muted-foreground">Plan ready · {PLAN_STEPS.length} steps</p>
      <h3 className="mt-1 text-[16px] font-medium">How should Revolte proceed with this plan?</h3>
      <div className="mt-3 flex flex-col gap-2" role="radiogroup" aria-label="How to proceed">
        {ordered.map((o) => {
          const on = pick === o.id
          return (
            <button key={o.id} role="radio" aria-checked={on} onClick={() => setPick(o.id)} onDoubleClick={() => (setPick(o.id), setTimeout(go))} className={cn('flex items-center gap-3 rounded-lg border px-3.5 py-2.5 text-left', on ? 'border-input bg-selected' : 'border-border-subtle hover:bg-background/40')}>
              <span className={cn('grid size-4 shrink-0 place-items-center rounded-full border', on ? 'border-foreground' : 'border-input')}>{on && <span className="size-2 rounded-full bg-foreground motion-safe:animate-[pop_250ms_ease-out]" />}</span>
              <span className="min-w-0 flex-1"><span className="block text-[14px]">{o.label}</span>{on && <span className="block text-[12px] text-muted-foreground motion-safe:animate-in motion-safe:fade-in-0">{o.hint}</span>}</span>
              {o.rec && <span className="flex items-center gap-1 text-[12px]"><Icon name="star" size={12} bold /> Recommended</span>}
            </button>
          )
        })}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <p className="mr-auto text-[12px] text-muted-foreground">{pick === 'workflow' ? 'Workflows run on their own and open a draft PR for review.' : pick === 'chat' ? 'You can turn this into a workflow after it is built.' : 'Your feedback goes in the message box below.'}</p>
        <Button size="sm" className="h-8 text-[13px]" onClick={go}>{pick === 'workflow' ? 'Choose a workflow' : pick === 'chat' ? 'Approve and build' : 'Write feedback'}</Button>
      </div>
    </section>
  )
}

function PlanCard({ c, approved }: { c: Chat; approved: boolean }) {
  const [view, setView] = useState(false)
  if (approved)
    return (
      <>
        <section className="flex items-center gap-3 rounded-xl border border-border-subtle bg-surface px-4 py-3" aria-label="Plan approved">
          <PlanGlyph />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] leading-5 font-medium">Plan.md approved</p>
            <p className="text-[13px] text-muted-foreground">Review the steps, decisions and checks Revolte follows.</p>
          </div>
          <Button variant="outline" size="sm" className="h-8 border-input bg-transparent text-[13px]" onClick={() => setView(true)}>
            View plan
          </Button>
        </section>
        <PlanDialog c={c} open={view} onOpenChange={setView} />
      </>
    )
  return (
    <>
      <section className="rounded-2xl border border-border-subtle bg-surface p-4" aria-label="Plan">
        <div className="flex items-center gap-3">
          <PlanGlyph />
          <h3 className="text-[14px] font-medium">
            Plan · {PLAN_STEPS.length} steps{c.planRev > 0 && <span className="ml-2 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">Revised</span>}
          </h3>
        </div>
        <ol className="mt-3 flex flex-col gap-2 text-[14px] leading-[22px]">
          {PLAN_STEPS.map((s, i) => (
            <li key={s} className="flex gap-2">
              <span className="w-4 text-right text-muted-foreground">{i + 1}.</span>
              <span>
                {s}
                {c.planRev > 0 && i === 1 && c.feedback.length > 0 && <span className="text-muted-foreground"> · {c.feedback[c.feedback.length - 1]}</span>}
              </span>
            </li>
          ))}
        </ol>
        <div className="mt-4 flex justify-end">
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-[13px]" onClick={() => setView(true)}>
            <Icon name="doc" size={14} /> View plan
          </Button>
        </div>
      </section>
      <PlanChoice c={c} />
      <PlanDialog c={c} open={view} onOpenChange={setView} />
    </>
  )
}

/* ---------- live segment ---------- */

function LogDetail({ it }: { it: LogItem }) {
  if (it.detail === 'test')
    return (
      <div className="mt-2 rounded-lg border border-border-subtle bg-surface text-[12px]">
        <div className="flex items-center justify-between border-b border-border-subtle px-3 py-1.5 text-muted-foreground">
          npm test · retry.scheduler.test.ts <Icon name="copy" size={13} />
        </div>
        <pre className="m-0 px-3 py-2.5 font-mono leading-[18px] whitespace-pre-wrap">{`FAIL  first retry waits 1 second\nExpected delay: 1000\nReceived delay: 2000\nat src/jobs/retry.ts:42\n23 passed, 1 failed`}</pre>
        <div className="border-t border-border-subtle px-3 py-1.5 text-subtle-foreground">Attempt 2 of 3 · 12s</div>
      </div>
    )
  if (it.detail === 'think')
    return (
      <div className="mt-2 rounded-lg border border-border-subtle bg-surface px-3 py-2.5 text-[12px] leading-[18px] text-muted-foreground">
        The plan says 8 attempts over 6 hours, so the backoff starts at 2 seconds and doubles. The test was written for a 1 second start. The code matches the plan. I will update the test to expect 2 seconds and run the suite again.
      </div>
    )
  return (
    <pre className="mt-2 rounded-lg border border-border-subtle bg-surface px-3 py-2 font-mono text-[12px] leading-[18px] whitespace-pre-wrap">
      <span className="text-danger">- const delay = 1000</span>
      {'\n'}
      <span className="text-success">+ const delay = backoff(job.attempt, {'{'} base: 1000, max: 6 * HOUR {'}'})</span>
    </pre>
  )
}

function LogLine({ it }: { it: LogItem }) {
  const [open, setOpen] = useState(it.state === 'failed')
  const failed = it.state === 'failed'
  const Wrapper = it.detail ? 'button' : 'div'
  return (
    <li className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1 motion-safe:duration-300">
      <Wrapper className={cn('flex w-full items-center gap-2.5 text-left text-[13px] leading-[18px]', it.state === 'running' ? 'text-foreground' : MUTED, failed && 'text-danger')} {...(it.detail ? { onClick: () => setOpen((v) => !v), 'aria-expanded': open } : {})}>
        <span className="grid w-4 place-items-center">{it.state === 'running' ? <Spin size={14} /> : <Icon name={LOG_ICON[it.icon]} size={16} className={failed ? 'text-danger' : undefined} />}</span>
        <span className={cn('min-w-0 flex-1 truncate', it.state === 'running' && 'shimmer')}>{it.text}</span>
        {it.diff && (
          <span className="shrink-0 text-[12px]">
            <span className="text-success">+{it.diff[0]}</span> <span className="text-success">−{it.diff[1]}</span>
          </span>
        )}
        {it.meta && <span className="shrink-0 text-[12px] text-subtle-foreground">{it.meta}</span>}
        {it.detail && open && <Icon name="up" size={12} className="text-subtle-foreground" />}
      </Wrapper>
      {it.detail && open && it.detail !== 'edit' && <LogDetail it={it} />}
      {it.detail === 'edit' && it.state === 'done' && open && <LogDetail it={it} />}
    </li>
  )
}

const SEG_LABEL = (c: Chat) =>
  c.phase === 'thinking' ? 'Thinking' : c.phase === 'planning' ? 'Planning' : c.phase === 'revising' ? 'Revising the plan' : c.phase === 'verifying' && c.verify.attempt === 1 ? 'Verifying' : 'Developing'

function Segment({ c }: { c: Chat }) {
  const now = useNow(true)
  const secs = Math.max(0, Math.round((now - c.segStart) / 1000))
  return (
    <section aria-label="Progress" aria-live="polite">
      <div className="flex items-center gap-2.5 text-[13px] font-medium">
        <Spin size={16} /> <span className="shimmer shimmer-strong">{SEG_LABEL(c)}</span> · {fmtSecs(secs)}
      </div>
      {c.log.length > 0 && (
        <ul className="mt-2 ml-2 flex flex-col gap-2.5 border-l border-border-subtle pl-3">
          {c.log.map((l) => (
            <LogLine key={l.id} it={l} />
          ))}
        </ul>
      )}
    </section>
  )
}

/* ---------- EC01-EC04 Manual mode: allow or deny each edit ---------- */

const HUNK = [
  ['ctx', '14', '  const delays = [1, 5, 15, 30];'],
  ['del', '15', '-   return delays[attempt];'],
  ['add', '15', '+   const base = delays[Math.min(attempt, delays.length - 1)];'],
  ['add', '16', '+   return base * 60 * 1000 + jitter();'],
] as const

function ReviewCard({ c }: { c: Chat }) {
  const q = c.review ?? []
  const first = q[0] as Review
  const many = q.length > 1
  const total = Math.max(3, q.length)
  return (
    <section className="rounded-xl border border-border-subtle bg-surface p-4" aria-label="Review an edit" role="group">
      <div className="flex items-center gap-2.5 text-[14px] font-medium">
        <Icon name="shield" size={16} /> {many ? `Revolte wants to make ${q.length} changes` : 'Revolte wants to edit a file'}
        {many && <span className="ml-auto rounded-md bg-selected px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">{total - q.length + 1} of {total}</span>}
      </div>
      <p className="mt-2 text-[13px] text-muted-foreground">Manual mode is on, so Revolte waits for you before it changes code.</p>
      <div className="mt-3 overflow-hidden rounded-lg border border-border-subtle bg-background font-mono text-[12px] leading-5">
        <div className="flex items-center gap-2 border-b border-border-subtle px-3 py-2 font-sans text-[12px]">
          <Icon name="pen" size={13} className="text-muted-foreground" /> <span className="text-muted-foreground">{first.kind}</span> <span className="font-medium">{first.file}</span>
          <span className="ml-auto text-success">+{first.add}</span> <span className="text-danger">-{first.del}</span>
        </div>
        {HUNK.map(([k, n, t]) => (
          <div key={n + t} className={cn('flex gap-4 px-3 whitespace-pre', k === 'add' && 'bg-[#12301d] text-[#b6e8c6]', k === 'del' && 'bg-[#3a1717] text-[#f0b7b7]', k === 'ctx' && 'text-muted-foreground')}>
            <span className="w-4 text-right text-subtle-foreground select-none">{n}</span>
            <span>{t}</span>
          </div>
        ))}
      </div>
      {many && (
        <div className="mt-3">
          <span className="text-[10px] font-semibold tracking-[0.7px] text-subtle-foreground uppercase">Waiting</span>
          <ul className="mt-1.5 flex flex-col gap-1.5 text-[13px]">
            {q.slice(1).map((r) => (
              <li key={r.file} className="flex items-center gap-2.5">
                <Icon name={r.kind === 'Create' ? 'newChat' : 'pen'} size={14} className="text-muted-foreground" /> {r.kind} {r.file}
                <span className="ml-auto text-success">+{r.add}</span>
                {r.del > 0 && <span className="text-danger">-{r.del}</span>}
              </li>
            ))}
          </ul>
        </div>
      )}
      <div className="mt-3 flex justify-end gap-2">
        <Button variant="ghost" size="sm" className="h-8 text-[13px]" onClick={() => denyEdit(c.id)}>
          Deny
        </Button>
        <Button size="sm" className="h-8 rounded-lg px-4 text-[13px]" onClick={() => allowEdit(c.id)}>
          Allow
        </Button>
      </div>
    </section>
  )
}

/* ---------- end states ---------- */

function Stopped({ c }: { c: Chat }) {
  const where = c.tasks.filter((t) => t === 'done').length
  return (
    <>
      <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Icon name="stop" size={14} bold /> Stopped by you · {fmtSecs(c.segSecs)} <Icon name="down" size={12} />
      </div>
      <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Icon name="stop" size={14} className="text-subtle-foreground" />
        <span className="flex-1">Revolte stopped after {where > 1 ? 'the deliveries dashboard UI' : 'starting'}. Finished work stays in the sandbox.</span>
        <button className="text-foreground underline underline-offset-2" onClick={() => resume(c.id)}>
          Resume
        </button>
      </div>
    </>
  )
}

function Problem({ c, title, text, action, onAction, tone = 'danger' }: { c: Chat; title: string; text: string; action: string; onAction: () => void; tone?: 'danger' | 'warning' }) {
  void c
  return (
    <>
      <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Icon name={tone === 'warning' ? 'pause' : 'danger'} size={16} bold={tone === 'warning'} className={tone === 'danger' ? 'text-danger' : 'text-foreground'} />
        {title} <Icon name="down" size={12} />
      </div>
      <div className={cn('flex items-center gap-2.5 text-[13px]', tone === 'warning' ? 'rounded-xl bg-[#3a2a16] px-3.5 py-3 text-[#f1e3c8]' : 'text-muted-foreground')} role="alert">
        <Icon name={tone === 'warning' ? 'warn' : 'danger'} size={16} className={tone === 'warning' ? 'text-warning' : 'text-danger'} />
        <span className="flex-1">{text}</span>
        <button className="text-foreground underline underline-offset-2" onClick={onAction}>
          {action}
        </button>
      </div>
    </>
  )
}

function FailedChoice({ c }: { c: Chat }) {
  const [show, setShow] = useState(false)
  return (
    <>
      <div className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
        <Icon name="danger" size={16} className="text-danger" /> Stopped after 3 attempts · {fmtSecs(c.segSecs)} <Icon name="down" size={12} />
      </div>
      <p className="flex items-start gap-2.5 text-[13px] leading-[18px] text-muted-foreground" role="alert">
        <Icon name="danger" size={14} className="mt-0.5 text-danger" />
        retry.scheduler.test.ts still fails. The first retry waits 2 seconds and the test expects 1 second. Pick one and Revolte continues.
      </p>
      <section className="rounded-xl border border-border-subtle bg-surface p-4" aria-label="How to continue">
        <h3 className="mb-3 text-[14px] font-medium">How should Revolte continue?</h3>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" className="h-7 text-[13px]" onClick={() => continueAfterFailure(c.id)}>
            Keep 2 seconds, update the test
          </Button>
          <Button variant="outline" size="sm" className="h-7 border-input bg-transparent text-[13px]" onClick={() => continueAfterFailure(c.id)}>
            Change the code to 1 second
          </Button>
          <Button variant="outline" size="sm" className="h-7 border-input bg-transparent text-[13px]" onClick={() => setShow(true)}>
            Show the failure
          </Button>
        </div>
      </section>
      <Dialog open={show} onOpenChange={setShow}>
        <DialogContent className="max-w-[520px] border-border-subtle bg-card">
          <DialogHeader>
            <DialogTitle>retry.scheduler.test.ts</DialogTitle>
            <DialogDescription>Attempt 3 of 3</DialogDescription>
          </DialogHeader>
          <pre className="rounded-lg border border-border-subtle bg-surface p-3 font-mono text-[12px] leading-[18px] whitespace-pre-wrap">{`FAIL  first retry waits 1 second\nExpected delay: 1000\nReceived delay: 2000\nat src/jobs/retry.ts:42\n23 passed, 1 failed`}</pre>
        </DialogContent>
      </Dialog>
    </>
  )
}


function WorkflowCard({ c, onShown, after }: { c: Chat; onShown: () => void; after?: boolean }) {
  // Arrives a moment after the preview card, so the preview is the first thing you see.
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setShown(true), 1600)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => {
    if (shown) requestAnimationFrame(onShown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown])
  if (!shown) return null
  const nodes: [string, string, string, string][] = [
    ['Trigger', 'Manual trigger', 'Runs when you start it', 'play'],
    ['Agent', 'Developer', 'Builds the change', 'code'],
    ['Agent', 'QA', 'Tests, lint and security scan', 'checklist'],
    ['Action', 'Create draft PR', 'Opens a draft pull request', 'branch'],
  ]
  return (
    <section className="animate-in fade-in-0 slide-in-from-bottom-3 rounded-xl border border-border-subtle bg-surface p-4 duration-700 ease-out" aria-label="Workflow suggestion">
      <div className="relative overflow-hidden rounded-lg border border-border-subtle bg-[#0c0c0d] px-4 pt-3 pb-4 [background-image:radial-gradient(#202023_1px,transparent_1px)] [background-size:12px_12px]">
        <div className="mb-3 flex items-center justify-between text-[12px] text-muted-foreground">
          Chat to pull request · 4 steps
          <button aria-label="Not now" className="hover:text-foreground" onClick={() => dismissWorkflow(c.id)}><Icon name="close" size={12} /></button>
        </div>
        <div className="flex items-stretch gap-2.5">
          {nodes.map(([k, t, d, ic], i) => (
            <div key={t} className="relative min-w-0 flex-1 rounded-md border border-border-subtle bg-[#141416] p-2">
              <p className="mb-1.5 text-[8px] text-subtle-foreground">{k}</p>
              <div className="flex items-center gap-1.5">
                <span className="grid size-5 place-items-center rounded bg-muted"><Icon name={ic as IconName} size={11} /></span>
                <span className="min-w-0">
                  <p className="truncate text-[9px] leading-3 font-medium">{t}</p>
                  <p className="truncate text-[8px] leading-3 text-subtle-foreground">{d}</p>
                </span>
              </div>
              {i < nodes.length - 1 && <span className="absolute top-1/2 -right-2.5 h-px w-2.5 bg-border" aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <h3 className="text-[14px] font-medium">Chat to pull request</h3>
        <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">Built from this chat</span>
      </div>
      <p className="mt-1 text-[13px] leading-[18px] text-muted-foreground">{after ? 'You just planned, built, tested and shipped this by hand. Next time, a workflow does it from one prompt: build, test, then a draft pull request for you to review.' : 'Runs the steps from this chat on its own: build, test, then a draft pull request for you to review.'}</p>
      <div className="mt-4 flex items-center gap-2 text-[12px] text-muted-foreground">
        <Icon name="checkCircle" size={14} bold className="text-success" /> Ready to run. Nothing to connect.
        <span className="grow" />
        <Button variant="ghost" size="sm" className="h-8 text-[13px] text-foreground" onClick={() => dismissWorkflow(c.id)}>
          Not now
        </Button>
        <Button variant="ghost" size="sm" className="h-8 text-[13px] text-foreground" onClick={openPicker}>
          Other templates
        </Button>
        <Button size="sm" className="h-8 gap-1.5 text-[13px] motion-safe:animate-[nudge_2.4s_ease-out_0.8s_2]" onClick={() => fillWorkflow(c.id, 'pr')}>
          <Icon name="star" size={13} bold className="text-info" /> Try workflow
        </Button>
      </div>
    </section>
  )
}

/* ---------- the conversation ---------- */

export function ChatView({ c, onNote, onDeploy, onWorkflow, lead }: { c: Chat; onNote: (s: string) => void; onDeploy: () => void; onWorkflow: () => void; lead?: ReactNode }) {
  const depLive = useStore((s) => s.dep.launch === 'live')
  const depStarted = useStore((s) => s.dep.chat !== 'none')
  const credits = useStore((s) => s.credits)
  const net = useStore((s) => s.net)
  // EC11a-b: a finished chat cannot take a new message while credits or sandbox hours are used up.
  const blocked = c.phase === 'done' && (net.noCredits || !!net.noHours)
  const scroller = useRef<HTMLDivElement>(null)
  const running = c.phase === 'developing' || c.phase === 'verifying'
  const live = ['thinking', 'planning', 'revising', 'developing', 'verifying'].includes(c.phase)
  const approvedOrLater = c.planApproved

  // Follow the conversation inside this pane only (never the page behind it).
  useEffect(() => {
    const el = scroller.current
    if (!el) return
    const id = requestAnimationFrame(() => el.scrollTo({ top: el.scrollHeight, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' }))
    return () => cancelAnimationFrame(id)
  }, [c.phase, c.qi, c.log.length, c.followUps.length, c.planRev, c.feedback.length, c.github.connected, c.github.pr, c.github.pushed, c.tasks.join()])

  const placeholder = c.phase === 'plan' ? 'Give feedback on the plan' : running ? 'Queue a message for Revolte' : 'Reply to Revolte'
  const onSend = (t: string) => {
    if (c.phase === 'plan') requestChanges(c.id, t)
    else if (c.phase === 'asking') answer(c.id, t.trim())
    else if (running) queueMessage(c.id, t)
    else sendFollowUp(c.id, t)
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col" aria-label="Conversation">
      <header className="flex h-[54px] shrink-0 items-center gap-3 border-b border-border-subtle px-5">
        {lead}
        <h1 className="truncate text-[14px] font-medium">{c.title}</h1>
      </header>
      <div ref={scroller} className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex min-h-full w-full max-w-[740px] flex-col justify-end gap-4 px-[30px] pt-6 pb-4" role="log">
          <UserBubble text={c.prompt} />

          {c.phase === 'asking' && c.worked && <Worked secs={c.worked.secs} steps={c.worked.steps} />}
          {c.phase === 'asking' && (
            <div key={c.qi} className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-right-3 motion-safe:duration-300">
              <QuestionCard c={c} />
            </div>
          )}

          {c.answers.length === QUESTIONS.length && <Answered c={c} />}
          {c.skipped && !approvedOrLater && c.answers.length === QUESTIONS.length && (
            <p className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
              <Icon name="info" size={14} /> You skipped the questions, so Revolte used the recommended answers. Change any of them in the plan.
            </p>
          )}

          {c.feedback.map((f, i) => (
            <div key={i} className="flex flex-col gap-3">
              <p className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
                <Icon name="pen" size={14} /> You asked for changes to the plan.
              </p>
              <UserBubble text={f} />
            </div>
          ))}

          {c.phase === 'plan' && c.worked && <Worked secs={c.worked.secs} steps={c.worked.steps} />}
          {c.phase === 'plan' && <PlanCard c={c} approved={false} />}
          {approvedOrLater && <PlanCard c={c} approved />}
          {c.phase === 'workflow' && <WorkflowChat c={c} onNote={onNote} />}

          {live && <Segment c={c} />}
          {!!c.review?.length && <ReviewCard c={c} />}

          {c.phase === 'stopped' && <Stopped c={c} />}
          {c.phase === 'failed' && <FailedChoice c={c} />}
          {c.phase === 'credits' && (
            <Problem c={c} tone="warning" title={`Paused · ${fmtSecs(c.segSecs)}`} text="You have used all AI credits for November, so the run is paused at Build." action="Upgrade plan" onAction={() => upgradeAndResume(c.id)} />
          )}
          {c.phase === 'hours' && (
            <Problem c={c} tone="warning" title={`Paused · ${fmtSecs(c.segSecs)}`} text="Sandbox hours are used up, so the run is paused at Build." action="Upgrade plan" onAction={() => upgradeAndResume(c.id)} />
          )}
          {c.phase === 'sandbox-failed' && (
            <Problem c={c} title={`Stopped · ${fmtSecs(c.segSecs)}`} text="The sandbox did not start because the region has no free capacity. Nothing was built yet." action="Try again" onAction={() => retrySandbox(c.id)} />
          )}
          {c.phase === 'lost' && (
            <Problem c={c} title={`Connection lost · ${fmtSecs(c.segSecs)}`} text="Revolte lost its connection to the sandbox. Your work is safe." action="Reconnect" onAction={() => reconnect(c.id)} />
          )}

          {c.phase === 'done' && c.worked && (
            <>
              <Worked secs={c.worked.secs} steps={c.worked.steps} earlier />
              {!depStarted && (
                <>
              <Agent text={`Your webhook dashboard is live in the sandbox. 24 tests pass, lint and Prettier are clean. ${c.tab === 'sandbox' ? 'Try it on the right: filter by status, or press Retry now on a failed delivery.' : 'Open the sandbox to try it.'} When it looks right, deploy it to get a permanent link.`} />
              <div className="-mt-1 flex gap-3.5 text-muted-foreground">
                {(['copy', 'refresh', 'share', 'dots'] as const).map((n) => (
                  <button key={n} aria-label={n} className="hover:text-foreground" onClick={() => n !== 'dots' && onNote(n === 'copy' ? 'Copied.' : 'Not available in the prototype.')}>
                    <Icon name={n} size={16} />
                  </button>
                ))}
              </div>
              <section className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-3 motion-safe:duration-500 flex flex-wrap items-center gap-3 rounded-xl border border-border-subtle bg-surface px-3.5 py-3" aria-label="Sandbox preview">
                <span className="relative grid size-9 shrink-0 place-items-center rounded-lg bg-[#17301f] text-success">
                  <span className="absolute inset-0 rounded-lg border border-success/60 motion-safe:animate-[ring_1.2s_ease-out_2]" aria-hidden="true" />
                  <Icon name="monitor" size={18} className="motion-safe:animate-[celebrate_500ms_ease-out]" />
                </span>
                <div className="min-w-0 flex-1 basis-40">
                  <p className="text-[14px] leading-5 font-medium">{depLive ? 'Deployed to cloud' : 'Sandbox preview ready'}</p>
                  <p className="truncate text-[12px] text-muted-foreground">{depLive ? `${APP_URL} · live` : 'webhook-monitor.sandbox.revolte.app · temporary'}</p>
                </div>
                {depLive ? (
                  <Button size="sm" className="h-7 gap-1.5 text-[13px]" onClick={() => openApp()}>
                    Open app <Icon name="out" size={12} />
                  </Button>
                ) : (
                  <Button size="sm" className="h-7 gap-1.5 text-[13px]" onClick={onDeploy}>
                    <Icon name="rocket" size={14} /> Deploy to cloud
                  </Button>
                )}
                {c.tab !== 'sandbox' && (
                  <Button variant="outline" size="sm" className="h-7 border-input bg-transparent text-[13px]" onClick={() => onWorkflow()}>
                    Open sandbox
                  </Button>
                )}
              </section>
                </>
              )}
              <DeployChat onNote={onNote} />
              {!c.wf && !c.workflowDismissed && (!depStarted || depLive) && <WorkflowCard c={c} after={depLive} onShown={() => scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' })} />}
              {c.wf && <WorkflowChat c={c} onNote={onNote} />}
            </>
          )}

          {c.followUps.map((f, i) => (
            <div key={i} className="flex flex-col gap-3">
              {(c.marks ?? []).filter((m) => m.index === i).map((m) => (
                <p key={m.at} className="flex items-center gap-3 text-[12px] text-subtle-foreground">
                  <span className="h-px flex-1 bg-border-subtle" />
                  <Icon name="refresh" size={12} /> Model changed to {m.model} · {m.at}
                  <span className="h-px flex-1 bg-border-subtle" />
                </p>
              ))}
              <UserBubble text={f} />
              <Agent text="Got it. I will add that to the next change and show you the plan first." />
            </div>
          ))}
        </div>
      </div>

      <Composer
        c={c}
        credits={credits}
        placeholder={placeholder}
        running={running}
        onSend={onSend}
        onStop={() => stopRun(c.id)}
        onNote={onNote}
        disabled={blocked}
        extra={
          <>
          {blocked && (
            <div className="mb-2 flex items-start gap-2.5 rounded-xl bg-[#3a2a16] px-3.5 py-3 text-[13px] leading-[18px] text-[#f1e3c8]" role="alert">
              <Icon name="warn" size={16} className="mt-0.5 shrink-0 text-warning" />
              <span>
                {net.noCredits ? 'All AI credits for November are used. Revolte will reply after credits reset on 1 December.' : 'You have used all sandbox hours in your plan for November. They reset on 1 December.'}{' '}
                <button className="underline underline-offset-2" onClick={() => upgradeAndResume(c.id)}>Upgrade plan</button>
              </span>
            </div>
          )}
          {c.modelNote && (
            <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-[12px] text-muted-foreground" role="status">
              <Icon name="refresh" size={14} /> {c.modelNote}
            </div>
          )}
          {(c.bg ?? []).some((b) => b.state === 'running') && (
            <button className="mb-2 flex items-center gap-2 rounded-full border border-border-subtle bg-surface px-3 py-1 text-[12px] text-foreground hover:bg-selected" onClick={() => setBgOpen(c.id, true)}>
              <span className="size-1.5 rounded-full bg-info" /> {(c.bg ?? []).filter((b) => b.state === 'running').length} tasks running
            </button>
          )}
          {c.queued ? (
            <div className="mb-2 flex items-center gap-2.5 rounded-xl border border-border-subtle bg-surface px-3.5 py-2 text-[12px] text-muted-foreground">
              <Icon name="clock" size={14} />
              <span className="min-w-0 flex-1 truncate">Queued: {c.queued}</span>
              <button className="text-foreground" onClick={() => sendQueuedNow(c.id)}>
                Send now
              </button>
              <button aria-label="Remove queued message" onClick={() => clearQueued(c.id)}>
                <Icon name="close" size={13} />
              </button>
            </div>
          ) : null}
          </>
        }
      />
    </section>
  )
}
