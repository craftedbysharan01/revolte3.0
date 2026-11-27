/* Scripted scenario: every prompt runs the webhook delivery dashboard build. */
(function () {
  // Line helpers. A plain string is written in phase 1. {p:0} already exists in the repo.
  // {del:n} is removed in phase n. {p:2} is written in the fix step.
  const base = (t) => ({ t, p: 0 })
  const fix = (t) => ({ t, p: 2 })
  const src = (s) => s.replace(/^\n/, '').replace(/\n\s*$/, '').split('\n')

  const FILES = {
    'src/jobs/backoff.ts': src(`
export const SECOND = 1000
export const MINUTE = 60 * SECOND
export const HOUR = 60 * MINUTE

export type BackoffOptions = {
  base: number
  max?: number
  jitter?: number
}

// Exponential backoff with a little jitter so retries do not land together.
export function backoff(attempt: number, options: BackoffOptions): number {
  const { base, max = Infinity, jitter = 0.2 } = options
  const exponential = base * 2 ** Math.max(0, attempt - 1)
  const capped = Math.min(exponential, max)
  const spread = capped * jitter * (Math.random() * 2 - 1)
  return Math.round(capped + spread)
}

export function nextAttemptAt(attempt: number, options: BackoffOptions): Date {
  return new Date(Date.now() + backoff(attempt, options))
}
`),

    'src/jobs/retry.ts': [
      ...src(`
import { backoff, HOUR } from './backoff'
import { queue, type Job } from './queue'
import { alertOnCall } from '../alerts/notify'
import { db } from '../lib/db'

export const MAX_ATTEMPTS = 8

export async function retry(job: Job) {
  const delivery = await db.delivery.findUnique({ where: { id: job.id } })
  if (!delivery || delivery.status === 'delivered') return

  if (job.attempt >= MAX_ATTEMPTS) {
    await alertOnCall(delivery)
    return markFailed(delivery.id)
  }
`),
      { t: '  const delay = backoff(job.attempt, { base: 1000 })', p: 1, del: 2 },
      fix('  const delay = backoff(job.attempt, {'),
      fix('    base: 1000, max: 6 * HOUR,'),
      fix('  })'),
      ...src(`
  await db.delivery.update({
    where: { id: delivery.id },
    data: { status: 'retrying', attempts: job.attempt },
  })
  await queue.add({ ...job, attempt: job.attempt + 1 }, { delay })
}

async function markFailed(id: string) {
  await db.delivery.update({ where: { id }, data: { status: 'failed' } })
}
`),
    ],

    'src/jobs/queue.ts': [
      base("import { Queue } from 'bullmq'"),
      base("import { redis } from '../lib/redis'"),
      base(''),
      base('export type Job = {'),
      base('  id: string'),
      base('  endpoint: string'),
      '  attempt: number',
      base('}'),
      base(''),
      { t: "export const queue = new Queue<Job>('deliveries', { connection: redis })", p: 0, del: 1 },
      "const deliveries = new Queue<Job>('deliveries', { connection: redis })",
      '',
      'export const queue = {',
      '  add(job: Job, options: { delay?: number } = {}) {',
      "    return deliveries.add('retry', job, {",
      '      delay: options.delay,',
      '      removeOnComplete: true,',
      '    })',
      '  },',
      '  pending() {',
      "    return deliveries.getJobCounts('delayed', 'waiting')",
      '  },',
      '}',
    ],

    'src/alerts/notify.ts': src(`
import { mailer } from '../lib/mailer'
import type { Delivery } from '../lib/db'

const ON_CALL = process.env.ON_CALL_EMAIL ?? 'oncall@acme.dev'

export async function alertOnCall(delivery: Delivery) {
  await mailer.send({
    to: ON_CALL,
    subject: \`Webhook failed after 8 attempts: \${delivery.endpoint}\`,
    text: [
      \`Event: \${delivery.event}\`,
      \`Last response: \${delivery.lastStatus}\`,
      \`Open: /deliveries/\${delivery.id}\`,
    ].join('\\n'),
  })
}
`),

    'src/jobs/retry.spec.ts': src(`
import { describe, expect, it, vi } from 'vitest'
import { backoff, HOUR } from './backoff'
import { retry, MAX_ATTEMPTS } from './retry'
import { queue } from './queue'

describe('retry', () => {
  it('doubles the delay on each attempt', () => {
    const first = backoff(1, { base: 1000, jitter: 0 })
    const third = backoff(3, { base: 1000, jitter: 0 })
    expect(third).toBe(first * 4)
  })

  it('caps the delay at 6 hours', async () => {
    const add = vi.spyOn(queue, 'add')
    await retry({ id: 'd_1', endpoint: 'acme/hook', attempt: 30 })
    expect(add.mock.calls[0][1].delay).toBeLessThanOrEqual(6 * HOUR * 1.2)
  })

  it('alerts on-call after the last attempt', async () => {
    await retry({ id: 'd_2', endpoint: 'acme/hook', attempt: MAX_ATTEMPTS })
    expect(await lastEmail()).toMatch(/failed after 8 attempts/)
  })
})
`),

    'app/deliveries/page.tsx': src(`
import { db } from '@/src/lib/db'
import { DeliveryTable } from '@/components/DeliveryTable'
import { StatTile } from '@/components/StatTile'

export const revalidate = 15

export default async function DeliveriesPage() {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000)
  const deliveries = await db.delivery.findMany({
    where: { createdAt: { gte: since } },
    orderBy: { createdAt: 'desc' },
  })
  const count = (status: string) =>
    deliveries.filter((d) => d.status === status).length

  return (
    <main className="page">
      <header className="page-head">
        <h1>Webhook deliveries</h1>
        <span>Last 24 hours</span>
      </header>
      <section className="stats">
        <StatTile label="Delivered" value={count('delivered')} />
        <StatTile label="Retrying" value={count('retrying')} />
        <StatTile label="Failed" value={count('failed')} />
      </section>
      <DeliveryTable deliveries={deliveries} />
    </main>
  )
}
`),

    'components/DeliveryTable.tsx': src(`
import type { Delivery } from '@/src/lib/db'
import { MAX_ATTEMPTS } from '@/src/jobs/retry'
import { RetryButton } from './RetryButton'
import { StatusBadge } from './StatusBadge'

export function DeliveryTable({ deliveries }: { deliveries: Delivery[] }) {
  return (
    <table className="deliveries">
      <thead>
        <tr>
          <th>Endpoint</th>
          <th>Event</th>
          <th>Attempts</th>
          <th>Status</th>
          <th />
        </tr>
      </thead>
      <tbody>
        {deliveries.map((delivery) => (
          <tr key={delivery.id}>
            <td>{delivery.endpoint}</td>
            <td>{delivery.event}</td>
            <td>{delivery.attempts} of {MAX_ATTEMPTS}</td>
            <td><StatusBadge status={delivery.status} /></td>
            <td>
              {delivery.status === 'failed' && <RetryButton id={delivery.id} />}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
`),

    'components/RetryButton.tsx': src(`
'use client'

import { useTransition } from 'react'
import { retryDelivery } from '@/app/deliveries/actions'

export function RetryButton({ id }: { id: string }) {
  const [pending, start] = useTransition()

  return (
    <button
      className="retry"
      disabled={pending}
      onClick={() => start(() => retryDelivery(id))}
    >
      {pending ? 'Retrying' : 'Retry'}
    </button>
  )
}
`),
  }

  // Files that already exist in the repository (shown in the tree, not edited).
  const REPO_FILES = [
    'app/layout.tsx',
    'components/StatTile.tsx',
    'components/StatusBadge.tsx',
    'prisma/schema.prisma',
    'src/lib/db.ts',
    'src/lib/mailer.ts',
    'src/lib/redis.ts',
    'src/webhooks/receive.ts',
    'package.json',
  ]

  const QUESTIONS = [
    {
      key: 'source',
      q: 'Where do the webhook deliveries come from?',
      options: ['Seeded sample data', 'The deliveries table in Postgres', 'Stripe webhooks, live'],
    },
    {
      key: 'retry',
      q: 'How long should Revolte keep retrying a failed delivery?',
      options: ['8 attempts over 6 hours', '3 attempts over 15 minutes', '12 attempts over 24 hours'],
    },
    {
      key: 'alert',
      q: 'Who gets alerted after the last attempt?',
      options: ['Email on-call', 'Post in Slack #incidents', 'Page through PagerDuty'],
    },
  ]

  const PLAN_TASKS = [
    { t: 'Add the retry scheduler with exponential backoff', area: 'Jobs', effort: 'M', after: '–' },
    { t: 'Alert on-call after the last attempt', area: 'Alerts', effort: 'S', after: '1' },
    { t: 'Build the deliveries dashboard with retry', area: 'UI', effort: 'M', after: '1' },
    { t: 'Run tests and lint, then verify the preview', area: 'Test', effort: 'S', after: '3' },
  ]

  // Build steps. Durations are in seconds and add up to 120.
  const BUILD = [
    { label: 'Building the retry scheduler', verb: 'Split', text: 'the plan into 8 file changes', dur: 5, stage: 'tasks' },
    { label: 'Building the retry scheduler', verb: 'Created', file: 'src/jobs/backoff.ts', phase: 1, dur: 8, stage: 'build' },
    { label: 'Building the retry scheduler', verb: 'Created', file: 'src/jobs/retry.ts', phase: 1, dur: 15, stage: 'build' },
    { label: 'Building the retry scheduler', verb: 'Edited', file: 'src/jobs/queue.ts', phase: 1, dur: 7, stage: 'build' },
    { label: 'Wiring the on-call alert', verb: 'Created', file: 'src/alerts/notify.ts', phase: 1, dur: 9, stage: 'build' },
    { label: 'Writing tests', verb: 'Created', file: 'src/jobs/retry.spec.ts', phase: 1, dur: 8, stage: 'build' },
    {
      label: 'Running tests', verb: 'Ran', text: 'tests', dur: 8, stage: 'build', fail: '2 failed',
      term: [
        '$ pnpm test',
        ' RUN  v2.1.4 /workspace/webhook-monitor',
        ' ✓ src/jobs/backoff.spec.ts (6)',
        ' ✓ src/alerts/notify.spec.ts (5)',
        ' ✓ src/webhooks/receive.spec.ts (11)',
        ' ✗ src/jobs/retry.spec.ts (3)',
        '   ✗ caps the delay at 6 hours',
        '     expected 536870912000 to be less than or equal to 25920000',
        ' Tests  2 failed | 22 passed (24)',
      ],
    },
    { label: 'Fixing the backoff cap', verb: 'Fixed', text: 'the backoff cap in', file: 'src/jobs/retry.ts', phase: 2, dur: 6, stage: 'build' },
    {
      label: 'Running tests again', verb: 'Reran', text: 'tests', dur: 8, stage: 'build', pass: '24 passed',
      term: [
        '$ pnpm test',
        ' RUN  v2.1.4 /workspace/webhook-monitor',
        ' ✓ src/jobs/backoff.spec.ts (6)',
        ' ✓ src/alerts/notify.spec.ts (5)',
        ' ✓ src/webhooks/receive.spec.ts (11)',
        ' ✓ src/jobs/retry.spec.ts (3)',
        ' Tests  24 passed (24)',
      ],
    },
    { label: 'Building the dashboard', verb: 'Created', file: 'app/deliveries/page.tsx', phase: 1, dur: 13, stage: 'build' },
    { label: 'Building the dashboard', verb: 'Created', file: 'components/DeliveryTable.tsx', phase: 1, dur: 12, stage: 'build' },
    { label: 'Building the dashboard', verb: 'Created', file: 'components/RetryButton.tsx', phase: 1, dur: 7, stage: 'build' },
    {
      label: 'Checking lint and formatting', verb: 'Checked', text: 'lint and Prettier', dur: 6, stage: 'verify', pass: 'clean',
      term: ['$ pnpm lint && prettier --check .', ' ✓ No ESLint warnings or errors', ' ✓ All matched files use Prettier code style'],
    },
    {
      label: 'Starting the preview', verb: 'Started', text: 'the preview', dur: 8, stage: 'verify',
      term: [
        '$ pnpm dev',
        ' ▲ Next.js 15.1.0',
        ' - Local: http://localhost:3000',
        ' ✓ Ready in 2.1s',
        ' ✓ Compiled /deliveries in 640ms',
        ' Preview: https://webhook-monitor.sandbox.revolte.app/deliveries',
      ],
    },
  ]

  const DELIVERIES = [
    { endpoint: 'acme-payments/hook', event: 'invoice.paid', attempts: 8, status: 'failed' },
    { endpoint: 'shopline/events', event: 'order.created', attempts: 3, status: 'retrying' },
    { endpoint: 'ledgerly/in', event: 'refund.issued', attempts: 1, status: 'delivered' },
    { endpoint: 'northwind/hooks', event: 'invoice.paid', attempts: 2, status: 'delivered' },
    { endpoint: 'acme-payments/hook', event: 'charge.failed', attempts: 8, status: 'failed' },
    { endpoint: 'parcelo/status', event: 'shipment.updated', attempts: 1, status: 'delivered' },
  ]

  window.DATA = { FILES, REPO_FILES, QUESTIONS, PLAN_TASKS, BUILD, DELIVERIES }
})()
