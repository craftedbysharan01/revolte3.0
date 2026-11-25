/**
 * Deploy flow (Figma page 03 Deploy, D00-D16b):
 * sandbox -> Create application wizard (4 steps) -> chat writes deployment.yml (variables) -> Application page
 * (YML config) -> Launch -> Live.
 */

export type Where = 'cloud' | 'aws' | 'gcp'
export type Env = 'dev' | 'qa' | 'stage' | 'prod'
export type VarRow = { name: string; key: string }

export type Dep = {
  wizard: boolean
  step: 1 | 2 | 3 | 4
  discard: boolean
  project: string
  name: string
  repoOpen: boolean
  repoQuery: string
  repo: string
  urlState: '' | 'checking' | 'bad'
  refreshing: boolean
  mono: boolean
  branch: string
  folder: string
  creating: boolean
  where: Where
  connecting: '' | 'aws' | 'gcp'
  connectFail: boolean
  connected: { aws: boolean; gcp: boolean }
  region: string
  regionOpen: boolean
  vpcs: Record<Env, string>
  vpcOpen: Env | ''
  preset: string
  chat: 'none' | 'generating' | 'vars' | 'finishing' | 'ready'
  varTab: 'secrets' | 'variables'
  vars: VarRow[]
  varBad: boolean
  yamlOpen: boolean
  page: boolean
  launch: 'idle' | 'secrets' | 'launching' | 'live'
  pct: number
  secrets: [string, string]
  toast: boolean
  sugg: boolean
  opened: boolean
}

export const REPOS = [
  { n: 'acme/webhook-monitor', b: 'main' },
  { n: 'acme/payments-api', b: 'main' },
  { n: 'acme/ledger', b: 'develop' },
  { n: 'acme/chess', b: 'main' },
]
export const TAKEN = ['Payments API', 'Ledger service', 'Admin console']
export const PROJECTS = ['Acme payments', 'PAMS', 'Customer portal']
export const BRANCHES = ['main', 'develop', 'revolte/webhook-dashboard']
export const FOLDERS = ['apps/webhook-monitor', 'apps/admin', 'packages/core']
export const REGIONS = ['US East (N. Virginia)', 'US East (Ohio)', 'US West (Oregon)', 'EU (Ireland)', 'Asia Pacific (Mumbai)']
export const VPC_LIST = ['rqt-revolte-dev-us-east-1-vpc', 'rqt-revolte-qa-us-east-1-vpc', 'rqt-revolte-stage-us-east-1-vpc', 'New VPC · created on deploy']
export const ENV_LABEL: Record<Env, string> = { dev: 'Dev', qa: 'QA', stage: 'Staging', prod: 'Production' }
export const PRESETS: [string, string][] = [
  ['Web app', 'Static or server-rendered front end'],
  ['Web service', 'API or microservice'],
  ['Web service and database', 'API with managed Postgres'],
  ['Web service and cache', 'API with Redis for fast reads'],
  ['Web service and storage bucket', 'API with object storage'],
  ['Web service, database and cache', 'Full backend stack'],
  ['Cron', 'Scheduled jobs'],
  ['Cron and database', 'Scheduled jobs with Postgres'],
]
export const WHERE_LABEL: Record<Where, string> = { cloud: 'Revolte Cloud', aws: 'your AWS account', gcp: 'your Google Cloud project' }
export const APP_URL = 'webhook-monitor.acme.revolte.app'
export const DEP_VARS: VarRow[] = [
  { name: 'REDIS_CLUSTER_PASSWORD', key: '' },
  { name: 'DB_ENCRYPTION_KEY', key: '' },
  { name: 'PAGERDUTY_ROUTING_KEY', key: '' },
]

export const freshDep = (): Dep => ({
  wizard: false,
  step: 1,
  discard: false,
  project: 'Acme payments',
  name: 'Webhook monitor',
  repoOpen: false,
  repoQuery: '',
  repo: '',
  urlState: '',
  refreshing: false,
  mono: false,
  branch: '',
  folder: '',
  creating: false,
  where: 'cloud',
  connecting: '',
  connectFail: false,
  connected: { aws: false, gcp: false },
  region: 'US East (Ohio)',
  regionOpen: false,
  vpcs: { dev: '', qa: '', stage: '', prod: '' },
  vpcOpen: '',
  preset: 'Web service and database',
  chat: 'none',
  varTab: 'secrets',
  vars: DEP_VARS.map((v) => ({ ...v })),
  varBad: false,
  yamlOpen: false,
  page: false,
  launch: 'idle',
  pct: 0,
  secrets: ['', ''],
  toast: false,
  sugg: false,
  opened: false,
})


export const VALID_NAME_RE = /^[A-Z_][A-Z0-9_]*$/
