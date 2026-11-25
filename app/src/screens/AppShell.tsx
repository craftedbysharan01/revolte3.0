import { useEffect, useRef, useState } from 'react'
import { connectGithub } from '../api'
import { GetStartedStep, StepStatus, freshGetStarted, setState, useStore } from '../store'
import { Icon, IconName } from '../ui/Icon'
import { Button, Logo, Toast } from '../ui/ui'

const STEPS: { id: GetStartedStep; title: string; desc: string; act: string; skippable: boolean; needs?: [GetStartedStep, string] }[] = [
  { id: 'github', title: 'Connect GitHub', desc: 'Let Revolte read and push to your repositories.', act: 'Connect', skippable: true },
  {
    id: 'app',
    title: 'Create an application',
    desc: 'Build and deploy a repo with Revolte.',
    act: 'Create',
    skippable: true,
    needs: ['github', 'Connect GitHub first. An application needs a repository.'],
  },
  { id: 'jira', title: 'Link a Jira project', desc: 'Add Jira context to every chat.', act: 'Link', skippable: true },
  {
    id: 'workflow',
    title: 'Run a workflow',
    desc: 'Plan, build and review changes with agents.',
    act: 'Run',
    skippable: false,
    needs: ['app', 'Create an application first.'],
  },
]

/** Preset states for GS-F01…F09, applied once on mount. */
function applyPreset(preset: string | null): { failed: GetStartedStep | null } {
  if (!preset?.startsWith('GS')) return { failed: null }
  const g = freshGetStarted()
  const st = g.status
  let failed: GetStartedStep | null = null
  switch (preset) {
    case 'GS-F02':
      g.open = false
      break
    case 'GS-F03':
      st.github = 'done'
      break
    case 'GS-F04':
    case 'GS-F05':
      st.github = 'skipped'
      break
    case 'GS-F06':
      failed = 'github'
      break
    case 'GS-F07':
      st.github = st.app = st.jira = 'done'
      break
    case 'GS-F08':
      st.github = st.app = st.jira = st.workflow = 'done'
      break
    case 'GS-F09':
      st.github = st.app = st.jira = st.workflow = 'done'
      g.open = false
      g.dismissed = true
      break
  }
  setState({ getStarted: g })
  return { failed }
}

const NAV: [IconName, string][] = [
  ['edit', 'New chat'],
  ['cube', 'Create application'],
  ['folder', 'Projects'],
  ['doc', 'Context'],
  ['plug', 'Integrations'],
  ['model', 'Models'],
  ['bot', 'Agents'],
  ['server', 'Environments'],
]

const CHIPS: [IconName, string, string][] = [
  ['shield', 'Build an auth feature', 'Build an auth feature with email and OAuth sign in, sessions, and password reset.'],
  ['code', 'Fix an API 500 error', 'Find and fix the cause of the intermittent 500 on POST /api/orders.'],
  ['refresh', 'Migrate a .NET service', 'Migrate our .NET Framework 4.8 billing service to .NET 8 and prove nothing broke.'],
  ['database', 'Speed up slow queries', 'Find the slowest queries in production and speed them up without changing behavior.'],
]

