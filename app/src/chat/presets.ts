/** Figma states for section 09 (Chat) and 10 (Sandbox, code, files): each builds a frozen snapshot on click. */
import { DEFAULT_PROMPT } from '../screens/Website'
import { blankChat } from './engine'
import { BG_SEED, FINISHED_SEED, type Chat, type LogItem } from './types'

let n = 0
const li = (icon: LogItem['icon'], text: string, state: LogItem['state'], extra: Partial<LogItem> = {}): LogItem => ({ id: ++n, icon, text, state, ...extra })
const ANS = ['Seeded sample data', '8 attempts over 6 hours', 'Email on-call']
const FEEDBACK = 'Use SQS instead of Redis for the retry queue. We already run it in production.'
const done5 = ['done', 'done', 'done', 'done', 'done'] as Chat['tasks']

const mk = (patch: (c: Chat) => Partial<Chat>, ago = 0): Chat => {
  const c = blankChat(DEFAULT_PROMPT, 'demo')
  const p = patch(c)
  return { ...c, segStart: Date.now() - ago * 1000, sandbox: 'ready', log: [], ...p }
}
const approved: Partial<Chat> = { answers: ANS, planApproved: true, worked: { secs: 20, steps: 6 } }
const finished = (extra: Partial<Chat> = {}): Partial<Chat> => ({
  ...approved,
  phase: 'done',
  tasks: done5,
  verify: { lint: 'done', tests: 'done', prettier: 'done', attempt: 2, passed: 24 },
  worked: { secs: 320, steps: 24 },
  ...extra,
})
const gh = (extra: Partial<Chat['github']>) => (c: Chat) => ({ github: { ...c.github, connected: true, ...extra } })

export type PresetDef = { id: string; label: string; build: () => Chat; net?: { noCredits?: boolean; noHours?: boolean }; route?: 'app'; extra?: Record<string, unknown> }

const RV = [
  { kind: 'Edit', file: 'src/jobs/retry.ts', add: 18, del: 4 },
  { kind: 'Create', file: 'src/jobs/alert.ts', add: 42, del: 0 },
  { kind: 'Edit', file: 'src/app/deliveries/page.tsx', add: 6, del: 2 },
] as const
const building = (extra: Partial<Chat> = {}): Partial<Chat> => ({
  ...approved,
  phase: 'developing',
  tasks: ['done', 'done', 'running', 'queued', 'queued'],
  ...extra,
})
const seedLog = [li('edit', 'Edited src/db/seed.ts', 'done', { diff: [120, 0], detail: 'edit' }), li('edit', 'Edited src/app/deliveries/page.tsx', 'done', { diff: [48, 0], detail: 'edit' })]
const bgT = (cmd: string, state: 'running' | 'finished', secs: number, out: string[]) => ({ id: 'b' + cmd, cmd, state, startedAt: Date.now() - secs * 1000, out })
const DEV = bgT('npm run dev', 'running', 134, BG_SEED['npm run dev'])
const WATCH = bgT('npm run test:watch', 'running', 48, BG_SEED['npm run test:watch'])
const FIN = FINISHED_SEED.map((c, i) => bgT(c, 'finished', 120 - i * 30, [`$ ${c}`, 'Done.']))

