/**
 * Mock backend for the onboarding prototype.
 * Every call has latency and honours the "offline" switch in the prototype panel,
 * so each failure state in the design can be reached for real.
 */
import { Account, Mail, getState, setState } from './store'

export class NetworkError extends Error {
  constructor() {
    super('network')
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function call<T>(ms: number, fn: () => T): Promise<T> {
  await sleep(ms)
  if (getState().net.offline) throw new NetworkError()
  return fn()
}

export const VALID_CODE = '670381'
export const EXPIRED_CODE = '000000'
export const CODE_TTL_MS = 10 * 60 * 1000
export const LOCK_MS = 15 * 60 * 1000
export const RESET_TTL_MS = 30 * 60 * 1000
export const MAX_CODE_TRIES = 5
export const MAX_SIGNIN_TRIES = 5

export const RESERVED_NAMES = ['admin', 'revolte', 'root', 'support', 'james', 'octo-dev']
export const RESERVED_SLUGS = ['acme', 'revolte', 'admin', 'app', 'api', 'www', 'test', 'demo']

/* ---------- validation helpers (shared with the UI) ---------- */

export const USERNAME_RE = /^[a-zA-Z0-9_-]{3,30}$/
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
export const SLUG_RE = /^(?!-)(?!.*--)[a-z0-9-]{3,30}(?<!-)$/

export type Rules = { length: boolean; number: boolean; symbol: boolean }
export function passwordRules(pw: string): Rules {
  return { length: pw.length >= 12, number: /\d/.test(pw), symbol: /[^A-Za-z0-9\s]/.test(pw) }
}
export function strength(pw: string): 0 | 1 | 2 | 3 {
  if (!pw) return 0
  const r = passwordRules(pw)
  return ((r.length ? 1 : 0) + (r.number ? 1 : 0) + (r.symbol ? 1 : 0)) as 1 | 2 | 3 | 0
}

const norm = (e: string) => e.trim().toLowerCase()
let mailId = 1

type NewMail = { kind: 'code'; to: string; code: string } | { kind: 'reset'; to: string; token: string }

function sendMail(m: NewMail) {
  const mail = { ...m, id: mailId++, at: Date.now() } as Mail
  setState((s) => ({ mailbox: [mail, ...s.mailbox].slice(0, 6) }))
  return mail
}

function findAccount(email: string): Account | undefined {
  return getState().accounts.find((a) => a.email === norm(email))
}

function saveAccount(a: Account) {
  setState((s) => ({ accounts: [...s.accounts.filter((x) => x.email !== a.email), a] }))
}

/* ---------- sign up ---------- */

export async function checkUsername(name: string) {
  return call(450, () => {
    const taken =
      RESERVED_NAMES.includes(name.toLowerCase()) ||
      getState().accounts.some((a) => a.username.toLowerCase() === name.toLowerCase())
    return {
      available: !taken,
      suggestions: taken ? [`${name}-hall`, `${name}-acme`] : [],
    }
  })
}

export type SignUpInput = { username: string; email: string; password: string }
export type SignUpResult = { ok: true } | { ok: false; error: 'email_registered' | 'username_taken' }

export async function signUp(input: SignUpInput): Promise<SignUpResult> {
  return call(1100, () => {
    if (findAccount(input.email)) return { ok: false as const, error: 'email_registered' as const }
    if (
      RESERVED_NAMES.includes(input.username.toLowerCase()) ||
      getState().accounts.some((a) => a.username.toLowerCase() === input.username.toLowerCase())
    )
      return { ok: false as const, error: 'username_taken' as const }
    sendMail({ kind: 'code', to: norm(input.email), code: VALID_CODE })
    setState({
      pending: {
        ...input,
        email: norm(input.email),
        code: VALID_CODE,
        issuedAt: Date.now(),
        wrong: 0,
        lockUntil: 0,
      },
    })
    return { ok: true as const }
  })
}

export type VerifyResult =
  | { ok: true }
  | { ok: false; error: 'wrong'; triesLeft: number }
  | { ok: false; error: 'expired' }
  | { ok: false; error: 'locked'; until: number }

export async function verifyCode(code: string): Promise<VerifyResult> {
  return call(900, () => {
    const p = getState().pending
    if (!p) return { ok: false as const, error: 'expired' as const }
    if (p.lockUntil > Date.now()) return { ok: false as const, error: 'locked' as const, until: p.lockUntil }
    // "000000" simulates a code that sat for more than 10 minutes
    const expired = code === EXPIRED_CODE || Date.now() - p.issuedAt > CODE_TTL_MS
    if (expired) {
      issueNewCode()
      return { ok: false as const, error: 'expired' as const }
    }
    if (code !== p.code) {
      const wrong = p.wrong + 1
      if (wrong >= MAX_CODE_TRIES) {
        const until = Date.now() + LOCK_MS
        setState({ pending: { ...p, wrong, lockUntil: until } })
        return { ok: false as const, error: 'locked' as const, until }
      }
      setState({ pending: { ...p, wrong } })
      return { ok: false as const, error: 'wrong' as const, triesLeft: MAX_CODE_TRIES - wrong }
    }
    // verified: the account now exists
    saveAccount({
      email: p.email,
      username: p.username,
      password: p.password,
      provider: 'email',
      prevPasswords: [p.password],
    })
    setState({ pending: null, session: { email: p.email } })
    return { ok: true as const }
  })
}

function issueNewCode() {
  const p = getState().pending
  if (!p) return
  setState({ pending: { ...p, code: VALID_CODE, issuedAt: Date.now(), wrong: 0, lockUntil: 0 } })
  sendMail({ kind: 'code', to: p.email, code: VALID_CODE })
}

export async function resendCode() {
  return call(700, () => {
    const p = getState().pending
    if (p && p.lockUntil > Date.now()) {
      // resending is allowed during a pause and clears it, as the design says
      setState({ pending: { ...p, lockUntil: 0, wrong: 0 } })
    }
    issueNewCode()
  })
}

export async function oauth(provider: 'github' | 'google') {
  return call(1000, () => {
    const email = provider === 'github' ? 'github@acmecorp.com' : 'james.hall@gmail.com'
    let acct = findAccount(email)
    if (!acct) {
      acct = { email, username: 'james-hall', provider, prevPasswords: [] }
      saveAccount(acct)
    }
    setState({ session: { email } })
    return { hasWorkspace: !!acct.workspace }
  })
}

/* ---------- sign in ---------- */

export type SignInResult =
  | { ok: true; hasWorkspace: boolean }
  | { ok: false; error: 'no_account' }
  | { ok: false; error: 'github_only' }
  | { ok: false; error: 'wrong_password'; triesLeft: number }
  | { ok: false; error: 'locked'; until: number }

export async function signIn(email: string, password: string): Promise<SignInResult> {
  return call(1000, () => {
    const key = norm(email)
    const acct = findAccount(key)
    if (!acct) return { ok: false as const, error: 'no_account' as const }
    const f = getState().signinFails[key] ?? { count: 0, lockUntil: 0 }
    if (f.lockUntil > Date.now()) return { ok: false as const, error: 'locked' as const, until: f.lockUntil }
    if (!acct.password) return { ok: false as const, error: 'github_only' as const }
    if (acct.password !== password) {
      const count = f.count + 1
      if (count >= MAX_SIGNIN_TRIES) {
        const until = Date.now() + LOCK_MS
        setState((s) => ({ signinFails: { ...s.signinFails, [key]: { count, lockUntil: until } } }))
        return { ok: false as const, error: 'locked' as const, until }
      }
      setState((s) => ({ signinFails: { ...s.signinFails, [key]: { count, lockUntil: 0 } } }))
      return { ok: false as const, error: 'wrong_password' as const, triesLeft: MAX_SIGNIN_TRIES - count }
    }
    setState((s) => ({
      signinFails: { ...s.signinFails, [key]: { count: 0, lockUntil: 0 } },
      session: { email: key },
    }))
    return { ok: true as const, hasWorkspace: !!acct.workspace }
  })
}

export function lockedUntil(email: string) {
  return getState().signinFails[norm(email)]?.lockUntil ?? 0
}

/* ---------- password reset ---------- */

export async function requestReset(email: string) {
  return call(1000, () => {
    const key = norm(email)
    // Same answer whether or not the account exists, so emails cannot be probed.
    if (findAccount(key)) {
      const token = Math.random().toString(36).slice(2, 10)
      sendMail({ kind: 'reset', to: key, token })
    }
  })
}

export function resetTokenState(token: string | null): 'valid' | 'expired' {
  if (!token) return 'expired'
  const m = getState().mailbox.find((x) => x.kind === 'reset' && x.token === token)
  if (!m) return 'expired'
  return Date.now() - m.at > RESET_TTL_MS ? 'expired' : 'valid'
}

export async function resetPassword(email: string, token: string, password: string) {
  return call(1000, () => {
    if (resetTokenState(token) === 'expired') return { ok: false as const, error: 'expired' as const }
    const acct = findAccount(email)
    if (!acct) return { ok: false as const, error: 'expired' as const }
    if (acct.prevPasswords.includes(password)) return { ok: false as const, error: 'reused' as const }
    saveAccount({ ...acct, password, prevPasswords: [...acct.prevPasswords, password] })
    // one-time link: spend it
    setState((s) => ({
      mailbox: s.mailbox.filter((m) => !(m.kind === 'reset' && m.token === token)),
      signinFails: { ...s.signinFails, [email]: { count: 0, lockUntil: 0 } },
    }))
    return { ok: true as const }
  })
}

/* ---------- workspace ---------- */

export type SlugCheck = { status: 'available' } | { status: 'taken'; suggestions: string[] }

export async function checkSlug(slug: string): Promise<SlugCheck> {
  return call(650, () => {
    const taken =
      RESERVED_SLUGS.includes(slug) ||
      getState().accounts.some((a) => a.workspace?.slug === slug)
    return taken
      ? { status: 'taken' as const, suggestions: [`${slug}-corp`, `${slug}-hq`] }
      : { status: 'available' as const }
  })
}

export async function createWorkspace(input: { name: string; slug: string; invites: string[] }) {
  await sleep(1300)
  if (getState().net.offline) throw new NetworkError()
  if (getState().net.failWorkspace) throw new Error('server')
  const email = getState().session?.email
  const acct = email ? findAccount(email) : undefined
  if (acct) saveAccount({ ...acct, workspace: input })
  return input
}

export async function connectGithub() {
  await sleep(1200)
  if (getState().net.offline || getState().net.failGithub) throw new Error('github')
}
