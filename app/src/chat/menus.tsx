/**
 * Composer pickers, built from the Figma New chat states (N05-N16) and the Design System "Menu" / "Menu item":
 * popover #19191b, 1px border, 10px radius, 4px padding; items 32px, 13px, 16px icon going Bold on highlight;
 * overline labels 10px uppercase. Everything is a shadcn DropdownMenu.
 */
import { useState, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/solar'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import { GithubMark } from '@/ui/Icon'

export const MENU = 'rounded-[10px] border border-border bg-[#19191b] p-1 text-foreground shadow-[0_10px_15px_-3px_rgba(0,0,0,0.16),0_4px_6px_-4px_rgba(0,0,0,0.12)]'
const ITEM = 'group/mi h-8 gap-2 rounded-[6px] px-2 text-[13px] leading-[18px] text-foreground outline-none focus:bg-white/[0.06] focus-visible:ring-0 data-[highlighted]:bg-white/[0.06] [&>svg:last-child]:size-3.5 [&>svg:last-child]:text-subtle-foreground'
const TRIGGER = 'flex h-7 shrink-0 items-center gap-1.5 rounded-md px-1.5 text-[13px] whitespace-nowrap text-muted-foreground outline-none transition-colors hover:text-foreground data-[state=open]:text-foreground'

export const Label = ({ children }: { children: ReactNode }) => <div className="flex h-7 items-center px-2 text-[10px] leading-4 font-semibold tracking-[0.7px] text-subtle-foreground uppercase">{children}</div>
export const Sep = () => <div className="-mx-1 my-1 h-px bg-border-subtle" />

/** Icon that swaps to Bold while its menu row is highlighted. */
export const MIcon = ({ name, size = 16 }: { name: IconName; size?: number }) => (
  <>
    <span className="text-muted-foreground group-data-[highlighted]/mi:hidden"><Icon name={name} size={size} /></span>
    <span className="hidden group-data-[highlighted]/mi:inline"><Icon name={name} size={size} bold /></span>
  </>
)

function Search({ placeholder, value, onChange }: { placeholder: string; value: string; onChange: (v: string) => void }) {
  return (
    <div className="p-1">
      <label className="flex h-7 items-center gap-2 rounded-md border border-subtle-foreground px-2.5 focus-within:ring-[3px] focus-within:ring-foreground/20">
        <Icon name="search" size={16} className="text-muted-foreground" />
        <input
          autoFocus
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key !== 'Escape' && e.stopPropagation()}
          className="min-w-0 flex-1 bg-transparent text-[13px] leading-[18px] outline-none placeholder:text-subtle-foreground"
        />
      </label>
    </div>
  )
}

/* ---------- N13 Agent ---------- */

