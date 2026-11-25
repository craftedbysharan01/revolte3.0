import { useEffect, useRef, useState, type PointerEvent } from 'react'
import { connectGithub } from '../api'
import { ChatView } from '@/chat/ChatView'
import { Home } from '@/chat/Home'
import { AppDialog } from '@/chat/AppDialog'
import { BackgroundTasks, RightPane } from '@/chat/RightPane'
import { Sidebar } from '@/chat/Sidebar'
import { createChat, getChat, setTab } from '@/chat/engine'
import { Icon } from '@/components/solar'
import { Button } from '@/components/ui/button'
import { TooltipProvider } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { GetStartedStep, StepStatus, freshGetStarted, go, setState, useStore } from '../store'
import { Spinner, Toast } from '../ui/ui'

const STEPS: { id: GetStartedStep; title: string; desc: string; act: string; skippable: boolean; needs?: [GetStartedStep, string] }[] = [
  { id: 'github', title: 'Connect GitHub', desc: 'Let Revolte read and push to your repositories.', act: 'Connect', skippable: true },
  { id: 'app', title: 'Create an application', desc: 'Build and deploy a repo with Revolte.', act: 'Create', skippable: true, needs: ['github', 'Connect GitHub first. An application needs a repository.'] },
  { id: 'jira', title: 'Link a Jira project', desc: 'Add Jira context to every chat.', act: 'Link', skippable: true },
  { id: 'workflow', title: 'Run a workflow', desc: 'Plan, build and review changes with agents.', act: 'Run', skippable: false, needs: ['app', 'Create an application first.'] },
]

/** Preset states for GS-F01…F09, applied once on mount. */
function applyPreset(preset: string | null): { failed: GetStartedStep | null } {
  if (!preset?.startsWith('GS')) return { failed: null }
  const g = freshGetStarted()
  const st = g.status
  let failed: GetStartedStep | null = null
  switch (preset) {
    case 'GS-F02': g.open = false; break
    case 'GS-F03': st.github = 'done'; break
    case 'GS-F04':
    case 'GS-F05': st.github = 'skipped'; break
    case 'GS-F06': failed = 'github'; break
    case 'GS-F07': st.github = st.app = st.jira = 'done'; break
    case 'GS-F08': st.github = st.app = st.jira = st.workflow = 'done'; break
    case 'GS-F09':
      st.github = st.app = st.jira = st.workflow = 'done'
      g.open = false
      g.dismissed = true
      break
  }
  setState({ getStarted: g })
  return { failed }
}

/** Toggle that sits in a pane header, so it never floats over the title. */
function PaneToggle({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button aria-label={label} title={label} className="grid size-8 shrink-0 place-items-center rounded-md text-muted-foreground hover:bg-selected hover:text-foreground" onClick={onClick}>
      <Icon name="sidebar" size={16} />
    </button>
  )
}

/**
 * Design System "Resize handle" (shadcn ResizableHandle withHandle): a 1px line that thickens on hover and shows a
 * small grip; drag to resize, double-click to reset. Min widths: chat 360px, Preview 40%, Code changes 50%.
 */
