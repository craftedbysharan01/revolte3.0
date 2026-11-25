import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon, type IconName } from '@/components/solar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { Spin } from './bits'
import type { Chat } from './types'
import { cn } from '@/lib/utils'
import { go, setState, useStore } from '@/store'
import { Logo } from '@/ui/ui'

/** Figma "Sidebar item" labels and icons (Design System 3.0). */
const NAV: [IconName, string][] = [
  ['newChat', 'New chat'],
  ['boxMin', 'Create application'],
  ['folder', 'Projects'],
  ['notebook', 'Context'],
  ['plugCircle', 'Integrations'],
  ['atom', 'Models'],
  ['bot', 'Agents'],
  ['server', 'Environments'],
]

/** EC18-EC20: what a chat is doing when you are not looking at it. */
type Status = 'running' | 'waiting' | null
const statusOf = (c: Chat): Status => (['asking', 'plan', 'failed'].includes(c.phase) ? 'waiting' : ['thinking', 'planning', 'revising', 'developing', 'verifying'].includes(c.phase) ? 'running' : null)
const WHY: Record<string, string> = { waiting: 'Revolte is waiting for your answer', running: 'Revolte is working on this' }

function StatusMark({ s, className }: { s: Status; className?: string }) {
  if (!s) return null
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span aria-label={WHY[s]} role="img" className={cn('inline-flex shrink-0', className)}>
          {s === 'running' ? <Spin size={12} /> : <span className="size-2 rounded-full bg-warning" />}
        </span>
      </TooltipTrigger>
      <TooltipContent side="right">{WHY[s]}</TooltipContent>
    </Tooltip>
  )
}

/** Demo chats that already exist in the workspace, so the sidebar can show every status. */
const PAMS_CHATS: [string, Status][] = [['Add Google sign-in to admin', null], ['Upgrade to Next.js 15', 'waiting']]
const UNASSIGNED_CHATS: [string, Status][] = [['Add Google sign-in to admin', 'running'], ['Upgrade to Next.js 15', null]]

