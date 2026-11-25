/**
 * Mock agent for the chat prototype. It plays the session the Figma file describes:
 *   Grill (questions) -> Plan (approve) -> Tasks/Build -> Verify (auto-retry) -> Sandbox ready -> PR.
 * Timers are cancellable (Stop), and the Prototype panel can force the failure states.
 */
import { DEFAULT_PROMPT } from '../screens/Website'
import { BG_SEED, BgTask, Chat, DEMO_BRANCH, DEMO_REPO, FINISHED_SEED, LogItem, Phase, QUESTIONS, TASKS } from './types'
import { getState, setState } from '../store'

export const RUN_CREDITS = 8
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
let seq = Date.now()
const nid = () => ++seq

/* ---------- state helpers ---------- */

export const getChat = (id: string) => getState().chats.find((c) => c.id === id)

export function upd(id: string, fn: (c: Chat) => Partial<Chat>) {
  setState((s) => ({ chats: s.chats.map((c) => (c.id === id ? { ...c, ...fn(c) } : c)) }))
}
const item = (icon: LogItem['icon'], text: string, state: LogItem['state'], extra: Partial<LogItem> = {}): LogItem => ({
  id: nid(),
  icon,
  text,
  state,
  ...extra,
})
const addLog = (id: string, it: LogItem) => upd(id, (c) => ({ log: [...c.log, it] }))
const doneLast = (id: string, meta?: string, diff?: [number, number]) =>
  upd(id, (c) => ({ log: c.log.map((l, i) => (i === c.log.length - 1 ? { ...l, state: 'done' as const, meta: meta ?? l.meta, diff: diff ?? l.diff } : l)) }))
const secsSince = (c: Chat) => Math.max(1, Math.round((Date.now() - c.segStart) / 1000))

export function titleFrom(prompt: string) {
  if (prompt.trim() === DEFAULT_PROMPT.trim() || /webhook/i.test(prompt)) return 'Webhook delivery dashboard'
  const words = prompt.trim().replace(/\s+/g, ' ').split(' ').slice(0, 6).join(' ')
  return words.charAt(0).toUpperCase() + words.slice(1)
}

/* ---------- cancellation ---------- */

type Token = { cancelled: boolean }
const tokens = new Map<string, Token>()
class Cancelled extends Error {}
class Lost extends Error {}

function fresh(id: string): Token {
  const prev = tokens.get(id)
  if (prev) prev.cancelled = true
  const t = { cancelled: false }
  tokens.set(id, t)
  return t
}
async function wait(tok: Token, ms: number) {
  await sleep(ms)
  if (tok.cancelled) throw new Cancelled()
  if (getState().net.offline) throw new Lost()
}
/** Run a script; a lost connection parks the run so Reconnect can resume it. */
async function run(id: string, from: Phase, body: (tok: Token) => Promise<void>) {
  const tok = fresh(id)
  try {
    await body(tok)
  } catch (e) {
    if (e instanceof Lost) {
      const c = getChat(id)!
      upd(id, () => ({ phase: 'lost', resumeFrom: from, segSecs: secsSince(c), tasks: c.tasks.map((t) => (t === 'running' ? 'queued' : t)) }))
    } else if (!(e instanceof Cancelled)) throw e
  }
}

/* ---------- create ---------- */

export function blankChat(prompt: string, id = 'c' + nid()): Chat {
  const gh = getState().getStarted.status.github === 'done'
  return {
    id,
    title: titleFrom(prompt),
    prompt,
    createdAt: Date.now(),
    phase: 'thinking',
    segStart: Date.now(),
    segSecs: 0,
    log: [item('search', 'Reading your request', 'running')],
    worked: null,
    qi: 0,
    answers: [],
    skipped: false,
    planRev: 0,
    feedback: [],
    planApproved: false,
    tasks: TASKS.map(() => 'queued'),
    verify: { lint: 'queued', tests: 'queued', prettier: 'queued', attempt: 1, passed: 0 },
    sandbox: 'starting',
    github: { connected: false, repo: DEMO_REPO, branch: DEMO_BRANCH, pushed: false, commit: '', pr: null },
    queued: null,
    followUps: [],
    tab: 'overview',
    workflowDismissed: false,
    resumeFrom: null,
    editMode: 'auto',
    review: [],
    reviewed: false,
    bg: [],
    bgOpen: false,
    app: null,
    model: 'Claude Sonnet 5.5',
    modelNote: null,
    marks: [],
    ...(gh ? {} : {}),
  }
}