export function AppShell({ preset }: { preset: string | null }) {
  const boot = useRef(applyPreset(preset)).current
  const gs = useStore((s) => s.getStarted)
  const session = useStore((s) => s.session)
  const accounts = useStore((s) => s.accounts)
  const saved = useStore((s) => s.savedPrompt)
  // The website request stays editable here and keeps its call to action until it is sent.
  const [text, setText] = useState(saved)
  const [failed, setFailed] = useState<GetStartedStep | null>(boot.failed)
  const [busy, setBusy] = useState<GetStartedStep | null>(null)
  const [note, setNote] = useState('')
  const acct = accounts.find((a) => a.email === session?.email)
  const displayName = acct ? acct.username.split(/[-_]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : 'James Hall'
  const initials = displayName.split(' ').map((w) => w[0]).join('').slice(0, 2)

  const status = gs.status
  const doneCount = STEPS.filter((s) => status[s.id] === 'done').length
  const allDone = doneCount === STEPS.length
  const locked = (id: GetStartedStep) => {
    const n = STEPS.find((s) => s.id === id)!.needs
    return !!n && status[n[0]] !== 'done'
  }
  const activeId = STEPS.find((s) => status[s.id] === 'todo' && !locked(s.id))?.id ?? null
  const closeRef = useRef<HTMLButtonElement>(null)

  const set = (patch: Partial<typeof gs>) => setState((s) => ({ getStarted: { ...s.getStarted, ...patch } }))
  const mark = (id: GetStartedStep, v: StepStatus) =>
    setState((s) => ({ getStarted: { ...s.getStarted, status: { ...s.getStarted.status, [id]: v } } }))

  const act = async (id: GetStartedStep) => {
    setFailed(null)
    setBusy(id)
    try {
      if (id === 'github') await connectGithub()
      else await new Promise((r) => setTimeout(r, 700)) // other steps open their own modules (built next)
      mark(id, 'done')
    } catch {
      setFailed(id)
    } finally {
      setBusy(null)
    }
  }

  // Escape closes the card; focus moves into it when opened.
  useEffect(() => {
    if (!gs.open) return
    const k = (e: KeyboardEvent) => e.key === 'Escape' && close()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gs.open, allDone])

  const close = () => {
    if (allDone) set({ open: false, dismissed: true }) // "Get started leaves the sidebar when you close this"
    else set({ open: false })
  }

  const showRow = !gs.dismissed
  const pct = (doneCount / STEPS.length) * 100

  return (
    <div className="app">
      <aside className="side" aria-label="Sidebar">
        <div className="side-top">
          <Logo />
          <span className="ics">
            <Icon name="inbox" size={16} />
            <Icon name="panel" size={16} />
            <Icon name="search" size={16} />
          </span>
        </div>
        <div className="seg" role="tablist">
          <button className="on" role="tab" aria-selected="true">
            Chat
          </button>
          <button role="tab" aria-selected="false">
            Workflows
          </button>
        </div>
        <nav className="nav">
          {NAV.map(([ic, label], i) => (
            <button key={label} className={i === 0 ? 'on' : ''} onClick={() => i !== 0 && setNote(`${label} comes in a later module.`)}>
              <Icon name={ic} size={16} />
              {label}
              {label === 'Context' && <span className="new">New</span>}
            </button>
          ))}
          <div className="proj-h">
            PROJECTS <Icon name="chevronDown" size={12} />
          </div>
          <button>
            <Icon name="folder" size={16} />
            PAMS
          </button>
          <button className="sub">Add Google sign-in to admin</button>
          <button className="sub">Upgrade to Next.js 15</button>
          <button>
            <Icon name="folder" size={16} />
            Unassigned
          </button>
          <button className="sub">Add Google sign-in to admin</button>
          <button className="sub">Upgrade to Next.js 15</button>
        </nav>
        <div className="side-bottom">
          {showRow && (
            <button className={`gs-row ${gs.open ? 'on' : ''}`} aria-expanded={gs.open} onClick={() => set({ open: !gs.open })}>
              <Icon name="bulb" size={16} />
              Get started
              <span className="ring" style={{ ['--p' as string]: pct }} role="img" aria-label={`${doneCount} of 4 steps done`} />
            </button>
          )}
          <button className="gs-row">
            <Icon name="download" size={16} />
            Download CLI
          </button>
          <div className="me">
            <span className="avatar">{initials}</span>
            <span>
              {displayName} <small>Free plan</small>
            </span>
          </div>
        </div>
      </aside>

      <main className="panel">
        <h2>{saved ? `You're in, ${displayName.split(' ')[0]}. Ready when you are.` : 'What should Revolte work on?'}</h2>
        {saved && (
          <div className="ready" role="status">
            <span className="toast-ic">
              <Icon name="check" size={12} />
            </span>
            <span>Your request from the website is ready to go. Review it, then start building.</span>
            <Button
              onClick={() => {
                setState({ savedPrompt: '' })
                setNote('Starting your build. The chat itself is the next module in this prototype.')
              }}
            >
              Start building
            </Button>
          </div>
        )}
        <div className="composer">
          <textarea
            aria-label="Describe what to build or fix"
            placeholder="Describe what to build or fix. Revolte plans it, builds it and tests it."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="composer-bar">
            <button className="plus" aria-label="Add">
              <Icon name="plus" size={14} />
            </button>
            <span>Agent</span>
            <span>
              Credits : <span style={{ color: 'var(--subtle-foreground)' }}>100</span>
            </span>
            <span className="grow" />
            <span>Auto</span>
            <span>
              Sonnet 5 <span style={{ color: 'var(--subtle-foreground)' }}>Medium</span>
            </span>
            <button
              className="send"
              aria-label="Send"
              disabled={!text.trim()}
              onClick={() => setNote('Chat is the next module in this prototype.')}
            >
              <Icon name="send" size={14} />
            </button>
          </div>
          <div className="composer-sub">
            <span>
              <Icon name="cube" size={14} /> Start from scratch
            </span>
            <span>
              <Icon name="server" size={14} /> 2 vCPU · 4 GB (Standard)
            </span>
          </div>
        </div>
        <div className="qchips">
          {CHIPS.map(([ic, label, full]) => (
            <button key={label} onClick={() => setText(full)}>
              <Icon name={ic} size={14} />
              {label}
            </button>
          ))}
        </div>
        <div className="wf">
          <div className="wf-h">
            Recommended workflows <span>View all ›</span>
          </div>
          <div className="wf-grid">
            {[
              ['code', 'On-demand development', 'Turns a ticket or prompt into tested code and a draft pull request.', '11 steps · 7 agents'],
              ['edit', 'QA and validation', 'Checks finished work, runs QA and flags issues before release.', '11 steps · 7 agents'],
              ['refresh', 'Legacy migration', 'Upgrades a legacy service, moves the code and proves nothing broke.', '14 steps · 6 agents'],
            ].map(([ic, t, d, m]) => (
              <div className="wf-card" key={t}>
                <span className="ic">
                  <Icon name={ic as IconName} size={16} />
                </span>
                <h4>{t}</h4>
                <p>{d}</p>
                <small>{m}</small>
              </div>
            ))}
          </div>
        </div>
      </main>

      {showRow && gs.open && (
        <section className="gs" role="dialog" aria-label="Get started">
          <header className="gs-head">
            <Icon name="bulb" size={16} />
            Get Started
            <button ref={closeRef} className="icon-btn" aria-label="Close Get started" onClick={close}>
              <Icon name="x" size={16} />
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
                <li
                  key={s.id}
                  className={cls}
                  aria-current={isActive ? 'step' : undefined}
                  onClick={() => st === 'skipped' && mark(s.id, 'todo')}
                  style={st === 'skipped' ? { cursor: 'pointer' } : undefined}
                >
                  <span className={`mark ${st === 'done' ? 'done' : isFailed ? 'failed' : isActive ? 'active' : 'todo'}`}>
                    {st === 'done' && <Icon name="check" size={12} />}
                  </span>
                  <div>
                    <h4>{s.title}</h4>
                    {st !== 'done' && (
                      <p className={isFailed ? 'err' : ''}>
                        {isFailed
                          ? 'GitHub did not connect. Check that the Revolte app is installed, then try again.'
                          : st === 'skipped'
                            ? 'Skipped. Open it here when you are ready.'
                            : isLocked
                              ? s.needs![1]
                              : s.desc}
                      </p>
                    )}
                    {isActive && (
                      <div className="gs-act">
                        <Button loading={busy === s.id} onClick={() => act(s.id)}>
                          {isFailed ? 'Try again' : s.act}
                        </Button>
                        {s.skippable && (
                          <Button
                            className="ghost"
                            variant="secondary"
                            disabled={busy === s.id}
                            onClick={() => {
                              setFailed(null)
                              mark(s.id, 'skipped')
                            }}
                          >
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
      {note && <Toast title={note} onClose={() => setNote('')} ms={3200} />}
    </div>
  )
}