/** N25: Run Revolte from your terminal. Pops up on its own once, after a chat is finished and you are back at the prompt, and on hover any time. */
function CliCard({ onEnter, onLeave, onNote }: { onEnter: () => void; onLeave: () => void; onNote: (s: string) => void }) {
  const [copied, setCopied] = useState(false)
  return (
    <div
      role="dialog"
      aria-label="Revolte CLI"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed bottom-[110px] left-[144px] z-40 flex w-[340px] origin-bottom-left flex-col overflow-hidden rounded-xl border border-border bg-[#19191b] shadow-[0_20px_25px_-5px_rgba(0,0,0,0.24),0_8px_10px_-6px_rgba(0,0,0,0.16)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
    >
      <div className="h-px bg-border-subtle" />
      <img src={`${import.meta.env.BASE_URL}assets/cli-hero.png`} alt="Revolte Code running in a terminal" width={339} height={192} className="block h-[192px] w-[339px] rounded-t-[9px]" />
      <div className="flex flex-col gap-3 p-4">
        <div className="flex flex-col gap-1">
          <h4 className="text-[14px] leading-5 font-medium">Run Revolte from your terminal</h4>
          <p className="text-[13px] leading-[18px] text-muted-foreground">Start workflows, check runs and open sandboxes without leaving the command line.</p>
        </div>
        <div className="flex items-center gap-2 rounded-md border border-border-subtle bg-[#0f0f10] py-1.5 pr-1.5 pl-3">
          <code className="flex-1 font-mono text-[12px] leading-[18px] text-muted-foreground">npm install -g revolte</code>
          <button
            aria-label={copied ? 'Copied' : 'Copy install command'}
            className="grid size-6 place-items-center rounded-[6px] text-muted-foreground transition-colors hover:bg-selected hover:text-foreground active:scale-90"
            onClick={() => {
              void navigator.clipboard?.writeText('npm install -g revolte')
              setCopied(true)
              setTimeout(() => setCopied(false), 1400)
            }}
          >
            <Icon name={copied ? 'check' : 'copy'} size={14} />
          </button>
        </div>
        <div className="flex items-start gap-2">
          <Button size="sm" className="h-7 gap-1.5 rounded-md px-2.5 text-[12px] font-medium" onClick={() => onNote('Revolte CLI|Download starts in the real product.')}>
            <Icon name="download" size={14} /> Download CLI
          </Button>
          <Button variant="ghost" size="sm" className="h-7 gap-1.5 rounded-md px-2.5 text-[12px] font-medium" onClick={() => onNote('Docs|The docs open in the real product.')}>
            Read the docs <Icon name="squareOut" size={14} />
          </Button>
        </div>
      </div>
    </div>
  )
}

/** Sidebar item: 32px row, 8px left / 6px right, 16px icon, 8px gap, 13px label. Icon goes Bold on hover. */
const ROW = 'group/item flex h-8 w-full shrink-0 items-center gap-2 rounded-md pr-1.5 pl-2 text-left text-[13px] leading-[18px] text-muted-foreground transition-colors duration-150 hover:bg-selected hover:text-foreground active:scale-[0.99]'

/** Account menu (Figma 1202:1890). Opens above the account row on hover. Only Sign out does anything for now. */
function AccountMenu({ name, email, ws, initials, onEnter, onLeave }: { name: string; email: string; ws: string; initials: string; onEnter: () => void; onLeave: () => void }) {
  const item = 'group/mi flex h-8 w-full items-center gap-2 rounded-[6px] px-2 text-left text-[13px] leading-[18px] text-foreground hover:bg-selected'
  const Item = ({ icon, label, right, chevron, onClick }: { icon: IconName; label: string; right?: string; chevron?: boolean; onClick?: () => void }) => (
    <button className={item} onClick={onClick} tabIndex={onClick ? 0 : -1} aria-disabled={!onClick}>
      <span className="group-hover/mi:hidden"><Icon name={icon} size={16} /></span>
      <span className="hidden group-hover/mi:inline"><Icon name={icon} size={16} bold /></span>
      <span className="flex-1">{label}</span>
      {right && <span className="text-subtle-foreground">{right}</span>}
      {chevron && <Icon name="right" size={14} className="text-subtle-foreground" />}
    </button>
  )
  return (
    <div
      role="menu"
      aria-label="Account"
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      className="fixed bottom-[64px] left-4 z-40 flex w-[288px] origin-bottom-left flex-col rounded-[10px] border border-border bg-[#19191b] p-1 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.16),0_4px_6px_-4px_rgba(0,0,0,0.12)] motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
    >
      <div className="flex items-center gap-3 p-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full border border-border-subtle bg-muted text-[14px] font-medium">{initials}</span>
        <span className="min-w-0">
          <span className="block truncate text-[14px] leading-5 font-medium">{name}</span>
          <span className="block truncate text-[12px] leading-[18px] tracking-[0.12px] text-subtle-foreground">{email}</span>
        </span>
      </div>
      <div className="flex items-center gap-2.5 rounded-md bg-muted p-2.5">
        <Icon name="buildings" size={18} className="text-muted-foreground" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-4 font-medium">{ws}</span>
          <span className="block text-[12px] leading-[18px] tracking-[0.12px] text-subtle-foreground">Free plan</span>
        </span>
        <Button size="sm" className="h-7 rounded-md px-2.5 text-[12px]" tabIndex={-1}>Upgrade</Button>
      </div>
      <div className="flex flex-col gap-2 p-3">
        <div className="flex text-[12px] leading-[18px] tracking-[0.12px]">
          <span className="flex-1 text-muted-foreground">AI tokens</span>
          <span className="text-subtle-foreground">35.4K of 100K</span>
        </div>
        <div className="h-1 overflow-hidden rounded-[2px] bg-muted">
          <div className="h-1 w-[35%] bg-[#2f6ff2] motion-safe:animate-[grow_600ms_ease-out]" />
        </div>
      </div>
      <div className="my-1 h-px bg-border-subtle" />
      <Item icon="user" label="Profile" />
      <Item icon="users" label="Members" />
      <Item icon="card" label="Billing and usage" />
      <Item icon="sun" label="Theme" right="Dark" chevron />
      <div className="my-1 h-px bg-border-subtle" />
      <Item icon="question" label="Help and support" chevron />
      <div className="my-1 h-px bg-border-subtle" />
      <Item
        icon="logout"
        label="Sign out"
        onClick={() => {
          setState({ session: null, activeChat: null })
          go('signin')
        }}
      />
    </div>
  )
}

/** Icon button in the sidebar header: 28px, 16px icon, Bold on hover. */
function HeadBtn({ icon, label, onClick }: { icon: IconName; label: string; onClick: () => void }) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <button aria-label={label} className="group/hb grid size-7 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-selected hover:text-foreground active:scale-95" onClick={onClick}>
          <span className="group-hover/hb:hidden"><Icon name={icon} size={16} /></span>
          <span className="hidden group-hover/hb:inline"><Icon name={icon} size={16} bold /></span>
        </button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}

/** Sidebar row icon: Linear, swapping to Bold on hover or when the row is active. */
const RowIcon = ({ name, on }: { name: IconName; on?: boolean }) =>
  on ? (
    <Icon name={name} size={16} bold />
  ) : (
    <>
      <span className="group-hover/item:hidden"><Icon name={name} size={16} /></span>
      <span className="hidden group-hover/item:inline"><Icon name={name} size={16} bold /></span>
    </>
  )

