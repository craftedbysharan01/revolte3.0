export type Phase =
  | 'thinking' //   C01-C02  reading the request, starting the sandbox
  | 'asking' //     C03-C06  Grill: a few questions before planning
  | 'planning' //   C07      drafting the plan
  | 'plan' //       C08, C10 plan ready: approve or change
  | 'revising' //   C09      applying requested changes
  | 'developing' // C11      Tasks / Build
  | 'verifying' //  C12, C14 Verify: tests, lint, Prettier
  | 'failed' //     C13      still failing after 3 attempts
  | 'done' //       C15+     built and verified
  | 'stopped' //    C17
  | 'credits' //    C21
  | 'sandbox-failed' // C19
  | 'lost' //       C20
  | 'hours' //      EC10-EC11b sandbox hours used up

export type LogIcon = 'search' | 'terminal' | 'edit' | 'test' | 'lint' | 'think' | 'sparkle' | 'error'
export type LogItem = {
  id: number
  icon: LogIcon
  text: string
  meta?: string
  /** green +n -n for edits */
  diff?: [number, number]
  state: 'done' | 'running' | 'failed'
  /** C28-C30: what the row expands to */
  detail?: 'edit' | 'test' | 'think'
}

export type StepState = 'queued' | 'running' | 'done'
export type Gate = 'idle' | 'waiting' | 'failed'
export type SandboxState = 'starting' | 'ready' | 'failed' | 'disconnected' | 'paused'
export type Review = { kind: 'Edit' | 'Create'; file: string; add: number; del: number }
export type BgTask = { id: string; cmd: string; startedAt: number; state: 'running' | 'finished'; out: string[] }
export type Tab = 'overview' | 'sandbox' | 'code' | 'files' | 'workflow'

export type Chat = {
  id: string
  title: string
  prompt: string
  createdAt: number
  phase: Phase
  /** when the active segment began (for the live "· 12s" counter) */
  segStart: number
  /** frozen seconds for a stopped / finished segment */
  segSecs: number
  log: LogItem[]
  /** completed earlier work, for "Worked for 5m 20s · 24 steps" */
  worked: { secs: number; steps: number } | null
  qi: number
  answers: string[]
  skipped: boolean
  planRev: number
  feedback: string[]
  planApproved: boolean
  tasks: StepState[]
  verify: { lint: 'queued' | 'running' | 'done'; tests: 'queued' | 'running' | 'failed' | 'done'; prettier: 'queued' | 'running' | 'done'; attempt: number; passed: number }
  sandbox: SandboxState
  github: { connected: boolean; repo: string; branch: string; pushed: boolean; commit: string; pr: number | null }
  queued: string | null
  followUps: string[]
  tab: Tab
  workflowDismissed: boolean
  /** Phase the run was in when stopped (so Resume knows where to go) */
  resumeFrom: Phase | null
  /** EC01-EC04: Manual mode waits for you before each edit */
  editMode?: 'manual' | 'auto' | 'project'
  review?: Review[]
  reviewed?: boolean
  /** EC05-EC08: commands left running in the sandbox */
  bg?: BgTask[]
  bgOpen?: boolean
  /** EC12-EC16: the application this chat belongs to */
  app?: string | null
  /** MS01-MS02 */
  model?: string
  modelNote?: string | null
  marks?: { index: number; model: string; at: string }[]
}

export const QUESTIONS = [
  { q: 'Where do the webhook deliveries come from?', options: ['Seeded sample data', 'My existing webhook service'] },
  { q: 'How long should Revolte keep retrying a failed delivery?', options: ['8 attempts over 6 hours', '3 attempts over 1 hour'] },
  { q: 'Who gets alerted after the last attempt?', options: ['Email on-call', 'Email the merchant'] },
] as const

export const PLAN_STEPS = [
  'Seed sample deliveries and build the deliveries table with status and filters',
  'Retry failed deliveries 8 times over 6 hours, with a manual Retry now',
  'Email on-call after the last attempt',
  'Test with Vitest and Playwright, then verify in the sandbox',
]

export const TASKS = [
  'Data model and seed deliveries',
  'Deliveries dashboard UI',
  'Retry scheduler with backoff',
  'Alert after the last attempt',
  'Tests and checks',
]

export const BG_SEED: Record<string, string[]> = {
  'npm run dev': ['$ npm run dev', '> webhook-monitor@0.1.0 dev', '> next dev -p 3000', '✓ Ready on http://localhost:3000', '○ Compiling /deliveries ...', '✓ Compiled /deliveries in 1.2s'],
  'npm run test:watch': ['$ npm run test:watch', '> vitest', '✓ src/db/seed.test.ts (4)', '✓ src/app/deliveries.test.tsx (6)', 'Watching for file changes...'],
}
export const FINISHED_SEED = ['npm install', 'npx prisma generate', 'npm run lint']

export const DEMO_REPO = 'acme/webhook-monitor'
export const DEMO_BRANCH = 'revolte/webhook-dashboard'