export function createChat(prompt: string, opts: { editMode?: Chat['editMode']; model?: string } = {}): string {
  const c = { ...blankChat(prompt.trim()), ...(opts.editMode ? { editMode: opts.editMode } : {}), ...(opts.model ? { model: opts.model } : {}) }
  setState((s) => ({ chats: [c, ...s.chats], activeChat: c.id, savedPrompt: '' }))
  void thinking(c.id)
  return c.id
}

/* ---------- Grill ---------- */

async function thinking(id: string) {
  await run(id, 'thinking', async (tok) => {
    upd(id, () => ({ phase: 'thinking', segStart: Date.now(), sandbox: 'starting', log: [item('search', 'Reading your request', 'running')] }))
    await wait(tok, 1500)
    upd(id, () => ({
      log: [item('search', 'Looked for a repository: none connected, using a fresh sandbox', 'done', { meta: '1s' }), item('terminal', 'Started the sandbox: Node 20, Postgres, 2 vCPU, 4 GB', 'running')],
    }))
    await wait(tok, 1400)
    if (getState().net.failSandbox) {
      const c = getChat(id)!
      upd(id, () => ({ phase: 'sandbox-failed', sandbox: 'failed', segSecs: secsSince(c), log: [] }))
      return
    }
    upd(id, () => ({
      sandbox: 'ready',
      log: [
        item('search', 'Looked for a repository: none connected, using a fresh sandbox', 'done', { meta: '1s' }),
        item('terminal', 'Started the sandbox: Node 20, Postgres, 2 vCPU, 4 GB', 'done', { meta: '3s' }),
        item('think', 'Working out what to ask before planning', 'running'),
      ],
    }))
    await wait(tok, 1600)
    const c = getChat(id)!
    upd(id, () => ({ phase: 'asking', qi: 0, log: [], worked: { secs: Math.max(8, secsSince(c)), steps: 5 } }))
  })
}

export const retrySandbox = (id: string) => void thinking(id)

export function setQuestion(id: string, qi: number) {
  const c = getChat(id)!
  if (qi >= 0 && qi <= c.answers.length && qi < QUESTIONS.length) upd(id, () => ({ qi }))
}

export function answer(id: string, value: string) {
  const c = getChat(id)!
  const answers = [...c.answers]
  answers[c.qi] = value
  if (c.qi < QUESTIONS.length - 1) upd(id, () => ({ answers, qi: c.qi + 1 }))
  else {
    upd(id, () => ({ answers }))
    void planning(id)
  }
}

export function skipQuestions(id: string) {
  upd(id, () => ({ answers: QUESTIONS.map((q) => q.options[0]), skipped: true }))
  void planning(id)
}

async function planning(id: string) {
  await run(id, 'planning', async (tok) => {
    const c0 = getChat(id)!
    upd(id, () => ({ phase: 'planning', segStart: Date.now(), log: [item('think', c0.skipped ? 'Drafting the plan from the recommended answers' : 'Drafting the plan', 'running')] }))
    await wait(tok, 3200)
    const c = getChat(id)!
    upd(id, () => ({ phase: 'plan', log: [], worked: { secs: (c.worked?.secs ?? 8) + secsSince(c) + 8, steps: 6 } }))
  })
}

/* ---------- Plan ---------- */

export function approvePlan(id: string) {
  upd(id, () => ({ planApproved: true }))
  void develop(id, 0)
}

export function requestChanges(id: string, text: string) {
  upd(id, (c) => ({ feedback: [...c.feedback, text] }))
  void (async () => {
    await run(id, 'revising', async (tok) => {
      upd(id, () => ({ phase: 'revising', segStart: Date.now(), log: [item('think', 'Applying your feedback to the plan', 'running')] }))
      await wait(tok, 3000)
      upd(id, (c) => ({ phase: 'plan', planRev: c.planRev + 1, log: [] }))
    })
  })()
}

/* ---------- Build ---------- */

