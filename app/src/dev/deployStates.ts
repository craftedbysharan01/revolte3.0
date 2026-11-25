import { deployBase } from '../chat/presets'
import { freshDep, type Dep } from '../deploy/model'
import type { StateDef } from './states'

const withSession = { session: { email: 'james@acmecorp.com' } }
const W = (p: Partial<Dep>): Partial<Dep> => ({ wizard: true, ...p })
const base1: Partial<Dep> = { repo: 'acme/chess' }
const vpcsAll = { dev: 'rqt-revolte-dev-us-east-1-vpc', qa: 'rqt-revolte-qa-us-east-1-vpc', stage: 'rqt-revolte-stage-us-east-1-vpc', prod: 'New VPC · created on deploy' }

type D = [string, string, Partial<Dep>, { tab?: 'overview' | 'sandbox' }?]
const FRAMES: D[] = [
  ['D00', 'Sandbox preview: click Deploy', {}],
  ['D01a', 'Step 1: empty', W({})],
  ['D01b', 'Step 1: repository list open', W({ repoOpen: true })],
  ['D01c', 'Step 1: searching repositories', W({ repoOpen: true, repoQuery: 'pay' })],
  ['D01d', 'Step 1: public URL pasted', W({ repoOpen: true, repoQuery: 'https://github.com/acme/public-repo' })],
  ['D01e', 'Step 1: URL cannot be opened', W({ repoOpen: true, repoQuery: 'https://example.com/nothing-here', urlState: 'bad' })],
  ['D01f', 'Step 1: refreshing the repository list', W({ repoOpen: true, refreshing: true })],
  ['D01g', 'Step 1: repository chosen, monorepo not ticked', W(base1)],
  ['D01h', 'Step 1: monorepo ticked, branch and folder', W({ ...base1, mono: true })],
  ['D01i', 'Step 1: monorepo branch and folder chosen', W({ ...base1, mono: true, branch: 'main', folder: 'apps/webhook-monitor' })],
  ['D01j', 'Step 1: name already used', W({ ...base1, name: 'Payments API' })],
  ['D01k', 'Step 1: creating application', W({ ...base1, creating: true })],
  ['D03', 'Step 2: where the application runs', W({ ...base1, step: 2 })],
  ['D04', 'Step 2: AWS selected, continue to AWS', W({ ...base1, step: 2, where: 'aws' })],
  ['D05', 'Waiting for AWS', W({ ...base1, step: 2, where: 'aws', connecting: 'aws' })],
  ['D05a', 'AWS connection did not finish', W({ ...base1, step: 2, where: 'aws', connecting: 'aws', connectFail: true })],
  ['D05b', 'Waiting for Google Cloud', W({ ...base1, step: 2, where: 'gcp', connecting: 'gcp' })],
  ['D05c', 'Google Cloud connection did not finish', W({ ...base1, step: 2, where: 'gcp', connecting: 'gcp', connectFail: true })],
  ['D05d', 'AWS account connected', W({ ...base1, step: 2, where: 'aws', connected: { aws: true, gcp: false } })],
  ['D06', 'Step 3: region', W({ ...base1, step: 3, region: 'US East (Ohio)' })],
  ['D06a', 'AWS step 3: choose region first', W({ ...base1, step: 3, where: 'aws', region: '', connected: { aws: true, gcp: false } })],
  ['D06b', 'AWS step 3: region chosen, choose VPCs', W({ ...base1, step: 3, where: 'aws', region: 'US East (N. Virginia)', connected: { aws: true, gcp: false } })],
  ['D06c', 'AWS step 3: VPC list open', W({ ...base1, step: 3, where: 'aws', region: 'US East (N. Virginia)', connected: { aws: true, gcp: false }, vpcOpen: 'dev' })],
  ['D06d', 'AWS step 3: all environments mapped', W({ ...base1, step: 3, where: 'aws', region: 'US East (N. Virginia)', vpcs: vpcsAll, connected: { aws: true, gcp: false } })],
  ['D06e', 'AWS step 3: no VPC in this region', W({ ...base1, step: 3, where: 'aws', region: 'EU (Ireland)', connected: { aws: true, gcp: false } })],
  ['D07', 'Step 4: preset and service', W({ ...base1, step: 4 })],
  ['D08', 'Leaving setup: discard or keep going', W({ ...base1, step: 4, discard: true })],
  ['D09', 'deployment.yml needs 3 variables', { chat: 'vars' }, { tab: 'overview' }],
  ['D10', 'Variable key not valid', { chat: 'vars', varBad: true, vars: [{ name: 'redis password', key: 'x' }, { name: 'DB_ENCRYPTION_KEY', key: '' }, { name: 'PAGERDUTY_ROUTING_KEY', key: '' }] }, { tab: 'overview' }],
  ['D11', 'Variables saved, finishing deployment.yml', { chat: 'finishing' }, { tab: 'overview' }],
  ['D12', 'deployment.yml ready: Deploy now', { chat: 'ready' }, { tab: 'overview' }],
  ['D13', 'Application: review config and launch', { chat: 'ready', page: true }],
  ['D14', 'Launch: missing deployment secrets', { chat: 'ready', page: true, launch: 'secrets' }],
  ['D15', 'Launching: provisioning and deploying', { chat: 'ready', page: true, launch: 'launching', pct: 75 }],
  ['D16', 'Live', { chat: 'ready', page: true, launch: 'live', pct: 100, toast: true }],
  ['D16a', 'Live: suggestion to turn this into a workflow', { chat: 'ready', page: true, launch: 'live', pct: 100, sugg: true }],
]

export const DEPLOY_STATES: StateDef[] = FRAMES.map(([id, label, dep, o]) => ({
  id,
  label,
  route: 'chat',
  patch: () => {
    const c = deployBase()
    if (o?.tab) c.tab = o.tab
    return { ...withSession, chats: [c], activeChat: c.id, dep: { ...freshDep(), ...dep } }
  },
}))
