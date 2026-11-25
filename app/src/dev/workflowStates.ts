import { deployBase } from '../chat/presets'
import type { Chat } from '../chat/types'
import type { StateDef } from './states'

const withSession = { session: { email: 'james@acmecorp.com' } }
const ago = (s: number) => Date.now() - s * 1000
type W = NonNullable<Chat['wf']>
const F: [string, string, (c: Chat) => Partial<Chat>, Record<string, unknown>?][] = [
  ['H01', 'Plan ready: choose how to proceed', () => ({ phase: 'plan', planApproved: false, tab: 'overview', tasks: ['queued', 'queued', 'queued', 'queued', 'queued'] })],
  ['H05', 'Choose a workflow: template library', () => ({ phase: 'plan', planApproved: false, tab: 'overview' }), { wfPicker: true }],
  ['H09', 'Workflow chosen: ready to run', () => ({ phase: 'workflow', wf: { stage: 'ready', step: 0, startedAt: 0, template: 'pr', from: 'plan' } as W, tab: 'workflow' })],
  ['H11', 'Workflow running: listed in the right pane', () => ({ phase: 'workflow', wf: { stage: 'running', step: 1, startedAt: ago(72), template: 'pr', from: 'plan' } as W, tab: 'workflow' })],
  ['H12', 'Workflow finished: draft PR opened', (c) => ({ phase: 'workflow', wf: { stage: 'done', step: 4, startedAt: ago(9), endedAt: Date.now(), template: 'pr', from: 'plan' } as W, tab: 'workflow', github: { ...c.github, pr: 14 } })],
  ['H13', 'Workflow stopped: QA did not pass', () => ({ phase: 'workflow', wf: { stage: 'failed', step: 2, startedAt: ago(9), endedAt: Date.now(), template: 'pr', from: 'plan' } as W, tab: 'workflow' })],
  ['W-after', 'After the preview: Try workflow fills it from this chat', () => ({ wf: { stage: 'ready', step: 0, startedAt: 0, template: 'pr', from: 'done' } as W, tab: 'workflow', workflowDismissed: true })],
]

export const WORKFLOW_STATES: StateDef[] = F.map(([id, label, patch, extra]) => ({
  id,
  label,
  route: 'chat',
  patch: () => {
    const b = deployBase()
    const c = { ...b, ...patch(b) } as Chat
    return { ...withSession, chats: [c], activeChat: c.id, wfPicker: false, ...extra }
  },
}))