const TASK_WORK: { text: string; diff?: [number, number]; running: string }[] = [
  { text: 'Edited src/db/seed.ts', diff: [120, 0], running: 'Writing src/db/seed.ts' },
  { text: 'Edited src/app/deliveries/page.tsx', diff: [48, 0], running: 'Writing src/app/deliveries/page.tsx' },
  { text: 'Edited src/jobs/retry.ts', diff: [86, 4], running: 'Writing src/jobs/retry.ts' },
  { text: 'Edited src/jobs/alerts.ts', diff: [54, 0], running: 'Writing src/jobs/alerts.ts' },
  { text: 'Wrote src/jobs/retry.scheduler.test.ts', diff: [92, 0], running: 'Writing tests' },
]

async function develop(id: string, from: number) {
  await run(id, 'developing', async (tok) => {
    const c0 = getChat(id)!
    const keep = from > 0 ? c0.segStart : Date.now()
    upd(id, () => ({ phase: 'developing', segStart: keep, resumeFrom: null }))
    if (from === 0 && getState().credits >= RUN_CREDITS) setState((s) => ({ credits: s.credits - RUN_CREDITS }))
    for (let i = from; i < TASKS.length; i++) {
      if (i === 2 && getState().net.noCredits) {
        const c = getChat(id)!
        upd(id, () => ({ phase: 'credits', segSecs: secsSince(c), resumeFrom: 'developing', tasks: c.tasks.map((t) => (t === 'running' ? 'queued' : t)) }))
        return
      }
      if (i === 2 && getState().net.noHours) {
        const c = getChat(id)!
        upd(id, () => ({ phase: 'hours', segSecs: secsSince(c), resumeFrom: 'developing', tasks: c.tasks.map((t) => (t === 'running' ? 'queued' : t)) }))
        return
      }
      upd(id, (c) => ({ tasks: c.tasks.map((t, k) => (k === i ? 'running' : t)) }))
      addLog(id, item('edit', TASK_WORK[i].running, 'running', { detail: 'edit' }))
      if (i === 2 && getChat(id)!.editMode === 'manual' && !getChat(id)!.reviewed) await askBeforeEdit(id, tok)
      await wait(tok, 1700)
      upd(id, (c) => ({
        log: c.log.map((l, k) => (k === c.log.length - 1 ? { ...l, text: TASK_WORK[i].text, diff: TASK_WORK[i].diff, state: 'done' as const } : l)),
        tasks: c.tasks.map((t, k) => (k === i ? 'done' : t)),
      }))
      if (i === 0) startBg(id, 'npm run dev')
      if (i === 1) {
        startBg(id, 'npm run test:watch')
        addLog(id, item('terminal', 'Started in the background: npm run test:watch', 'done'))
      }
      await wait(tok, 350)
    }
    await verify(id, 1, tok)
  })
}

async function verify(id: string, startAttempt: number, tok: Token, forcePass = false) {
  const failTimes = forcePass ? 0 : getState().net.failTests ? 3 : 1
  const c0 = getChat(id)!
  upd(id, () => ({ phase: 'verifying', segStart: Date.now(), log: [], worked: { secs: (c0.worked?.secs ?? 20) + secsSince(c0), steps: 14 } }))
  for (let attempt = startAttempt; ; attempt++) {
    upd(id, (c) => ({ verify: { ...c.verify, attempt, lint: 'running', tests: 'queued', prettier: 'queued', passed: 0 }, log: [] }))
    await wait(tok, 800)
    addLog(id, item('lint', 'Ran lint', 'done', { meta: '0 issues' }))
    upd(id, (c) => ({ verify: { ...c.verify, lint: 'done', tests: 'running', passed: 23 } }))
    addLog(id, item('test', 'Running tests', 'running'))
    await wait(tok, 1500)
    if (attempt <= failTimes) {
      upd(id, (c) => ({
        verify: { ...c.verify, tests: 'failed', passed: 23 },
        log: c.log.map((l) => (l.state === 'running' ? { ...l, icon: 'error' as const, text: 'retry.scheduler.test.ts failed', meta: '23 of 24', state: 'failed' as const, detail: 'test' as const } : l)),
      }))
      if (attempt >= 3) {
        const c = getChat(id)!
        upd(id, () => ({ phase: 'failed', segSecs: secsSince(c) }))
        return
      }
      addLog(id, item('sparkle', 'The first retry waits 2 seconds, the test expects 1', 'done', { detail: 'think' }))
      addLog(id, item('edit', 'Fixing src/jobs/retry.ts', 'running'))
      await wait(tok, 2200)
      continue
    }
    upd(id, (c) => ({
      verify: { ...c.verify, tests: 'done', passed: 24, prettier: 'running' },
      log: [item('test', 'Ran 24 tests', 'done', { meta: '24 passed' }), item('lint', 'Ran lint', 'done', { meta: '0 issues' }), item('terminal', 'Running Prettier', 'running')],
    }))
    await wait(tok, 1300)
    finish(id)
    return
  }
}