export const AGENTS: [string, IconName, string][] = [
  ['Developer', 'code', 'Builds and fixes code'],
  ['QA engineer', 'testTube', 'Writes and runs tests'],
  ['Code reviewer', 'checklist', 'Reviews changes'],
]
export function AgentMenu({ value, onChange, onNote }: { value: string; onChange: (v: string) => void; onNote: (s: string) => void }) {
  const picked = value !== 'Agent'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={cn(TRIGGER, 'text-foreground/90', picked && 'bg-selected px-2 text-foreground')}>
        <Icon name="bot" size={16} bold={picked} /> {picked ? `${value} agent` : 'Agent'} <Icon name="down" size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={cn(MENU, 'w-[280px]')}>
        <Label>Agent</Label>
        {AGENTS.map(([a, ic, d]) => (
          <DropdownMenuItem key={a} className={ITEM} onSelect={() => onChange(value === a ? 'Agent' : a)}>
            <MIcon name={ic} />
            <span className="flex-1">{a}</span>
            {value === a ? <Icon name="check" size={14} /> : <span className="text-[12px] leading-4 font-medium text-subtle-foreground">{d}</span>}
          </DropdownMenuItem>
        ))}
        <Sep />
        <DropdownMenuItem className={ITEM} onSelect={() => onNote('Agents come in a later module.')}>
          <MIcon name="settings" /> Manage agents
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------- N10 Mode (home) and EC01a Edit mode (chat) ---------- */

export const HOME_MODES: [string, IconName][] = [
  ['Auto', 'forward'],
  ['Plan first', 'checklist'],
  ['Ask before edits', 'shield'],
]
export const CHAT_MODES: [string, string][] = [
  ['Manual', 'Revolte asks before it edits a file'],
  ['Auto in this chat', 'Revolte edits files without asking, only in this chat'],
  ['Auto in this project', 'Revolte edits files without asking in every chat in this project'],
]
export function ModeMenu({ kind, value, onChange }: { kind: 'home' | 'chat'; value: string; onChange: (v: string) => void }) {
  const manual = value === 'Manual' || value === 'Ask before edits'
  const label = kind === 'chat' ? (value === 'Manual' ? 'Manual' : 'Auto') : value
  const icon: IconName = kind === 'home' ? (HOME_MODES.find((m) => m[0] === value)?.[1] ?? 'forward') : manual ? 'shield' : 'forward'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={TRIGGER}>
        <Icon name={icon} size={16} /> {label} <Icon name="down" size={12} />
      </DropdownMenuTrigger>
      {kind === 'home' ? (
        <DropdownMenuContent align="end" sideOffset={6} className={cn(MENU, 'w-[220px]')}>
          <Label>Mode</Label>
          {HOME_MODES.map(([m, ic]) => (
            <DropdownMenuItem key={m} className={cn(ITEM, value === m && 'bg-white/[0.06]')} onSelect={() => onChange(m)}>
              <MIcon name={ic} /> <span className="flex-1">{m}</span>
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      ) : (
        <DropdownMenuContent align="end" sideOffset={6} className={cn(MENU, 'w-[228px]')}>
          {CHAT_MODES.map(([m, d]) => (
            <DropdownMenuItem key={m} className={cn(ITEM, 'h-auto items-start py-2', value === m && 'bg-white/[0.06]')} onSelect={() => onChange(m)}>
              <span className="flex-1">
                {m}
                <span className="block text-[12px] leading-4 text-subtle-foreground">{d}</span>
              </span>
              {value === m && <Icon name="check" size={14} className="mt-0.5" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      )}
    </DropdownMenu>
  )
}

/* ---------- N11 Model and N12 Effort ---------- */

const PROVIDERS: { name: string; mark: ReactNode; models: [string, string][] }[] = [
  { name: 'Anthropic', mark: <span className="text-[13px] leading-none text-[#e5683a]">✺</span>, models: [['Claude Fable 5.2', 'Most capable'], ['Claude Opus 5.5', 'Deep reasoning'], ['Claude Sonnet 5.5', 'Balanced for everyday tasks'], ['Claude Haiku 5.5', 'Fastest for quick answers']] },
  { name: 'OpenAI', mark: <span className="grid size-3.5 place-items-center rounded-full bg-foreground text-[8px] font-bold text-background">O</span>, models: [['GPT-5.2', 'General purpose'], ['GPT-5.2 mini', 'Fast and low cost']] },
  { name: 'Google', mark: <span className="grid size-3.5 place-items-center text-[11px] font-bold text-[#4c8dff]">G</span>, models: [['Gemini 3 Pro', 'Long context'], ['Gemini 3 Flash', 'Fast']] },
  { name: 'xAI', mark: <span className="grid size-3.5 place-items-center text-[11px] font-bold">x</span>, models: [['Grok 4', 'General purpose']] },
]
export const EFFORT: [string, string][] = [
  ['Low', 'Faster replies, fewer credits'],
  ['Medium', 'Good for most work'],
  ['High', 'Thinks longer on hard problems'],
]
export const DEFAULT_MODEL = 'Claude Sonnet 5.5'
/** The composer shows the short name ("Sonnet 5"), the menu the full one. */
export const shortModel = (m: string) => m.replace(/^Claude (\w+) (\d)\.\d$/, '$1 $2').replace(/^(\w+) (\d)$/, '$1 $2')

export function ModelMenu({ model, effort, onModel, onEffort, compact }: { model: string; effort: string; onModel: (m: string) => void; onEffort: (e: string) => void; compact?: boolean }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  const full = model.startsWith('Claude') || PROVIDERS.some((p) => p.models.some(([m]) => m === model)) ? model : DEFAULT_MODEL
  return (
    <DropdownMenu onOpenChange={() => setQ('')}>
      <DropdownMenuTrigger className={TRIGGER}>
        <span className="text-[#e5683a]">✺</span>
        <span className="text-foreground/90">{shortModel(full)}</span>
        <span className={cn('text-subtle-foreground', compact && '@max-[600px]:hidden')}>{effort}</span>
        <Icon name="down" size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={6} className={cn(MENU, 'w-[260px]')}>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={cn(ITEM, 'data-[state=open]:bg-white/[0.06]')}>
            <span className="flex-1">Model</span>
            <span className="text-subtle-foreground">{full}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6} className={cn(MENU, 'max-h-[340px] w-[300px] overflow-y-auto')}>
            <Label>Model</Label>
            <Search placeholder="Search models" value={q} onChange={setQ} />
            {PROVIDERS.map((p) => {
              const ms = p.models.filter(([m, d]) => !needle || m.toLowerCase().includes(needle) || d.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle))
              if (!ms.length) return null
              return (
                <div key={p.name}>
                  <div className="flex h-7 items-center gap-2 px-2 text-[12px] text-muted-foreground">
                    {p.mark} {p.name}
                  </div>
                  {ms.map(([m, d]) => (
                    <DropdownMenuItem key={m} className={cn(ITEM, 'h-auto py-1.5', full === m && 'bg-white/[0.06]')} onSelect={() => onModel(m)}>
                      <span className="min-w-0 flex-1">
                        <span className="block text-[13px] leading-[18px]">{m}</span>
                        <span className="block text-[12px] leading-4 text-subtle-foreground">{d}</span>
                      </span>
                      {m === DEFAULT_MODEL && (
                        <span className="flex items-center gap-1 rounded-md bg-[#16264d] px-1.5 py-0.5 text-[11px] text-[#8fb0ff]">
                          <span className="size-1 rounded-full bg-current" /> Recommended
                        </span>
                      )}
                      {full === m && <Icon name="check" size={14} />}
                    </DropdownMenuItem>
                  ))}
                </div>
              )
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={cn(ITEM, 'data-[state=open]:bg-white/[0.06]')}>
            <span className="flex-1">Effort</span>
            <span className="text-subtle-foreground">{effort}</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6} className={cn(MENU, 'w-[260px]')}>
            {EFFORT.map(([e, d]) => (
              <DropdownMenuItem key={e} className={cn(ITEM, 'h-auto py-1.5', effort === e && 'bg-white/[0.06]')} onSelect={() => onEffort(e)}>
                <span className="flex-1">
                  <span className="block">{e}</span>
                  <span className="block text-[12px] leading-4 text-subtle-foreground">{d}</span>
                </span>
                {effort === e && <Icon name="check" size={14} />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------- N15 Attach and N16 Connectors ---------- */

const FigmaMark = () => (
  <svg width="16" height="16" viewBox="0 0 38 57" aria-hidden="true">
    <path fill="#1abcfe" d="M19 28.5a9.5 9.5 0 1 1 19 0 9.5 9.5 0 0 1-19 0z" />
    <path fill="#0acf83" d="M0 47.5A9.5 9.5 0 0 1 9.5 38H19v9.5a9.5 9.5 0 1 1-19 0z" />
    <path fill="#ff7262" d="M19 0v19h9.5a9.5 9.5 0 1 0 0-19H19z" />
    <path fill="#f24e1e" d="M0 9.5A9.5 9.5 0 0 0 9.5 19H19V0H9.5A9.5 9.5 0 0 0 0 9.5z" />
    <path fill="#a259ff" d="M0 28.5A9.5 9.5 0 0 0 9.5 38H19V19H9.5A9.5 9.5 0 0 0 0 28.5z" />
  </svg>
)
const JiraMark = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
    <path fill="#2684ff" d="M22.2 11.3 12.6 1.7 11.7.8 4.4 8.1l-2.6 2.6a.9.9 0 0 0 0 1.2l6.6 6.6 3.3 3.3 7.3-7.3.1-.1 3.1-3.1a.9.9 0 0 0 0-1.2zm-10.5 4-3.3-3.3 3.3-3.3L15 12l-3.3 3.3z" />
  </svg>
)
function Toggle({ on, onClick, label }: { on: boolean; onClick: () => void; label: string }) {
  return (
    <button
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={(e) => (e.preventDefault(), e.stopPropagation(), onClick())}
      className={cn('relative h-[18px] w-8 shrink-0 rounded-full transition-colors', on ? 'bg-foreground' : 'bg-muted')}
    >
      <span className={cn('absolute top-0.5 size-3.5 rounded-full bg-background transition-transform duration-200', on ? 'translate-x-[15px]' : 'translate-x-0.5 bg-subtle-foreground')} />
    </button>
  )
}
export function AttachMenu({ trigger, onFiles, onNote }: { trigger: ReactNode; onFiles: () => void; onNote: (s: string) => void }) {
  const [on, setOn] = useState({ Figma: true, GitHub: true })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={6} className={cn(MENU, 'w-[260px]')}>
        <DropdownMenuItem className={ITEM} onSelect={onFiles}>
          <MIcon name="clip" /> <span className="flex-1">Add files or photos</span> <span className="text-subtle-foreground">⌘U</span>
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger className={cn(ITEM, 'data-[state=open]:bg-white/[0.06]')}>
            <MIcon name="plugCircle" /> <span className="flex-1">Connectors</span>
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent sideOffset={6} className={cn(MENU, 'w-[300px]')}>
            <Label>Connectors</Label>
            {(['Figma', 'GitHub'] as const).map((n) => (
              <div key={n} className="flex h-8 items-center gap-2 px-2 text-[13px]">
                {n === 'Figma' ? <FigmaMark /> : <GithubMark size={16} />}
                <span className="flex-1">{n}</span>
                <Toggle on={on[n]} label={`${n} connector`} onClick={() => setOn({ ...on, [n]: !on[n] })} />
              </div>
            ))}
            <div className="flex h-9 items-center gap-2 px-2 text-[13px]">
              <JiraMark /> <span className="flex-1">Jira</span>
              <button className="h-7 rounded-md bg-foreground px-2.5 text-[12px] font-medium text-background transition-transform active:scale-95" onClick={() => onNote('Jira|Installing connectors comes in a later module.')}>
                Install
              </button>
            </div>
            <Sep />
            <DropdownMenuItem className={ITEM} onSelect={() => onNote('Connectors come in a later module.')}>
              <MIcon name="settings" /> Manage connectors
            </DropdownMenuItem>
            <DropdownMenuItem className={ITEM} onSelect={() => onNote('Connectors come in a later module.')}>
              <MIcon name="plus" /> Add custom connector
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/* ---------- N05-N07 Start from, N08 Branch, N09 Sandbox size (home bar) ---------- */

export const PROJECTS: { name: string; apps: string[] }[] = [
  { name: 'PAMS', apps: ['Payments API', 'Webhook monitor', 'Admin portal'] },
  { name: 'Acme payments', apps: ['Ledger service', 'Admin console'] },
  { name: 'Unassigned', apps: ['Webhook monitor'] },
]
export type StartFrom = { app: string; project: string } | null
const BAR = 'flex items-center gap-1.5 rounded-md text-[13px] text-muted-foreground outline-none transition-colors hover:text-foreground data-[state=open]:text-foreground'

export function StartFromMenu({ value, hasApps, onChange, onNote }: { value: StartFrom; hasApps: boolean; onChange: (v: StartFrom) => void; onNote: (s: string) => void }) {
  const [q, setQ] = useState('')
  const needle = q.trim().toLowerCase()
  return (
    <DropdownMenu onOpenChange={() => setQ('')}>
      <DropdownMenuTrigger className={BAR}>
        <Icon name="box" size={14} />
        {value ? (
          <>
            <span className="text-foreground/90">{value.app}</span> <span className="text-subtle-foreground">{value.project}</span>
          </>
        ) : (
          'Start from scratch'
        )}
        <Icon name="down" size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className={cn(MENU, 'w-[300px]')}>
        {hasApps && <Search placeholder="Find a project or application" value={q} onChange={setQ} />}
        <DropdownMenuItem className={cn(ITEM, !value && 'bg-white/[0.06]')} onSelect={() => onChange(null)}>
          <MIcon name="addCircle" /> Start from scratch
        </DropdownMenuItem>
        {hasApps && (
          <>
            <Sep />
            <Label>Projects</Label>
            {PROJECTS.map((p) => {
              const apps = p.apps.filter((a) => !needle || a.toLowerCase().includes(needle) || p.name.toLowerCase().includes(needle))
              if (!apps.length) return null
              return (
                <DropdownMenuSub key={p.name}>
                  <DropdownMenuSubTrigger className={cn(ITEM, 'data-[state=open]:bg-white/[0.06]')}>
                    <MIcon name="folder" /> <span className="flex-1">{p.name}</span>
                    <span className="text-subtle-foreground">
                      {apps.length} app{apps.length > 1 ? 's' : ''}
                    </span>
                  </DropdownMenuSubTrigger>
                  <DropdownMenuSubContent sideOffset={6} className={cn(MENU, 'w-[280px]')}>
                    <Label>{p.name}</Label>
                    {apps.map((a) => (
                      <DropdownMenuItem key={a} className={cn(ITEM, value?.app === a && value.project === p.name && 'bg-white/[0.06]')} onSelect={() => onChange({ app: a, project: p.name })}>
                        <MIcon name="boxMin" /> <span className="flex-1">{a}</span>
                        {value?.app === a && value.project === p.name && <Icon name="check" size={14} />}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              )
            })}
          </>
        )}
        {hasApps && <Sep />}
        <DropdownMenuItem className={ITEM} onSelect={() => onNote('GitHub|Adding an existing application comes in a later module.')}>
          <span className="text-foreground"><GithubMark size={16} /></span> Add existing application
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const BRANCHES = ['main', 'develop', 'release/3.0', 'feature/event-filter']
export function BranchMenu({ value, onChange, onNote }: { value: string; onChange: (v: string) => void; onNote: (s: string) => void }) {
  const [q, setQ] = useState('')
  const shown = BRANCHES.filter((b) => b.includes(q.trim().toLowerCase()))
  return (
    <DropdownMenu onOpenChange={() => setQ('')}>
      <DropdownMenuTrigger className={BAR}>
        <Icon name="branch" size={14} /> <span className="text-foreground/90">{value}</span> <Icon name="down" size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className={cn(MENU, 'w-[300px]')}>
        <Search placeholder="Find a branch" value={q} onChange={setQ} />
        <Label>Branches</Label>
        {shown.map((b) => (
          <DropdownMenuItem key={b} className={cn(ITEM, value === b && 'bg-white/[0.06]')} onSelect={() => onChange(b)}>
            <MIcon name="branch" /> <span className="flex-1">{b}</span>
            {b === 'main' && <span className="text-[12px] text-subtle-foreground">Default</span>}
          </DropdownMenuItem>
        ))}
        {shown.length === 0 && <p className="px-2 py-2 text-[13px] text-muted-foreground">No branch matches.</p>}
        <Sep />
        <DropdownMenuItem className={ITEM} onSelect={() => onNote('Branches|Creating a branch comes in a later module.')}>
          <MIcon name="plus" /> Create a branch from main
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export const SIZES: [string, string][] = [
  ['Small', '1 vCPU · 2 GB'],
  ['Standard', '2 vCPU · 4 GB'],
  ['Large', '4 vCPU · 8 GB'],
]
export function SizeMenu({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const spec = SIZES.find((s) => s[0] === value)?.[1] ?? '2 vCPU · 4 GB'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className={BAR}>
        <Icon name="cpu" size={14} /> {spec} ({value}) <Icon name="down" size={12} />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" sideOffset={8} className={cn(MENU, 'w-[300px]')}>
        <Label>Sandbox size</Label>
        {SIZES.map(([n, d]) => (
          <DropdownMenuItem key={n} className={cn(ITEM, value === n && 'bg-white/[0.06]')} onSelect={() => onChange(n)}>
            <MIcon name="cpu" />
            <span className="flex-1">
              {n} <span className="ml-1 text-subtle-foreground">{d}</span>
            </span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