export function Sidebar({ onNote, bottom, onToggle }: { onNote: (s: string) => void; bottom?: ReactNode; onToggle: () => void }) {
  const chats = useStore((s) => s.chats)
  const active = useStore((s) => s.activeChat)
  const route = useStore((s) => s.route)
  const session = useStore((s) => s.session)
  const accounts = useStore((s) => s.accounts)
  const inChat = route === 'chat'
  const acct = accounts.find((a) => a.email === session?.email)
  const name = acct ? acct.username.split(/[-_]/).map((w) => w[0]?.toUpperCase() + w.slice(1)).join(' ') : 'James Hall'
  const initials = name.split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase()
  const ws = acct?.workspace?.name ?? 'Acme Corp'
  const [projectsOpen, setProjectsOpen] = useState(true)
  const [unassignedOpen, setUnassignedOpen] = useState(true)

  /* CLI card: once per visit after a finished chat, and on hover */
  const [cli, setCli] = useState(false)
  const hover = useRef(false)
  const timer = useRef<number | undefined>(undefined)
  const finishedOne = chats.some((c) => c.phase === 'done')
  useEffect(() => {
    if (inChat || !finishedOne || sessionStorage.getItem('rv-cli-seen')) return
    const open = setTimeout(() => {
      sessionStorage.setItem('rv-cli-seen', '1')
      setCli(true)
      timer.current = window.setTimeout(() => !hover.current && setCli(false), 6500)
    }, 1400)
    return () => clearTimeout(open)
  }, [inChat, finishedOne])
  const enter = () => {
    hover.current = true
    clearTimeout(timer.current)
    setCli(true)
  }
  const leave = () => {
    hover.current = false
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setCli(false), 250)
  }

  /* Account menu on hover */
  const [acc, setAcc] = useState(false)
  const accT = useRef<number | undefined>(undefined)
  const accIn = () => (clearTimeout(accT.current), setAcc(true))
  const accOut = () => (clearTimeout(accT.current), (accT.current = window.setTimeout(() => setAcc(false), 200)))

  const waiting = chats.filter((c) => statusOf(c) === 'waiting').length
  const running = chats.filter((c) => statusOf(c) === 'running').length
  const summary = [waiting ? `${waiting} chat${waiting > 1 ? 's' : ''} ${waiting > 1 ? 'need' : 'needs'} your answer` : '', running ? `${running} running` : ''].filter(Boolean).join(' · ')

  return (
    <aside aria-label="Sidebar" className="sticky top-0 flex h-screen w-[248px] shrink-0 flex-col gap-3 px-4 pt-4 pb-3">
      <div className="flex items-center gap-1">
        <Logo className="!m-0" />
        <span className="grow" />
        <HeadBtn icon="inbox" label="Notifications" onClick={() => onNote('Notifications come in a later module.')} />
        <HeadBtn icon="sidebar" label="Collapse sidebar" onClick={onToggle} />
        <HeadBtn icon="search" label="Search" onClick={() => onNote('Search comes in a later module.')} />
      </div>

      <Tabs defaultValue="chat" className="shrink-0">
        <TabsList className="h-[34px] w-full gap-[3px] rounded-md border border-border bg-muted p-0.5">
          <TabsTrigger value="chat" className="h-7 rounded-[6px] text-[13px] font-medium transition-colors data-[state=active]:bg-selected data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_1px_rgba(0,0,0,0.06)]">
            Chat
          </TabsTrigger>
          <TabsTrigger value="workflows" className="h-7 rounded-[6px] text-[13px] font-medium" onClick={() => onNote('Workflows come in a later module.')}>
            Workflows
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <nav className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto [scrollbar-width:none]">
        <div className="flex flex-col">
          {NAV.map(([ic, label], i) => {
            const on = i === 0 && !inChat
            return (
              <button
                key={label}
                className={cn(ROW, on && 'bg-selected text-foreground')}
                onClick={() => (i === 0 ? go('app', { patch: { activeChat: null } }) : i === 1 && inChat ? setState({ appDialog: true }) : onNote(`${label} comes in a later module.`))}
              >
                <RowIcon name={ic} on={on} />
                <span className="flex-1">{label}</span>
                {label === 'Context' && <Badge className="h-[18px] rounded-[6px] border-0 bg-[#d93b30] px-1.5 text-[12px] leading-4 font-medium text-white">New</Badge>}
              </button>
            )
          })}
        </div>

        {chats.length > 0 && (
          <div className="flex flex-col gap-0.5">
            <button className="flex h-6 items-center gap-1 rounded-md pr-1.5 pl-2 text-[10px] leading-4 font-semibold tracking-[0.7px] text-subtle-foreground uppercase hover:text-muted-foreground" aria-expanded={projectsOpen} onClick={() => setProjectsOpen(!projectsOpen)}>
              Projects <Icon name="down" size={12} className={cn('transition-transform duration-200', !projectsOpen && '-rotate-90')} />
            </button>
            {projectsOpen && (
              <div className="flex flex-col motion-safe:animate-in motion-safe:fade-in-0 motion-safe:duration-200">
                <button className={ROW} aria-expanded={unassignedOpen} onClick={() => setUnassignedOpen(!unassignedOpen)}>
                  <RowIcon name={unassignedOpen ? 'folderOpen' : 'folder'} />
                  <span className="flex-1">Unassigned</span>
                  {!unassignedOpen && summary ? (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="inline-flex" role="img" aria-label={summary}>
                          {waiting ? <span className="size-2 rounded-full bg-warning" /> : <Spin size={12} />}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent side="right">{summary}</TooltipContent>
                    </Tooltip>
                  ) : null}
                </button>
                {unassignedOpen &&
                  chats.map((c) => {
                    const on = inChat && c.id === active
                    const st = statusOf(c)
                    return (
                      <div key={c.id} className={cn('group/row relative rounded-md motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-left-1 motion-safe:duration-300', on && 'bg-selected')}>
                        <button aria-current={on ? 'page' : undefined} className={cn(ROW, 'pl-7 pr-8', on && 'text-foreground hover:bg-transparent')} onClick={() => go('chat', { patch: { activeChat: c.id } })}>
                          <span className="truncate">{c.title}</span>
                        </button>
                        <StatusMark s={on ? null : st} className="absolute top-1/2 right-2.5 -translate-y-1/2 group-hover/row:opacity-0" />
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button aria-label={`Options for ${c.title}`} className={cn('absolute top-1/2 right-1 grid size-6 -translate-y-1/2 place-items-center rounded-[6px] text-muted-foreground hover:bg-selected hover:text-foreground', on ? 'opacity-100' : 'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100')}>
                              <Icon name="dots" size={14} bold />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="start" className="w-40">
                            <DropdownMenuItem onSelect={() => onNote('Rename comes in a later module.')}>
                              <Icon name="pen" size={14} /> Rename
                            </DropdownMenuItem>
                            <DropdownMenuItem onSelect={() => onNote('Archive comes in a later module.')}>
                              <Icon name="archive" size={14} /> Archive
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              variant="destructive"
                              onSelect={() => {
                                setState((s) => ({ chats: s.chats.filter((x) => x.id !== c.id), activeChat: s.activeChat === c.id ? null : s.activeChat }))
                                if (on) go('app', { patch: { activeChat: null } })
                              }}
                            >
                              <Icon name="trash" size={14} /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    )
                  })}
              </div>
            )}
          </div>
        )}
      </nav>

      <div className="flex shrink-0 flex-col gap-2">
        <div className="h-px bg-border-subtle" />
        <div className="flex flex-col">
          {bottom}
          <button className={cn(ROW, cli && 'bg-selected text-foreground')} onMouseEnter={enter} onMouseLeave={leave} onFocus={enter} onBlur={leave} onClick={() => onNote('Revolte CLI|Download starts in the real product.')}>
            <RowIcon name="download" on={cli} />
            Download CLI
          </button>
          {cli && createPortal(<CliCard onEnter={enter} onLeave={leave} onNote={onNote} />, document.body)}
        </div>
        <button
          className={cn('flex items-center gap-2 rounded-[10px] border border-transparent p-2 text-left transition-colors', acc && 'border-border bg-selected')}
          aria-haspopup="menu"
          aria-expanded={acc}
          onMouseEnter={accIn}
          onMouseLeave={accOut}
          onFocus={accIn}
          onBlur={accOut}
        >
          <span className="grid size-8 shrink-0 place-items-center rounded-full border border-border-subtle bg-muted text-[13px] leading-4 font-medium">{initials}</span>
          <span className="flex min-w-0 flex-1 items-baseline gap-1.5 whitespace-nowrap">
            <span className="truncate text-[14px] leading-5 font-medium">{name}</span>
            <span className="text-[13px] leading-[18px] text-subtle-foreground">Free plan</span>
          </span>
          {acc && <Icon name="sort" size={14} className="text-muted-foreground" />}
        </button>
        {acc && createPortal(<AccountMenu name={name} email={session?.email ?? 'james@acmecorp.com'} ws={ws} initials={initials} onEnter={accIn} onLeave={accOut} />, document.body)}
      </div>
    </aside>
  )
}

export { Button }
