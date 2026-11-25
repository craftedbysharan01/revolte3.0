import { useSyncExternalStore } from 'react'
import { freshDep } from './deploy/model'

export type Route =
  | 'website'
  | 'signup'
  | 'signup-email'
  | 'verify'
  | 'signin'
  | 'signin-email'
  | 'forgot'
  | 'reset'
  | 'workspace'
  | 'app'
  | 'chat'

import type { Chat } from './chat/types'
import type { Dep } from './deploy/model'

export type Mail =
  | { id: number; kind: 'code'; to: string; code: string; at: number }
  | { id: number; kind: 'reset'; to: string; token: string; at: number }

export type Account = {
  email: string
  username: string
  password?: string
  provider: 'email' | 'github' | 'google'
  prevPasswords: string[]
  workspace?: { name: string; slug: string; invites: string[] }
}

export type GetStartedStep = 'github' | 'app' | 'jira' | 'workflow'
export type StepStatus = 'todo' | 'done' | 'skipped'
export type GetStarted = {
  status: Record<GetStartedStep, StepStatus>
  /** card open (floating) vs. closed (sidebar row with ring) */
  open: boolean
  /** user closed the final "all set" card, so the entry leaves the sidebar */
  dismissed: boolean
}

export type PendingSignup = {
  username: string
  email: string
  password: string
  code: string
  issuedAt: number
  wrong: number
  lockUntil: number
}

export type Prototype = {
  route: Route
  /** Figma state id to hydrate (set by the prototype panel); consumed by the screen on mount */
  preset: string | null
  /** bump to force a remount when jumping to the same route */
  nonce: number
  savedPrompt: string
  /** toast "Your request is saved" shown on the sign up screen */
  promptToast: boolean
  session: { email: string } | null
  pending: PendingSignup | null
  /** email carried between auth screens (sign in / forgot / reset) */
  carryEmail: string
  resetToken: string | null
  mailbox: Mail[]
  accounts: Account[]
  getStarted: GetStarted
  chats: Chat[]
  activeChat: string | null
  credits: number
  net: { offline: boolean; failWorkspace: boolean; failGithub: boolean; failTests: boolean; failSandbox: boolean; noCredits: boolean; noHours: boolean }
  /** sign-in lockouts by email */
  signinFails: Record<string, { count: number; lockUntil: number }>
  panelOpen: boolean
  appDialog: boolean
  dep: Dep
  /** H05-H08: the workflow template picker */
  wfPicker: boolean
  /** chat to open GitHub for, then continue into deploy (C25) */
  ghFor: 'deploy' | null
}

const KEY = 'revolte.proto.v1'

const ROUTES: Route[] = [
  'website',
  'signup',
  'signup-email',
  'verify',
  'signin',
  'signin-email',
  'forgot',
  'reset',
  'workspace',
  'app',
  'chat',
]

export const START_CREDITS = 100

export const seedAccounts = (): Account[] => [
  {
    email: 'james@acmecorp.com',
    username: 'james',
    password: 'Revolte@2024x',
    provider: 'email',
    prevPasswords: ['Revolte@2024x'],
    workspace: { name: 'Acme Corp', slug: 'acme', invites: [] },
  },
  {
    email: 'github@acmecorp.com',
    username: 'octo-dev',
    provider: 'github',
    prevPasswords: [],
    workspace: { name: 'Octo Dev', slug: 'octo-dev', invites: [] },
  },
]

export const freshGetStarted = (): GetStarted => ({
  status: { github: 'todo', app: 'todo', jira: 'todo', workflow: 'todo' },
  open: true,
  dismissed: false,
})

const initial = (): Prototype => ({
  route: 'website',
  preset: null,
  nonce: 0,
  savedPrompt: '',
  promptToast: false,
  session: null,
  pending: null,
  carryEmail: '',
  resetToken: null,
  mailbox: [],
  accounts: seedAccounts(),
  getStarted: freshGetStarted(),
  chats: [],
  activeChat: null,
  credits: START_CREDITS,
  net: { offline: false, failWorkspace: false, failGithub: false, failTests: false, failSandbox: false, noCredits: false, noHours: false },
  signinFails: {},
  panelOpen: false,
  appDialog: false,
  dep: freshDep(),
  wfPicker: false,
  ghFor: null,
})

const PERSIST: (keyof Prototype)[] = [
  'accounts',
  'session',
  'getStarted',
  'chats',
  'activeChat',
  'credits',
  'mailbox',
  'pending',
  'savedPrompt',
]

function load(): Prototype {
  const base = initial()
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) Object.assign(base, JSON.parse(raw))
  } catch {
    /* storage unavailable: run in memory */
  }
  const fromHash = routeFromHash()
  if (fromHash) base.route = fromHash
  return base
}

let state: Prototype = load()
const listeners = new Set<() => void>()

export function getState() {
  return state
}

export function setState(patch: Partial<Prototype> | ((s: Prototype) => Partial<Prototype>)) {
  const p = typeof patch === 'function' ? patch(state) : patch
  state = { ...state, ...p }
  try {
    const out: Record<string, unknown> = {}
    PERSIST.forEach((k) => (out[k] = state[k]))
    localStorage.setItem(KEY, JSON.stringify(out))
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l())
}

export function useStore<T>(sel: (s: Prototype) => T): T {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb)
      return () => listeners.delete(cb)
    },
    () => sel(state),
  )
}

/* ---------- routing (hash based so back/forward work) ---------- */

function routeFromHash(): Route | null {
  const h = location.hash.replace(/^#\/?/, '')
  return (ROUTES as string[]).includes(h) ? (h as Route) : null
}

export function go(route: Route, opts: { preset?: string | null; patch?: Partial<Prototype> } = {}) {
  const next = `#/${route === 'website' ? '' : route}`
  if (location.hash !== next) history.pushState(null, '', next)
  setState((s) => ({
    ...opts.patch,
    route,
    preset: opts.preset ?? null,
    nonce: s.nonce + 1,
  }))
  window.scrollTo(0, 0)
}

window.addEventListener('popstate', () => {
  const r = routeFromHash() ?? 'website'
  if (r !== state.route) setState((s) => ({ route: r, preset: null, nonce: s.nonce + 1 }))
})

export function resetPrototype() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
  const fresh = initial()
  fresh.panelOpen = state.panelOpen
  state = fresh
  history.replaceState(null, '', '#/')
  listeners.forEach((l) => l())
}
