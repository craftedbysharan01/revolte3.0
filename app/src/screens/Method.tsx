import { useState } from 'react'
import { oauth, NetworkError } from '../api'
import { go, setState, useStore } from '../store'
import { GithubMark, GoogleMark, Icon, InfoDot, DangerDot } from '../ui/Icon'
import { AuthShell, Banner, Button, Divider, LinkButton, Toast } from '../ui/ui'

/**
 * U02 / U03 (sign up) and S01 / S10 (sign in): choose a method.
 * `expired` renders the "Your session ended" banner (S10).
 */
export function Method({ mode, expired }: { mode: 'signup' | 'signin'; expired?: boolean }) {
  const [busy, setBusy] = useState<null | 'github' | 'google'>(null)
  const [err, setErr] = useState('')
  const promptToast = useStore((s) => s.promptToast)
  const savedPrompt = useStore((s) => s.savedPrompt)
  const signup = mode === 'signup'

  const choose = async (p: 'github' | 'google') => {
    setErr('')
    setBusy(p)
    try {
      const r = await oauth(p)
      go(r.hasWorkspace ? 'app' : 'workspace')
    } catch (e) {
      setBusy(null)
      setErr(
        e instanceof NetworkError
          ? `Revolte could not reach ${p === 'github' ? 'GitHub' : 'Google'}. Check your connection, then try again.`
          : 'Something went wrong. Try again.',
      )
    }
  }

  return (
    <>
      <AuthShell
        title={signup ? 'Create your account' : 'Welcome back'}
        subtitle={signup ? 'Use GitHub, Google or any email.' : 'Sign in to continue where you left off.'}
        footer={signup}
      >
        {expired && (
          <Banner tone="info" title="Your session ended" icon={<InfoDot />}>
            Sessions last 14 days. Sign in again to pick up where you left off. Running workflows keep going.
          </Banner>
        )}
        {err && (
          <Banner tone="danger" title="Could not continue" icon={<DangerDot size={16} />}>
            {err}
          </Banner>
        )}
        <div className="stack-16" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button
            variant="outline"
            block
            loading={busy === 'github'}
            disabled={!!busy && busy !== 'github'}
            icon={<GithubMark />}
            onClick={() => choose('github')}
          >
            Continue with GitHub
          </Button>
          <Button
            variant="outline"
            block
            loading={busy === 'google'}
            disabled={!!busy && busy !== 'google'}
            icon={<GoogleMark />}
            onClick={() => choose('google')}
          >
            Continue with Google
          </Button>
          <Divider>or</Divider>
          <Button
            variant="outline"
            block
            disabled={!!busy}
            icon={<Icon name="mail" />}
            onClick={() => go(signup ? 'signup-email' : 'signin-email')}
          >
            Continue with email
          </Button>
        </div>
        <div className="link-row mt-24">
          {signup ? (
            <>
              Already have an account? <LinkButton onClick={() => go('signin')}>Sign in</LinkButton>
            </>
          ) : (
            <>
              New to Revolte? <LinkButton onClick={() => go('signup')}>Create an account</LinkButton>
            </>
          )}
        </div>
      </AuthShell>
      {signup && promptToast && savedPrompt && (
        <Toast
          title="Your request is saved"
          body={savedPrompt}
          onClose={() => setState({ promptToast: false })}
        />
      )}
    </>
  )
}