export const CHAT_PRESETS: PresetDef[] = [
  { id: 'C01', label: 'Lands in chat: website prompt carried over', build: () => mk(() => ({ phase: 'thinking', sandbox: 'starting', log: [li('search', 'Reading your request', 'running')] }), 3) },
  {
    id: 'C02',
    label: 'Thinking expanded',
    build: () => mk(() => ({ phase: 'thinking', log: [li('search', 'Looked for a repository: none connected, using a fresh sandbox', 'done', { meta: '1s' }), li('terminal', 'Started the sandbox: Node 20, Postgres, 2 vCPU, 4 GB', 'done', { meta: '3s' }), li('think', 'Working out what to ask before planning', 'running')] }), 6),
  },
  { id: 'C03', label: 'Clarifying question 1 of 3', build: () => mk(() => ({ phase: 'asking', qi: 0, worked: { secs: 8, steps: 5 } })) },
  { id: 'C04', label: 'Clarifying question 2 of 3', build: () => mk(() => ({ phase: 'asking', qi: 1, answers: [ANS[0]], worked: { secs: 8, steps: 5 } })) },
  { id: 'C05', label: 'Clarifying question 3 of 3', build: () => mk(() => ({ phase: 'asking', qi: 2, answers: [ANS[0], ANS[1]], worked: { secs: 8, steps: 5 } })) },
  { id: 'C06', label: 'Own answer typed', build: () => mk(() => ({ phase: 'asking', qi: 0, answers: ['Our staging service at hooks.acme.dev'], worked: { secs: 8, steps: 5 } })) },
  { id: 'C07', label: 'Questions skipped: recommended answers used', build: () => mk(() => ({ phase: 'planning', answers: ANS, skipped: true, log: [li('think', 'Drafting the plan from the recommended answers', 'running')] }), 12) },
  { id: 'C08', label: 'Plan ready: approve or change', build: () => mk(() => ({ phase: 'plan', answers: ANS, worked: { secs: 20, steps: 6 } })) },
  { id: 'C09', label: 'Plan changes requested', build: () => mk(() => ({ phase: 'revising', answers: ANS, feedback: [FEEDBACK], log: [li('think', 'Moving the retry queue to Amazon SQS', 'running')] }), 4) },
  { id: 'C10', label: 'Plan revised', build: () => mk(() => ({ phase: 'plan', answers: ANS, feedback: [FEEDBACK], planRev: 1, worked: { secs: 24, steps: 7 } })) },
  {
    id: 'C11',
    label: 'Building',
    build: () => mk(() => ({ ...approved, phase: 'developing', tasks: ['done', 'done', 'running', 'queued', 'queued'], log: [li('edit', 'Edited src/db/seed.ts', 'done', { diff: [120, 0], detail: 'edit' }), li('edit', 'Edited src/app/deliveries/page.tsx', 'done', { diff: [48, 0], detail: 'edit' }), li('edit', 'Writing src/jobs/retry.ts', 'running')] }), 72),
  },
  {
    id: 'C12',
    label: 'Test fails: retrying automatically',
    build: () => mk(() => ({ ...approved, phase: 'verifying', tasks: done5, verify: { lint: 'done', tests: 'running', prettier: 'queued', attempt: 2, passed: 23 }, log: [li('error', 'retry.scheduler.test.ts failed', 'failed', { meta: '23 of 24', detail: 'test' }), li('sparkle', 'The first retry waits 2 seconds, the test expects 1', 'done', { detail: 'think' }), li('edit', 'Fixing src/jobs/retry.ts', 'running')] }), 242),
  },
  { id: 'C13', label: 'Still failing after 3 attempts', build: () => mk(() => ({ ...approved, phase: 'failed', segSecs: 340, tasks: done5, verify: { lint: 'done', tests: 'failed', prettier: 'queued', attempt: 3, passed: 23 } })) },
  {
    id: 'C14',
    label: 'Verify: tests, lint, Prettier',
    build: () => mk(() => ({ ...approved, phase: 'verifying', tasks: done5, verify: { lint: 'done', tests: 'done', prettier: 'running', attempt: 2, passed: 24 }, log: [li('test', 'Ran 24 tests', 'done', { meta: '24 passed' }), li('lint', 'Ran lint', 'done', { meta: '0 issues' }), li('terminal', 'Running Prettier', 'running')] }), 288),
  },
  { id: 'C15', label: 'Sandbox ready', build: () => mk(() => finished()) },
  { id: 'C16', label: 'GitHub connected, draft PR opened', build: () => mk((c) => ({ ...finished(), ...gh({ pushed: true, commit: '3f9c2a1', pr: 12 })(c) })) },
  { id: 'C16a', label: 'Create draft PR: commit message, branch and push', build: () => mk((c) => ({ ...finished(), ...gh({})(c) })) },
  { id: 'C16c', label: 'Code pushed: create a pull request when ready', build: () => mk((c) => ({ ...finished(), ...gh({ pushed: true, commit: '3f9c2a1' })(c) })) },
  { id: 'C17', label: 'Stopped by you', build: () => mk(() => ({ ...approved, phase: 'stopped', resumeFrom: 'developing', segSecs: 130, tasks: ['done', 'done', 'queued', 'queued', 'queued'] })) },
  {
    id: 'C18',
    label: 'Message queued while running',
    build: () => mk(() => ({ ...approved, phase: 'developing', queued: 'Also add a CSV export of failed deliveries.', tasks: ['done', 'done', 'running', 'queued', 'queued'], log: [li('edit', 'Edited src/app/deliveries/page.tsx', 'done', { diff: [48, 0] }), li('edit', 'Writing src/jobs/retry.ts', 'running')] }), 100),
  },
  { id: 'C19', label: 'Sandbox did not start', build: () => mk(() => ({ phase: 'sandbox-failed', sandbox: 'failed', segSecs: 14 })) },
  { id: 'C20', label: 'Connection lost', build: () => mk(() => ({ ...approved, phase: 'lost', resumeFrom: 'developing', segSecs: 96, tasks: ['done', 'done', 'queued', 'queued', 'queued'] })) },
  { id: 'C21', label: 'Out of credits mid-run', build: () => mk(() => ({ ...approved, phase: 'credits', resumeFrom: 'developing', segSecs: 185, tasks: ['done', 'done', 'queued', 'queued', 'queued'] })) },
  { id: 'C27', label: 'Sandbox paused after 2 hours idle', build: () => mk(() => finished({ sandbox: 'paused' })) },
  { id: 'R01', label: 'Sandbox opening', build: () => mk(() => finished({ tab: 'sandbox' })) },
  { id: 'R02', label: 'Sandbox open: default 50%', build: () => mk(() => finished({ tab: 'sandbox' })) },
  { id: 'R06', label: 'Sandbox did not load', build: () => mk(() => finished({ tab: 'sandbox', sandbox: 'failed' })) },
  { id: 'R07', label: 'Code changes: default 50%', build: () => mk(() => finished({ tab: 'code' })) },
  { id: 'R10', label: 'Code changes: nothing yet', build: () => mk(() => ({ ...approved, phase: 'developing', tab: 'code', tasks: ['done', 'running', 'queued', 'queued', 'queued'] }), 30) },
  { id: 'R12', label: 'Push needs GitHub', build: () => mk(() => finished({ tab: 'code' })) },
  { id: 'R13', label: 'Files', build: () => mk(() => finished({ tab: 'files' })) },
  { id: 'R14', label: 'Files: nothing yet', build: () => mk(() => ({ ...approved, phase: 'developing', tab: 'files', tasks: ['done', 'running', 'queued', 'queued', 'queued'] }), 30) },
  /* ---------- 24 Edge cases (page 02) ---------- */
  { id: 'EC01', label: 'Ask before edits: Revolte asks before it edits a file', build: () => mk(() => building({ editMode: 'manual', review: [RV[0]], log: [...seedLog, li('edit', 'Waiting for you to allow an edit', 'running')] }), 72) },
  { id: 'EC02', label: 'Review queue: 3 edits waiting', build: () => mk(() => building({ editMode: 'manual', review: [...RV], log: [...seedLog, li('edit', 'Waiting for you to allow an edit', 'running')] }), 72) },
  { id: 'EC03', label: 'Edit allowed: next change in the queue', build: () => mk(() => building({ editMode: 'manual', review: [RV[1], RV[2]], log: [...seedLog, li('edit', 'Edited src/jobs/retry.ts', 'done', { diff: [18, 4] }), li('edit', 'Waiting for you to allow an edit', 'running')] }), 80) },
  { id: 'EC04', label: 'Edit denied: Revolte carries on without it', build: () => mk(() => building({ editMode: 'manual', review: [RV[1], RV[2]], log: [...seedLog, li('error', 'Skipped src/jobs/retry.ts: you denied it, Revolte carries on without it', 'failed'), li('edit', 'Waiting for you to allow an edit', 'running')] }), 80) },
  { id: 'EC05', label: 'Background task started: indicator above the composer', build: () => mk(() => building({ bg: [...FIN, DEV, WATCH], log: [...seedLog, li('terminal', 'Started in the background: npm run test:watch', 'running')] }), 72) },
  { id: 'EC06', label: 'Background tasks panel: running and finished', build: () => mk(() => building({ bgOpen: true, bg: [...FIN, DEV, WATCH], log: [...seedLog, li('terminal', 'Started in the background: npm run test:watch', 'running')] }), 72) },
  { id: 'EC08', label: 'Background task finished: result in chat', build: () => mk(() => finished({ bg: [...FIN, { ...DEV, state: 'finished' as const }, { ...WATCH, state: 'finished' as const }] })) },
  { id: 'EC09', label: 'New chat: sandbox hours used up', route: 'app', net: { noHours: true }, build: () => mk(() => ({})) },
  { id: 'EC10', label: 'Running chat: sandbox hours ran out', net: { noHours: true }, build: () => mk(() => ({ ...approved, phase: 'hours', resumeFrom: 'developing', segSecs: 185, tasks: done5 })) },
  { id: 'EC11', label: 'Paused chat reopened: sandbox hours used up', net: { noHours: true }, build: () => mk(() => ({ ...approved, phase: 'hours', resumeFrom: 'developing', segSecs: 185, tasks: done5 })) },
  { id: 'EC11a', label: 'Out of AI credits with the sandbox open: three panes', net: { noCredits: true }, build: () => mk(() => finished({ tab: 'sandbox' })) },
  { id: 'EC11b', label: 'Sandbox hours used up with the sandbox open: three panes', net: { noHours: true }, build: () => mk(() => finished({ tab: 'sandbox' })) },
  { id: 'EC12', label: 'Returning user: Choose application button in the right pane', build: () => mk(() => finished()) },
  { id: 'EC14', label: 'Choose application pop-up: existing application chosen', extra: { appDialog: true }, build: () => mk(() => finished()) },
  { id: 'EC15', label: 'Application chosen: shown in the Summary', build: () => mk(() => finished({ app: 'Webhook monitor' })) },
  { id: 'MS01', label: 'Model switched mid-chat: notice above the prompt', build: () => mk(() => finished({ model: 'Claude Opus 5.5', modelNote: 'Switched to Opus 5. It applies to your next message.' })) },
  { id: 'MS02', label: 'Next message sent: model change marked in the conversation', build: () => mk(() => finished({ model: 'Claude Opus 5.5', followUps: ['Refactor the retry scheduler so each endpoint can have its own backoff.'], marks: [{ index: 0, model: 'Sonnet 5', at: '10:42' }] })) },
]