function ChatScreen({ id, onNote, sidebarShut, openSidebar }: { id: string; onNote: (s: string) => void; sidebarShut: boolean; openSidebar: () => void }) {
  const c = useStore((s) => s.chats.find((x) => x.id === id))
  const box = useRef<HTMLDivElement>(null)
  const [pct, setPct] = useState(0.5)
  const [px, setPx] = useState(380)
  const [drag, setDrag] = useState(false)
  if (!c) return null
  const wide = c.tab === 'sandbox' || c.tab === 'code'
  const minPct = c.tab === 'code' ? 0.5 : 0.4
  const onMove = (e: PointerEvent) => {
    if (!drag || !box.current) return
    const r = box.current.getBoundingClientRect()
    const w = r.right - e.clientX
    const maxW = r.width - 360
    if (wide) setPct(Math.min(maxW / r.width, Math.max(minPct, w / r.width)))
    else setPx(Math.min(maxW, Math.max(320, w)))
  }
  const reset = () => (wide ? setPct(0.5) : setPx(380))
  const lead = sidebarShut ? <PaneToggle label="Show sidebar" onClick={openSidebar} /> : null
  return (
    <div ref={box} className={cn('flex min-h-0 flex-1', drag && 'cursor-col-resize select-none')} onPointerMove={onMove} onPointerUp={() => setDrag(false)}>
      <div className="flex min-w-[360px] flex-1">
        <ChatView c={c} lead={lead} onNote={onNote} onDeploy={() => (getChat(c.id)?.github.connected ? onNote('Deploys come in a later module.') : setTab(c.id, 'overview'))} onWorkflow={() => (setPct(0.5), setTab(c.id, 'sandbox'))} />
      </div>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panes. Double-click to reset."
        tabIndex={0}
        onDoubleClick={reset}
        onKeyDown={(e) => {
          if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
          const d = e.key === 'ArrowLeft' ? 1 : -1
          if (wide) setPct((p) => Math.min(0.75, Math.max(minPct, p + d * 0.02)))
          else setPx((w) => Math.max(320, w + d * 16))
        }}
        onPointerDown={(e) => {
          ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
          setDrag(true)
        }}
        className="group/rh relative z-10 -mx-1 w-[9px] shrink-0 cursor-col-resize outline-none"
      >
        <span className={cn('absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border-subtle transition-[width,background-color] duration-150 group-hover/rh:w-[2px] group-hover/rh:bg-input group-focus-visible/rh:w-[2px] group-focus-visible/rh:bg-input', drag && '!w-[2px] !bg-ring/20')} />
        <span className={cn('absolute top-1/2 left-1/2 h-7 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-[3px] bg-subtle-foreground opacity-0 transition-opacity duration-150 group-hover/rh:opacity-100 group-focus-visible/rh:opacity-100', drag && 'opacity-100')} />
      </div>
      <div className="flex min-h-0 shrink-0 flex-col" style={{ width: wide ? `${pct * 100}%` : px }}>
        {c.bgOpen ? <BackgroundTasks c={c} /> : <RightPane c={c} onNote={onNote} />}
      </div>
    </div>
  )
}

