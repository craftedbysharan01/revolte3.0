import { useEffect } from 'react'
import { PrototypePanel } from './dev/PrototypePanel'
import { AppShell } from './screens/AppShell'
import { Forgot } from './screens/Forgot'
import { Method } from './screens/Method'
import { Reset } from './screens/Reset'
import { SignIn } from './screens/SignIn'
import { SignUpEmail } from './screens/SignUpEmail'
import { Verify } from './screens/Verify'
import { Website } from './screens/Website'
import { Workspace } from './screens/Workspace'
import { createChat } from './chat/engine'
import { getState, go, useStore } from './store'

export default function App() {
  const route = useStore((s) => s.route)
  const preset = useStore((s) => s.preset)
  const nonce = useStore((s) => s.nonce)

  // Route guards run on navigation only (not on data changes), so e.g. the
  // "creating your workspace" screens are not cut short when the account gains a workspace.
  // Design previews (a preset is set) bypass them.
  useEffect(() => {
    if (preset) return
    const { session, accounts } = getState()
    const acct = accounts.find((a) => a.email === session?.email)
    const { chats, activeChat, savedPrompt } = getState()
    const inApp = route === 'app' || route === 'chat'
    // A request typed on the website always opens its chat, however the person arrives (sign up, sign in, workspace setup).
    if (route === 'app' && session && acct?.workspace && savedPrompt.trim()) go('chat', { patch: { activeChat: createChat(savedPrompt) } })
    else if (inApp && !session) go('signin')
    else if (inApp && acct && !acct.workspace) go('workspace')
    else if (route === 'chat' && !chats.some((t) => t.id === activeChat)) go('app', { patch: { activeChat: null } })
    else if (route === 'workspace' && !session) go('signup')
    else if (route === 'workspace' && acct?.workspace) go('app')
  }, [route, preset, nonce])

  const key = `${route}-${nonce}`
  let screen
  switch (route) {
    case 'website':
      screen = <Website key={key} />
      break
    case 'signup':
      screen = <Method key={key} mode="signup" />
      break
    case 'signup-email':
      screen = <SignUpEmail key={key} preset={preset} />
      break
    case 'verify':
      screen = <Verify key={key} preset={preset} />
      break
    case 'signin':
      screen = <Method key={key} mode="signin" expired={preset === 'S10'} />
      break
    case 'signin-email':
      screen = <SignIn key={key} preset={preset} />
      break
    case 'forgot':
      screen = <Forgot key={key} preset={preset} />
      break
    case 'reset':
      screen = <Reset key={key} preset={preset} />
      break
    case 'workspace':
      screen = <Workspace key={key} preset={preset} />
      break
    case 'app':
    case 'chat':
      screen = <AppShell key={key} preset={preset} />
      break
  }
  return (
    <>
      {screen}
      <PrototypePanel />
    </>
  )
}
