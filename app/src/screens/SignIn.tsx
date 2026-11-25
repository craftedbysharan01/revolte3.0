import { useEffect, useRef, useState } from 'react'
import { EMAIL_RE, NetworkError, lockedUntil, signIn } from '../api'
import { go, getState } from '../store'
import { DangerDot, GithubMark, InfoDot, WarnTriangle } from '../ui/Icon'
import { AuthShell, Banner, Button, Field, LinkButton, PasswordField, fmt, useCountdown } from '../ui/ui'
import { oauth } from '../api'

type Err =
  | null
  | { k: 'email_empty' | 'email_format' | 'pw_empty' }
  | { k: 'no_account' }
  | { k: 'wrong'; left: number }
  | { k: 'github' }
  | { k: 'offline' }

function initFor(preset: string | null) {
  const carry = getState().carryEmail
  const base = { email: carry, password: '', err: null as Err, busy: false, lockUntil: 0 }
  switch (preset) {
    case 'S02':
      return { ...base, email: '' }
    case 'S03':
      return { ...base, email: 'james@acmecorp.com', password: 'Revolte@2024x', busy: true }
    case 'S04':
      return { ...base, email: 'james@acmecorp.com', password: 'wrongpass1!', err: { k: 'wrong', left: 2 } as Err }
    case 'S05':
      return { ...base, email: 'james@acmecorp.com', password: 'wrongpass1!', lockUntil: Date.now() + 892_000 }
    case 'S06':
      return { ...base, email: 'james@acmecorp.co', password: 'Revolte@2024x', err: { k: 'no_account' } as Err }
    case 'S07':
      return { ...base, email: 'james@acmecorp', err: { k: 'email_format' } as Err }
    case 'S08':
      return { ...base, email: '', err: { k: 'email_empty' } as Err }
    case 'S09':
      return { ...base, email: 'github@acmecorp.com', password: 'secret', err: { k: 'github' } as Err }
  }
  const lock = carry ? lockedUntil(carry) : 0
  return { ...base, lockUntil: lock > Date.now() ? lock : 0 }
}

