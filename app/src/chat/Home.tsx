import { useState } from 'react'
import { Icon, type IconName } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { cn } from '@/lib/utils'
import { setState, useStore } from '@/store'
import { GithubMark } from '@/ui/Icon'
import { DEFAULT_PICKERS, Toolbar, type Pickers } from './Composer'
import { BranchMenu, SizeMenu, StartFromMenu, type StartFrom } from './menus'

const CHIPS: [IconName, string, string][] = [
  ['lock', 'Build an auth feature', 'Build an auth feature with email and OAuth sign in, sessions, and password reset.'],
  ['bug', 'Fix an API 500 error', 'Find and fix the cause of the intermittent 500 on POST /api/orders.'],
  ['refresh', 'Migrate a .NET service', 'Migrate our .NET Framework 4.8 billing service to .NET 8 and prove nothing broke.'],
  ['database', 'Speed up slow queries', 'Find the slowest queries in production and speed them up without changing behavior.'],
]
const WORKFLOWS: [IconName, string, string, string, string[]][] = [
  ['code', 'On-demand development', 'Turns a ticket or prompt into tested code and a draft pull request.', '11 steps · 7 agents', ['jira', 'gh']],
  ['pen', 'QA and validation', 'Checks finished work, runs QA and flags issues before release.', '11 steps · 7 agents', ['gh']],
  ['refresh', 'Legacy migration', 'Upgrades a legacy service, moves the code and proves nothing broke.', '14 steps · 6 agents', ['gh', 'docker', 'aws']],
]
export function Home({ initial, saved, onStart, onNote }: { initial: string; saved: boolean; onStart: (t: string, p: { mode: string; model: string }) => void; onNote: (s: string) => void }) {
  const credits = useStore((s) => s.credits)
  const [text, setText] = useState(initial)
  const [pickers, setPickers] = useState<Pickers>(DEFAULT_PICKERS)
  const [start, setStart] = useState<StartFrom>(null)
  const [branch, setBranch] = useState('main')
  const [size, setSize] = useState('Standard')
  // A first-time person has no applications yet (N07); the project list (N05-N06) appears once they do.
  const hasApps = useStore((s) => s.chats.some((c) => !!c.app))
  const noHours = !!useStore((s) => s.net.noHours)
  const go = () => !noHours && text.trim() && onStart(text, pickers)
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center overflow-y-auto px-6 pb-10">
      <h1 className="motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 mt-[max(96px,14vh)] text-[32px] leading-10 font-medium tracking-[-0.4px]">What should Revolte work on?</h1>
      {noHours && (
        <div className="mt-8 -mb-2 flex w-[min(840px,100%)] items-center gap-2.5 rounded-xl bg-[#3a2a16] px-3.5 py-3 text-[13px] text-[#f1e3c8]" role="alert">
          <Icon name="warn" size={16} className="shrink-0 text-warning" />
          <span className="flex-1">You have used all sandbox hours in your plan for November. They reset on 1 December.</span>
          <button className="underline underline-offset-2" onClick={() => (setState((st) => ({ net: { ...st.net, noHours: false } })), onNote('Plan upgraded|Sandbox hours are back.'))}>
            Upgrade plan
          </button>
        </div>
      )}
      <div className={cn('w-[min(840px,100%)] shrink-0 overflow-hidden rounded-2xl border border-input bg-surface', noHours ? 'mt-4' : 'mt-10')}>
        <Textarea
          aria-label="Describe what to build or fix"
          placeholder="Describe what to build or fix. Revolte plans it, builds it and tests it."
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault()
              go()
            }
          }}
          className="h-[84px] min-h-0 resize-none rounded-none border-0 bg-transparent px-[18px] pt-4 text-[14px] leading-[22px] shadow-none focus-visible:ring-0 dark:bg-transparent"
        />
        <Toolbar
          credits={credits}
          value={pickers}
          onChange={setPickers}
          onNote={onNote}
          onFiles={() => onNote('Files|Attaching files on the home screen comes in a later module.')}
          sendSlot={
            <Button size="icon" aria-label="Send" disabled={!text.trim() || noHours} className="size-7 rounded-md" onClick={go}>
              <Icon name="arrowUp" size={14} />
            </Button>
          }
        />
        <div className="flex gap-5 border-t border-border-subtle bg-[#121214] px-[18px] py-[9px]">
          <StartFromMenu value={start} hasApps={hasApps} onChange={setStart} onNote={onNote} />
          {start && <BranchMenu value={branch} onChange={setBranch} onNote={onNote} />}
          <SizeMenu value={size} onChange={setSize} />
        </div>
      </div>
      {saved && (
        <p className="mt-3 flex w-[min(840px,100%)] items-center gap-2 text-[12px] text-muted-foreground" role="status">
          <Icon name="checkCircle" size={13} bold className="text-success" /> Your request from the website is ready to go.
        </p>
      )}
      <div className="mt-7 flex shrink-0 flex-wrap justify-center gap-2">
        {CHIPS.map(([ic, label, full]) => (
          <Button key={label} variant="outline" size="sm" className="h-[30px] gap-2 rounded-lg border-input bg-transparent px-3 text-[13px] font-normal transition-all hover:-translate-y-px active:scale-[0.97]" onClick={() => setText(full)}>
            <Icon name={ic} size={14} /> {label}
          </Button>
        ))}
      </div>
      <section className="mt-[72px] w-[min(840px,100%)] shrink-0" aria-label="Recommended workflows">
        <div className="mb-3.5 flex items-center justify-between text-[13px] font-medium">
          Recommended workflows
          <button className="flex items-center gap-1 font-normal text-foreground" onClick={() => onNote('Workflows come in a later module.')}>
            View all <Icon name="right" size={13} />
          </button>
        </div>
        <div className="grid grid-cols-3 gap-3 max-md:grid-cols-1">
          {WORKFLOWS.map(([ic, t, d, m, apps]) => (
            <article key={t} className="flex min-h-[194px] flex-col rounded-xl border border-border-subtle p-4 transition-all duration-200 hover:-translate-y-0.5 hover:border-border hover:bg-selected/50 hover:shadow-[0_12px_30px_-18px_rgba(0,0,0,0.9)]">
              <div className="flex items-center justify-between">
                <span className="grid size-8 place-items-center rounded-lg border border-input text-muted-foreground">
                  <Icon name={ic} size={16} />
                </span>
                <span className="flex -space-x-1.5">
                  {apps.map((a) => (
                    <span key={a} className="grid size-5 place-items-center rounded-full bg-[#202023] text-[8px] ring-2 ring-background">
                      {a === 'gh' ? <GithubMark size={11} /> : a === 'jira' ? <span className="text-[#4c8dff]">◆</span> : a === 'docker' ? <span className="text-[#2496ed]">▣</span> : <span className="text-[#ff9900]">a</span>}
                    </span>
                  ))}
                </span>
              </div>
              <h3 className="mt-[22px] mb-1 text-[14px] font-medium">{t}</h3>
              <p className="text-[13px] leading-[18px] text-muted-foreground">{d}</p>
              <small className="mt-auto pt-4 text-[12px] text-subtle-foreground">{m}</small>
            </article>
          ))}
        </div>
      </section>
    </div>
  )
}
