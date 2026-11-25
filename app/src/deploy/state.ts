import { getState, setState } from '../store'
import { freshDep, VALID_NAME_RE, TAKEN, DEP_VARS, type Dep } from './model'
export * from './model'

export const getDep = () => getState().dep
export const setDep = (patch: Partial<Dep> | ((d: Dep) => Partial<Dep>)) =>
  setState((s) => ({ dep: { ...s.dep, ...(typeof patch === 'function' ? patch(s.dep) : patch) } }))

const timers: number[] = []
const later = (fn: () => void, ms: number) => void timers.push(window.setTimeout(fn, ms))
export const clearDepTimers = () => timers.splice(0).forEach(clearTimeout)

export const openWizard = () => {
  const s = getState()
  const c = s.chats.find((x) => x.id === s.activeChat)
  setDep({ ...freshDep(), wizard: true, connected: getDep().connected, repo: c?.github.connected ? c.github.repo : '' })
}
export const askDiscard = () => setDep({ discard: true })
export const keepEditing = () => setDep({ discard: false })
export const discardSetup = () => (clearDepTimers(), setDep({ ...freshDep(), connected: getDep().connected }))

/** Step 1 -> 2: "creating application", with the name-already-used error (D01j). */
export function createApp() {
  const d = getDep()
  if (TAKEN.includes(d.name.trim())) return
  setDep({ creating: true })
  later(() => setDep({ creating: false, step: 2 }), 1400)
}

/** Step 2: connect a cloud account when needed (D05-D05d). */
export function continueWhere() {
  const d = getDep()
  if (d.where === 'cloud' || d.connected[d.where]) return setDep({ step: 3 })
  startConnect(d.where)
}
export function startConnect(w: 'aws' | 'gcp') {
  setDep({ connecting: w, connectFail: false })
  later(() => {
    const bad = getState().net.offline || getState().net.failGithub
    if (getDep().connecting !== w) return
    if (bad) return setDep({ connectFail: true })
    setDep((d) => ({ connecting: '', connected: { ...d.connected, [w]: true }, step: 3 }))
  }, 2200)
}
export const cancelConnect = () => (clearDepTimers(), setDep({ connecting: '', connectFail: false }))

/** Step 4 -> chat: Revolte writes deployment.yml, then asks for the values the code reads at start-up. */
export function generateYaml() {
  setDep({ wizard: false, chat: 'generating', vars: DEP_VARS.map((v) => ({ ...v })), varBad: false })
  later(() => setDep({ chat: 'vars' }), 2200)
}
export const VALID_NAME = VALID_NAME_RE
/** The sandbox already ran with these values: reuse them instead of typing them again. */
export const fillSandboxValues = () => setDep((d) => ({ vars: d.vars.map((v, i) => ({ ...v, key: v.key || ['sbx_r3d1s_7f2a9c', 'sbx_enc_4b8e1d0a', 'sbx_pd_93c1e7'][i] || 'sbx_value' })), varBad: false }))

export function saveVars() {
  const d = getDep()
  if (d.vars.some((v) => !VALID_NAME.test(v.name))) return setDep({ varBad: true })
  setDep({ chat: 'finishing', varBad: false })
  later(() => setDep({ chat: 'ready' }), 1800)
}

/** Deploy now -> Application page (D13). */
export const deployNow = () => setDep({ page: true, launch: 'idle', pct: 0, toast: false, sugg: false })
export const openChat = () => setDep({ page: false })

/** Open the live app; the workflow nudge waits until you come back to Revolte (D16a). */
export function openLiveApp(open: () => boolean) {
  const ok = open()
  setDep({ opened: true })
  if (!ok) return
  const back = () => {
    window.removeEventListener('focus', back)
    if (getDep().launch === 'live') setTimeout(() => setDep({ sugg: true }), 500)
  }
  window.addEventListener('focus', back)
}

export function launch() {
  const d = getDep()
  if (d.launch === 'idle') return setDep({ launch: 'secrets', secrets: ['', ''] })
}
export function saveAndLaunch() {
  setDep({ launch: 'launching', pct: 8 })
  const tick = () => {
    const p = getDep().pct
    if (getDep().launch !== 'launching') return
    if (p >= 100) {
      setDep({ launch: 'live', toast: true })
      later(() => setDep({ toast: false }), 5000)
      later(() => getDep().launch === 'live' && !getDep().opened && setDep({ sugg: true }), 7000)
      return
    }
    setDep({ pct: Math.min(100, p + (p < 70 ? 12 : 8)) })
    later(tick, 650)
  }
  later(tick, 650)
}