/** S02–S09 · Sign in with email */
export function SignIn({ preset }: { preset: string | null }) {
  const init = useRef(initFor(preset)).current
  const [email, setEmail] = useState(init.email)
  const [password, setPassword] = useState(init.password)
  const [err, setErr] = useState<Err>(init.err)
  const [busy, setBusy] = useState(init.busy)
  const [lockUntil, setLockUntil] = useState(init.lockUntil)
  const [ghBusy, setGhBusy] = useState(false)
  const left = useCountdown(lockUntil)
  const paused = lockUntil > 0 && left > 0
  const pwRef = useRef<HTMLInputElement>(null)
  const emailRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (lockUntil && left === 0) setLockUntil(0)
  }, [lockUntil, left])

  // S03 preview resolves back to the form after a moment so it is not a dead end.
  useEffect(() => {
    if (preset !== 'S03') return
    const t = setTimeout(() => setBusy(false), 2500)
    return () => clearTimeout(t)
  }, [preset])

  const change = (setter: (v: string) => void) => (v: string) => {
    setter(v)
    setErr(null)
  }

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy || paused) return
    // Lock may apply to the email being typed now.
    const lk = email ? lockedUntil(email) : 0
    if (lk > Date.now()) {
      setLockUntil(lk)
      return
    }
    if (!email.trim()) {
      setErr({ k: 'email_empty' })
      return emailRef.current?.focus()
    }
    if (!EMAIL_RE.test(email.trim())) {
      setErr({ k: 'email_format' })
      return emailRef.current?.focus()
    }
    if (!password) {
      setErr({ k: 'pw_empty' })
      return pwRef.current?.focus()
    }
    setErr(null)
    setBusy(true)
    try {
      const r = await signIn(email, password)
      if (r.ok) return go(r.hasWorkspace ? 'app' : 'workspace')
      setBusy(false)
      if (r.error === 'no_account') {
        setErr({ k: 'no_account' })
        emailRef.current?.focus()
      } else if (r.error === 'wrong_password') {
        setErr({ k: 'wrong', left: r.triesLeft })
        pwRef.current?.select()
      } else if (r.error === 'locked') setLockUntil(r.until)
      else setErr({ k: 'github' })
    } catch (e) {
      setBusy(false)
      if (e instanceof NetworkError) setErr({ k: 'offline' })
    }
  }

  const continueGithub = async () => {
    setGhBusy(true)
    try {
      const r = await oauth('github')
      go(r.hasWorkspace ? 'app' : 'workspace')
    } catch {
      setGhBusy(false)
      setErr({ k: 'offline' })
    }
  }

  const k = err?.k
  const emailErr =
    k === 'email_empty'
      ? 'Enter your email.'
      : k === 'email_format'
        ? 'Enter a valid email, like name@company.com.'
        : k === 'no_account'
          ? (
              <>
                No account uses this email. Check the spelling or{' '}
                <button type="button" className="inline" onClick={() => go('signup-email', { patch: { carryEmail: email } })}>
                  create an account
                </button>
                .
              </>
            )
          : null
  const pwErr =
    k === 'pw_empty'
      ? 'Enter your password.'
      : err?.k === 'wrong'
        ? `That password is not right. ${err.left} ${err.left === 1 ? 'try' : 'tries'} left before a 15-minute pause.`
        : null

  /* S09: this email signs in with GitHub */
  if (k === 'github') {
    return (
      <AuthShell title="Welcome back" subtitle="Sign in with your email and password." footer={false}>
        <Banner tone="info" title="This email signs in with GitHub" icon={<InfoDot />}>
          {email} has no password yet. Continue with GitHub, or set a password with Forgot password.
        </Banner>
        <Field label="Email address" icon="mail" value={email} onChange={change(setEmail)} type="email" />
        <Button block className="mt-16" loading={ghBusy} icon={<GithubMark />} onClick={continueGithub}>
          Continue with GitHub
        </Button>
        <div className="actions mt-24">
          <Button variant="secondary" onClick={() => setErr(null)}>
            Back
          </Button>
          <Button variant="outline" onClick={() => go('forgot', { patch: { carryEmail: email } })}>
            Forgot password
          </Button>
        </div>
        <div className="link-row mt-20">
          New to Revolte? <LinkButton onClick={() => go('signup')}>Create an account</LinkButton>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Welcome back" subtitle="Sign in with your email and password." footer={false}>
      <form onSubmit={submit} noValidate>
        {paused && (
          <Banner tone="warning" title="Sign in paused for 15 minutes" icon={<WarnTriangle />}>
            5 wrong passwords in a row. Try again after {fmt(left)}, or reset your password to sign in now.
          </Banner>
        )}
        {k === 'offline' && (
          <Banner tone="danger" title="Could not sign in" icon={<DangerDot size={16} />}>
            Revolte could not be reached. Check your connection, then select Sign in again.
          </Banner>
        )}
        <div className="stack-16">
          <Field
            ref={emailRef}
            label="Email address"
            icon="mail"
            type="email"
            value={email}
            autoComplete="email"
            disabled={busy || paused}
            onChange={change(setEmail)}
            error={emailErr}
            placeholder="Enter your email address"
          />
          <PasswordField
            ref={pwRef}
            label="Password"
            value={password}
            autoComplete="current-password"
            disabled={busy || paused}
            onChange={change(setPassword)}
            error={pwErr}
            placeholder="Enter your password"
          />
        </div>
        {!paused && (
          <div className="right-link">
            <LinkButton type="button" onClick={() => go('forgot', { patch: { carryEmail: email } })}>
              Forgot password?
            </LinkButton>
          </div>
        )}
        <div className="actions mt-24">
          <Button type="button" variant="secondary" onClick={() => go('signin')} disabled={busy}>
            Back
          </Button>
          {paused ? (
            <Button type="button" onClick={() => go('forgot', { patch: { carryEmail: email } })}>
              Reset password
            </Button>
          ) : (
            <Button type="submit" loading={busy}>
              Sign in
            </Button>
          )}
        </div>
        <div className="link-row mt-20">
          New to Revolte? <LinkButton type="button" onClick={() => go('signup')}>Create an account</LinkButton>
        </div>
      </form>
    </AuthShell>
  )
}