/** The user picked how to continue after three failed attempts (C13). */
export function continueAfterFailure(id: string) {
  void run(id, 'verifying', async (tok) => {
    upd(id, (c) => ({ phase: 'verifying', segStart: Date.now(), verify: { ...c.verify, attempt: 4 } }))
    await verify(id, 4, tok, true)
  })
}

function finish(id: string) {
  const c = getChat(id)!
  upd(id, (x) => ({ bg: (x.bg ?? []).map((b) => ({ ...b, state: 'finished' as const })), bgOpen: false }))
  const gh = getState().getStarted.status.github === 'done'
  upd(id, (x) => ({
    phase: 'done',
    log: [],
    tasks: x.tasks.map(() => 'done' as const),
    verify: { ...x.verify, lint: 'done', tests: 'done', prettier: 'done', passed: 24 },
    sandbox: 'ready',
    tab: 'sandbox',
    worked: { secs: (x.worked?.secs ?? 20) + secsSince(c), steps: 24 },
    github: { ...x.github, connected: x.github.connected || gh },
    followUps: x.queued ? [...x.followUps, x.queued] : x.followUps,
    queued: null,
  }))
}

/* ---------- Stop / resume / reconnect ---------- */

export function stopRun(id: string) {
  const tok = tokens.get(id)
  if (tok) tok.cancelled = true
  releaseReview(id)
  const c = getChat(id)!
  upd(id, () => ({
    review: [],
    phase: 'stopped',
    resumeFrom: c.phase,
    segSecs: secsSince(c),
    tasks: c.tasks.map((t) => (t === 'running' ? 'queued' : t)),
    log: c.log.filter((l) => l.state !== 'running'),
  }))
}

export function resume(id: string) {
  const c = getChat(id)!
  const from = c.resumeFrom ?? 'developing'
  if (from === 'verifying') void run(id, 'verifying', (tok) => verify(id, c.verify.attempt, tok))
  else if (from === 'thinking') void thinking(id)
  else if (from === 'planning') void planning(id)
  else void develop(id, Math.max(0, c.tasks.findIndex((t) => t !== 'done')))
}

/** Upgrading in the prototype just lifts the credit pause and carries on. */
export function upgradeAndResume(id: string) {
  setState((s) => ({ net: { ...s.net, noCredits: false, noHours: false }, credits: Math.max(s.credits, 100) }))
  const ph = getChat(id)?.phase
  if (ph === 'credits' || ph === 'hours') resume(id)
}

export const reconnect = (id: string) => {
  if (getState().net.offline) setState((s) => ({ net: { ...s.net, offline: false } }))
  resume(id)
}

/* ---------- messages ---------- */

export function sendFollowUp(id: string, text: string) {
  upd(id, (c) => ({ followUps: [...c.followUps, text.trim()], ...takeMark(c), modelNote: null }))
}
/** MS02: the first message after a model switch marks where the model changed. */
const takeMark = (c: Chat): Partial<Chat> => (c.modelNote ? { marks: [...(c.marks ?? []), { index: c.followUps.length, model: c.model ?? 'Claude Sonnet 5.5', at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) }] } : {})
export function queueMessage(id: string, text: string) {
  upd(id, () => ({ queued: text.trim() }))
}
export function clearQueued(id: string) {
  upd(id, () => ({ queued: null }))
}
export function sendQueuedNow(id: string) {
  const c = getChat(id)!
  if (c.queued) upd(id, () => ({ followUps: [...c.followUps, c.queued!], queued: null }))
}

/* ---------- GitHub / PR / sandbox ---------- */

