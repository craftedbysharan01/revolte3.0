/**
 * Workflows from chat (Figma 02 · section 14, H01-H13). No studio yet: a template is filled with the plan
 * from this chat and runs on its own: Manual trigger -> Developer -> QA -> Draft pull request.
 */
import { getChat, upd } from '../chat/engine'
import { getState, setState } from '../store'

export type Template = { id: string; title: string; desc: string; tag: 'Build' | 'Review' | 'Fix' | 'Docs'; icon: 'code' | 'search' | 'shield' | 'doc' | 'bug' | 'refresh'; setup?: boolean; jira?: boolean; match?: boolean }
export const TEMPLATES: Template[] = [
  { id: 'pr', title: 'Chat to pull request', desc: 'Builds this plan, tests it and opens a draft pull request.', tag: 'Build', icon: 'code', match: true },
  { id: 'reviewed', title: 'Chat to reviewed PR', desc: 'Adds a code review and your approval before the pull request.', tag: 'Review', icon: 'search' },
  { id: 'hotfix', title: 'Chat to hotfix', desc: 'Builds the fix, runs a security scan and opens a hotfix PR.', tag: 'Fix', icon: 'shield' },
  { id: 'docs', title: 'Chat to docs update', desc: 'Updates READMEs and API docs to match the change in this plan.', tag: 'Docs', icon: 'doc', setup: true },
  { id: 'bug', title: 'Bug fix with regression test', desc: 'Reproduces the bug, fixes it and adds a test so it stays fixed.', tag: 'Fix', icon: 'bug', jira: true },
  { id: 'refactor', title: 'Refactor with review', desc: 'Refactors in small, checked steps with a review at the end.', tag: 'Review', icon: 'refresh' },
]
export const tpl = (id: string) => TEMPLATES.find((t) => t.id === id) ?? TEMPLATES[0]

/** The nodes every run shows (H09 right pane, H11-H13 timeline). */
export const NODES = [
  { kind: 'Trigger', title: 'Manual', sub: 'Started from chat' },
  { kind: 'Agent', title: 'Developer', sub: 'Builds and fixes in the sandbox' },
  { kind: 'Agent', title: 'QA', sub: 'Tests, lint and a security scan' },
  { kind: 'Action', title: 'Draft pull request', sub: 'Opens on acme/webhook-monitor' },
] as const

export const PR_NUMBER = 14
const STEP_MS = [700, 4200, 3200, 1600]

export const openPicker = () => setState({ wfPicker: true })
export const closePicker = () => setState({ wfPicker: false })

/** Fill a template with this chat's plan (H09). `from` says whether the chat was still at the plan. */
export function fillWorkflow(id: string, template: string) {
  const c = getChat(id)
  if (!c) return
  const from = c.phase === 'plan' ? 'plan' : 'done'
  upd(id, () => ({
    ...(from === 'plan' ? { phase: 'workflow' as const, planApproved: true } : {}),
    wf: { stage: 'ready', step: 0, startedAt: 0, template, from },
    tab: 'workflow',
    workflowDismissed: true,
  }))
  closePicker()
}

const timers = new Map<string, number[]>()
const later = (id: string, fn: () => void, ms: number) => {
  const list = timers.get(id) ?? []
  list.push(window.setTimeout(fn, ms))
  timers.set(id, list)
}

/** H11 -> H12, or H13 when "Tests keep failing" is on in the Prototype panel. */
export function runWorkflow(id: string) {
  const c = getChat(id)
  if (!c?.wf) return
  const fail = getState().net.failTests
  upd(id, (x) => ({ wf: { ...x.wf!, stage: 'running', step: 1, startedAt: Date.now(), endedAt: undefined }, tab: 'workflow' }))
  let at = 0
  for (let s = 1; s <= 3; s++) {
    at += STEP_MS[s]
    later(id, () => {
      const w = getChat(id)?.wf
      if (!w || w.stage !== 'running') return
      if (fail && s === 2) return upd(id, (x) => ({ wf: { ...x.wf!, stage: 'failed', step: 2, endedAt: Date.now() } }))
      if (s === 3) return upd(id, (x) => ({ wf: { ...x.wf!, stage: 'done', step: 4, endedAt: Date.now() }, github: { ...x.github, pr: x.github.pr ?? PR_NUMBER } }))
      upd(id, (x) => ({ wf: { ...x.wf!, step: s + 1 } }))
    }, at)
  }
}
export function stopWorkflow(id: string) {
  timers.get(id)?.forEach(clearTimeout)
  timers.delete(id)
  upd(id, (x) => (x.wf ? { wf: { ...x.wf, stage: 'failed', endedAt: Date.now() } } : {}))
}
export const rerunWorkflow = (id: string) => runWorkflow(id)

/** Reloads cannot resume timers: a run that was going is shown as ready again. */
for (const c of getState().chats) if (c.wf?.stage === 'running') upd(c.id, (x) => ({ wf: { ...x.wf!, stage: 'ready', step: 0 } }))