export function AppShell({ preset }: { preset: string | null }) {
  const boot = useRef(applyPreset(preset)).current
  const gs = useStore((s) => s.getStarted)
  const saved = useStore((s) => s.savedPrompt)
  const route = useStore((s) => s.route)
  const activeChat = useStore((s) => s.activeChat)
  const inChat = route === 'chat' && !!activeChat
  const [collapsed, setCollapsed] = useState(false)
  const [failed, setFailed] = useState<GetStartedStep | null>(boot.failed)
  const [busy, setBusy] = useState<GetStartedStep | null>(null)
  const [note, setNote] = useState('')
  // Radix portals (dialogs, menus, tooltips) mount on <body>, so the scoped resets must live there too.
  useEffect(() => {
    document.body.classList.add('rv')
    return () => document.body.classList.remove('rv')
  }, [])

  const status = gs.status
  const doneCount = STEPS.filter((s) => status[s.id] === 'done').length
  const allDone = doneCount === STEPS.length
  const locked = (id: GetStartedStep) => {
    const n = STEPS.find((s) => s.id === id)!.needs
    return !!n && status[n[0]] !== 'done'
  }
  const activeId = STEPS.find((s) => status[s.id] === 'todo' && !locked(s.id))?.id ?? null
  const set = (patch: Partial<typeof gs>) => setState((s) => ({ getStarted: { ...s.getStarted, ...patch } }))
  const mark = (id: GetStartedStep, v: StepStatus) => setState((s) => ({ getStarted: { ...s.getStarted, status: { ...s.getStarted.status, [id]: v } } }))

  const act = async (id: GetStartedStep) => {
    setFailed(null)
    setBusy(id)
    try {
      if (id === 'github') await connectGithub()
      else await new Promise((r) => setTimeout(r, 700))
      mark(id, 'done')
    } catch {
      setFailed(id)
    } finally {
      setBusy(null)
    }
  }
  const close = () => (allDone ? set({ open: false, dismissed: true }) : set({ open: false }))
  useEffect(() => {
    if (inChat || !gs.open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.open, allDone, inChat])

  const startChat = (body: string, p?: { mode: string; model: string }) => {
    if (!body.trim()) return
    const id = createChat(body, { editMode: p?.mode === 'Ask before edits' ? 'manual' : 'auto', model: p?.model })
    go('chat', { patch: { activeChat: id } })
  }
  const showRow = !gs.dismissed && !inChat
  const pct = (doneCount / STEPS.length) * 100
  const notify = (s: string) => setNote(s)
  const [title, body] = note.split('|')

  return (
    <TooltipProvider delayDuration={150}>
      <div className="rv flex h-screen overflow-hidden bg-background text-foreground">
        {!collapsed && (
          <Sidebar
            onNote={notify}
            onToggle={() => setCollapsed(true)}
            bottom={
              showRow ? (
                <button
                  className={cn('flex h-8 w-full items-center gap-2 rounded-md pr-1.5 pl-2 text-[13px] text-muted-foreground transition-colors hover:bg-selected hover:text-foreground', gs.open && 'bg-selected text-foreground')}
                  aria-expanded={gs.open}
                  onClick={() => set({ open: !gs.open })}
                >
                  <Icon name="bulb" size={16} bold={gs.open} /> Get started
                  <span className="ring ml-auto" style={{ ['--p' as string]: pct }} role="img" aria-label={`${doneCount} of 4 steps done`} />
                </button>
              ) : null
            }
          />
        )}
        <main className={cn('relative my-5 mr-5 flex min-w-0 flex-1 overflow-hidden rounded-[20px] border border-border-subtle', collapsed && 'ml-5')}>
          {collapsed && !inChat && (
            <button aria-label="Show sidebar" title="Show sidebar" className="absolute top-3.5 left-4 z-10 grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-selected hover:text-foreground" onClick={() => setCollapsed(false)}>
              <Icon name="sidebar" size={16} />
            </button>
          )}
          {inChat ? <ChatScreen key={activeChat} id={activeChat!} onNote={notify} sidebarShut={collapsed} openSidebar={() => setCollapsed(false)} /> : <Home key={saved} initial={saved} saved={!!saved} onStart={startChat} onNote={notify} />}
        </main>

        {showRow && gs.open && (
          <section className="gs" role="dialog" aria-label="Get started">
            <header className="gs-head">
              <Icon name="bulb" size={16} />
              Get Started
              <button className="icon-btn" aria-label="Close Get started" onClick={close}>
                <Icon name="close" size={16} />
              </button>
            </header>
            <ul className="gs-list">
              {STEPS.map((s) => {
                const st = status[s.id]
                const isLocked = st === 'todo' && locked(s.id)
                const isActive = s.id === activeId
                const isFailed = failed === s.id && isActive
                const cls = `gs-item ${st === 'done' ? 'done' : ''} ${isActive ? 'active' : ''} ${isLocked ? 'locked' : ''} ${st === 'skipped' ? 'skipped' : ''}`
                return (
                  <li key={s.id} className={cls} aria-current={isActive ? 'step' : undefined} onClick={() => st === 'skipped' && mark(s.id, 'todo')} style={st === 'skipped' ? { cursor: 'pointer' } : undefined}>
                    <span className={`mark ${st === 'done' ? 'done' : isFailed ? 'failed' : isActive ? 'active' : 'todo'}`}>{st === 'done' && <Icon name="check" size={12} />}</span>
                    <div>
                      <h4>{s.title}</h4>
                      {st !== 'done' && <p className={isFailed ? 'err' : ''}>{isFailed ? 'GitHub did not connect. Check that the Revolte app is installed, then try again.' : st === 'skipped' ? 'Skipped. Open it here when you are ready.' : isLocked ? s.needs![1] : s.desc}</p>}
                      {isActive && (
                        <div className="gs-act">
                          <Button size="sm" className="h-6 rounded-md px-2.5 text-[13px]" disabled={busy === s.id} onClick={() => act(s.id)}>
                            {busy === s.id && <Spinner />}
                            {isFailed ? 'Try again' : s.act}
                          </Button>
                          {s.skippable && (
                            <Button variant="ghost" size="sm" className="h-6 px-1 text-[13px] hover:bg-transparent hover:underline" disabled={busy === s.id} onClick={() => (setFailed(null), mark(s.id, 'skipped'))}>
                              Skip
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                )
              })}
            </ul>
            {allDone && (
              <footer className="gs-foot">
                <b>You are all set</b>
                <span>Get started leaves the sidebar when you close this.</span>
              </footer>
            )}
          </section>
        )}
        {inChat && <AppDialog onNote={notify} />}
        {note && <Toast title={title} body={body} onClose={() => setNote('')} ms={4200} />}
      </div>
    </TooltipProvider>
  )
}
