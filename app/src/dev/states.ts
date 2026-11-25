import { Route, Prototype } from '../store'
import { DEFAULT_PROMPT } from '../screens/Website'
import { CHAT_PRESETS } from '../chat/presets'
import { getState } from '../store'
import { DEPLOY_STATES } from './deployStates'

export type StateDef = {
  id: string
  label: string
  route: Route
  patch?: Partial<Prototype> | (() => Partial<Prototype>)
}

export type Group = { title: string; states: StateDef[] }

const S = (id: string, label: string, route: Route, patch?: StateDef['patch']): StateDef => ({ id, label, route, patch })

/** A previewable workspace/app session so those screens render when jumped to directly. */
const withSession = { session: { email: 'james@acmecorp.com' } }

const withPrompt = { ...withSession, savedPrompt: DEFAULT_PROMPT }

function chatState(p: (typeof CHAT_PRESETS)[number]): StateDef {
  return S(p.id, p.label, p.route ?? 'chat', () => {
    const c = p.build()
    // Each state sets the plan limits it needs, so jumping between states never inherits a limit.
    const net = { ...getState().net, noCredits: !!p.net?.noCredits, noHours: !!p.net?.noHours }
    return { ...withSession, chats: [c], activeChat: p.route === 'app' ? null : c.id, net, appDialog: false, ...p.extra }
  })
}

/** Every onboarding state in the Figma file (page 01 Onboarding), grouped as in the file. */
export const GROUPS: Group[] = [
  {
    title: '01 · Website to sign up',
    states: [
      S('U01', 'Website: prompt typed, Start building', 'website'),
      S('U02', 'Sign up: choose a method', 'signup', { promptToast: false }),
      S('U03', 'Sign up: saved prompt toaster', 'signup', { promptToast: true, savedPrompt: DEFAULT_PROMPT }),
    ],
  },
  {
    title: '03 · Sign up with email',
    states: [
      S('U08', 'Email form: empty', 'signup-email', { pending: null }),
      S('U09', 'Username available', 'signup-email', { pending: null }),
      S('U10', 'Username taken', 'signup-email', { pending: null }),
      S('U11', 'Password typing: weak', 'signup-email', { pending: null }),
      S('U12', 'Password typing: fair', 'signup-email', { pending: null }),
      S('U13', 'Password strong, shown', 'signup-email', { pending: null }),
      S('U14', 'Sign up with field errors', 'signup-email', { pending: null }),
      S('U15', 'Email already registered', 'signup-email', { pending: null }),
      S('U16', 'Creating account', 'signup-email', { pending: null }),
      S('U17', 'Account not created: no connection', 'signup-email', { pending: null }),
    ],
  },
  {
    title: '04 · Verify email',
    states: [
      S('U18', 'Enter code', 'verify'),
      S('U19', 'Typing the code', 'verify'),
      S('U20', 'Verifying', 'verify'),
      S('U21', 'Wrong code', 'verify'),
      S('U22', 'Code expired, new one sent', 'verify'),
      S('U23', 'New code sent', 'verify'),
      S('U24', 'Too many wrong codes', 'verify'),
      S('U25', 'Email verified', 'verify'),
    ],
  },
  {
    title: '05 · Sign in',
    states: [
      S('S01', 'Choose a method', 'signin'),
      S('S02', 'Email: empty', 'signin-email', { carryEmail: '' }),
      S('S03', 'Signing in', 'signin-email'),
      S('S04', 'Wrong password', 'signin-email'),
      S('S05', 'Paused after 5 tries', 'signin-email'),
      S('S06', 'No account for this email', 'signin-email'),
      S('S07', 'Email format not valid', 'signin-email'),
      S('S08', 'Signed in with empty fields', 'signin-email'),
      S('S09', 'Email signs in with GitHub', 'signin-email'),
      S('S10', 'Session expired', 'signin'),
    ],
  },
  {
    title: '06 · Forgot password',
    states: [
      S('F01', 'Enter email', 'forgot', { carryEmail: '' }),
      S('F02', 'Sending reset link', 'forgot'),
      S('F03', 'Check your email', 'forgot'),
      S('F04', 'Set a new password', 'reset'),
      S('F05', 'Passwords do not match', 'reset'),
      S('F06', 'Password used before', 'reset'),
      S('F07', 'Reset link expired', 'reset'),
      S('F08', 'Password updated', 'reset'),
    ],
  },
  {
    title: '07 · Workspace setup',
    states: [
      S('W01', 'URL: checking', 'workspace', withSession),
      S('W02', 'URL: available', 'workspace', withSession),
      S('W03', 'URL: taken, with suggestions', 'workspace', withSession),
      S('W04', 'URL: characters not allowed', 'workspace', withSession),
      S('W05', 'Workspace name empty', 'workspace', withSession),
      S('W06', 'URL check failed: no connection', 'workspace', withSession),
      S('W07', 'Teammates added', 'workspace', withSession),
      S('W08', 'Invite email not valid', 'workspace', withSession),
      S('W09', 'Free plan member limit', 'workspace', withSession),
      S('W10', 'Creating workspace', 'workspace', withSession),
      S('W11', 'Workspace not created', 'workspace', withSession),
      S('W12', 'Creating your workspace', 'workspace', withPrompt),
      S('W13', 'Workspace ready', 'workspace', withPrompt),
    ],
  },
  {
    title: '26 · Get started',
    states: [
      S('GS-F01', 'First visit: opens by itself', 'app', withSession),
      S('GS-F02', 'Card closed: ring in sidebar', 'app', withSession),
      S('GS-F03', 'GitHub connected: next step ready', 'app', withSession),
      S('GS-F04', 'Step skipped: next step ready', 'app', withSession),
      S('GS-F05', 'Step locked: needs earlier step', 'app', withSession),
      S('GS-F06', 'Step failed: GitHub did not connect', 'app', withSession),
      S('GS-F07', 'Last step left', 'app', withSession),
      S('GS-F08', 'All steps done', 'app', withSession),
      S('GS-F09', 'After setup: gone from sidebar', 'app', withSession),
    ],
  },
  {
    title: '09–10 · Chat, sandbox, code and files',
    states: CHAT_PRESETS.filter((p) => !p.id.startsWith('EC') && !p.id.startsWith('MS')).map(chatState),
  },
  {
    title: '24 · Edge cases: chat',
    states: CHAT_PRESETS.filter((p) => p.id.startsWith('EC') || p.id.startsWith('MS')).map(chatState),
  },
  {
    title: '11 · Deploy',
    states: DEPLOY_STATES,
  },
]