export function githubConnected(id: string) {
  setState((s) => ({ getStarted: { ...s.getStarted, status: { ...s.getStarted.status, github: 'done' } } }))
  upd(id, (c) => ({ github: { ...c.github, connected: true }, title: c.title }))
}
export function commitAndPush(id: string) {
  upd(id, (c) => ({ github: { ...c.github, pushed: true, commit: '3f9c2a1' } }))
}
export function createPr(id: string) {
  upd(id, (c) => ({ github: { ...c.github, pr: 12 } }))
}
export const setTab = (id: string, tab: Chat['tab']) => upd(id, () => ({ tab }))
export const dismissWorkflow = (id: string) => upd(id, () => ({ workflowDismissed: true }))

/* ---------- recover after a reload: timers do not survive ---------- */

const MID: Phase[] = ['thinking', 'planning', 'revising', 'developing', 'verifying']
for (const c of getState().chats) {
  if (MID.includes(c.phase)) upd(c.id, () => ({ phase: 'stopped', resumeFrom: c.phase, segSecs: 12, tasks: c.tasks.map((t) => (t === 'running' ? 'queued' : t)), log: c.log.filter((l) => l.state !== 'running') }))
}

/* ---------- EC01-EC04 Manual mode: wait for you before each edit ---------- */

const gates = new Map<string, () => void>()
const releaseReview = (id: string) => {
  gates.get(id)?.()
  gates.delete(id)
}
async function askBeforeEdit(id: string, tok: Token) {
  upd(id, () => ({
    reviewed: true,
    review: [
      { kind: 'Edit', file: 'src/jobs/retry.ts', add: 18, del: 4 },
      { kind: 'Create', file: 'src/jobs/alert.ts', add: 42, del: 0 },
      { kind: 'Edit', file: 'src/app/deliveries/page.tsx', add: 6, del: 2 },
    ],
  }))
  upd(id, (c) => ({ log: [...c.log.filter((l) => l.state !== 'running'), item('edit', WAITING, 'running')] }))
  await new Promise<void>((r) => gates.set(id, r))
  if (tok.cancelled) throw new Cancelled()
}
const WAITING = 'Waiting for you to allow an edit'
function settle(id: string, allow: boolean) {
  const c = getChat(id)
  const r = c?.review?.[0]
  if (!c || !r) return
  const rest = c.review!.slice(1)
  const result = item(allow ? 'edit' : 'error', `${allow ? (r.kind === 'Create' ? 'Created' : 'Edited') : 'Skipped'} ${r.file}${allow ? '' : ': you denied it, Revolte carries on without it'}`, allow ? 'done' : 'failed', allow ? { diff: [r.add, r.del] } : {})
  upd(id, (x) => ({ review: rest, log: [...x.log.filter((l) => l.text !== WAITING), result, rest.length ? item('edit', WAITING, 'running') : item('edit', TASK_WORK[2].running, 'running', { detail: 'edit' })] }))
  if (!rest.length) releaseReview(id)
}
export const allowEdit = (id: string) => settle(id, true)
export const denyEdit = (id: string) => settle(id, false)

export function setEditMode(id: string, mode: 'manual' | 'auto' | 'project') {
  upd(id, () => ({ editMode: mode }))
  if (mode !== 'manual') while (getChat(id)?.review?.length) settle(id, true)
}

/* ---------- EC05-EC08 background tasks ---------- */

function startBg(id: string, cmd: string) {
  const mk = (cmd: string, state: BgTask['state'], ago: number): BgTask => ({ id: 'b' + nid(), cmd, state, startedAt: Date.now() - ago * 1000, out: BG_SEED[cmd] ?? [`$ ${cmd}`, 'Done.'] })
  upd(id, (c) => ({ bg: [...(c.bg ?? []), ...(cmd === 'npm run dev' ? FINISHED_SEED.map((f, i) => mk(f, 'finished', 120 - i * 30)) : []), mk(cmd, 'running', 0)] }))
}
export const setBgOpen = (id: string, open: boolean) => upd(id, () => ({ bgOpen: open }))

/* ---------- EC12-EC16 application, MS01 model ---------- */

export const chooseApplication = (id: string, app: string) => upd(id, () => ({ app }))
export function setModel(id: string, model: string) {
  upd(id, (c) => (c.model === model ? {} : { model, modelNote: `Switched to ${model}. It applies to your next message.` }))
}
