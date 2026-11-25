import { useEffect, useRef, useState } from 'react'
import { EMAIL_RE, NetworkError, USERNAME_RE, checkUsername, passwordRules, signUp } from '../api'
import { go, getState } from '../store'
import { DangerDot } from '../ui/Icon'
import { AuthShell, Banner, Button, Field, LinkButton, PasswordField, PasswordMeter } from '../ui/ui'

type UName = { s: 'idle' } | { s: 'checking' } | { s: 'ok' } | { s: 'taken'; suggestions: string[] }

type Init = {
  username: string
  email: string
  password: string
  submitted: boolean
  uname: UName
  emailTaken: boolean
  offline: boolean
  busy: boolean
  reveal: boolean
}

const BASE: Init = {
  username: '',
  email: '',
  password: '',
  submitted: false,
  uname: { s: 'idle' },
  emailTaken: false,
  offline: false,
  busy: false,
  reveal: false,
}

const STRONG = 'Revolte@2025x'

function initFor(preset: string | null): Init {
  const p = getState().pending
  switch (preset) {
    case 'U08':
      return BASE
    case 'U09':
      return { ...BASE, username: 'james-hall', email: 'james@acmecorp', uname: { s: 'ok' } }
    case 'U10':
      return { ...BASE, username: 'james', email: 'james@acmecorp.com', uname: { s: 'taken', suggestions: ['james-hall', 'james-acme'] } }
    case 'U11':
      return { ...BASE, username: 'james-hall', email: 'james@acmecorp.com', uname: { s: 'ok' }, password: 'rev!' }
    case 'U12':
      return { ...BASE, username: 'james-hall', email: 'james@acmecorp.com', uname: { s: 'ok' }, password: 'Revolte2025xyz' }
    case 'U13':
      return { ...BASE, username: 'james-hall', email: 'james@acmecorp.com', uname: { s: 'ok' }, password: STRONG, reveal: true }
    case 'U14':
      return { ...BASE, username: 'j', email: 'james@acmecorp', password: 'abc12', submitted: true }
    case 'U15':
      return { ...BASE, username: 'james-hall', email: 'james@acmecorp.com', password: STRONG, uname: { s: 'ok' }, submitted: true, emailTaken: true }
    case 'U16':
      return { ...BASE, username: 'james-hall', email: 'james@acmecorp.com', password: STRONG, uname: { s: 'ok' }, busy: true, submitted: true }
    case 'U17':
      return { ...BASE, username: 'james-hall', email: 'james@acmecorp.com', password: STRONG, uname: { s: 'ok' }, offline: true, submitted: true }
  }
  // coming back from "Wrong email? Change" keeps what was typed
  if (p) return { ...BASE, username: p.username, email: p.email, password: p.password, uname: { s: 'ok' } }
  return BASE
}

/** U08–U17 · Sign up with email */
export function SignUpEmail({ preset }: { preset: string | null }) {
  const init = useRef(initFor(preset)).current
  const [username, setUsername] = useState(init.username)
  const [email, setEmail] = useState(init.email)
  const [password, setPassword] = useState(init.password)
  const [uname, setUname] = useState<UName>(init.uname)
  const [submitted, setSubmitted] = useState(init.submitted)
  const [pwBlur, setPwBlur] = useState(false)
  const [emailTaken, setEmailTaken] = useState(init.emailTaken)
  const [offline, setOffline] = useState(init.offline)
  const [busy, setBusy] = useState(init.busy)
  const [uBlur, setUBlur] = useState(false)
  const [eBlur, setEBlur] = useState(false)
  const refs = { u: useRef<HTMLInputElement>(null), e: useRef<HTMLInputElement>(null), p: useRef<HTMLInputElement>(null) }
  const seq = useRef(0)

  // Presets render a state without running the live checks that would overwrite it.
  const skipCheck = useRef(preset !== null)

  // Debounced availability check as the username changes.
  useEffect(() => {
    if (skipCheck.current) {
      skipCheck.current = false
      return
    }
    if (!USERNAME_RE.test(username)) {
      setUname({ s: 'idle' })
      return
    }
    setUname({ s: 'checking' })
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await checkUsername(username)
        if (mine !== seq.current) return
        setUname(r.available ? { s: 'ok' } : { s: 'taken', suggestions: r.suggestions })
      } catch {
        if (mine === seq.current) setUname({ s: 'idle' }) // re-checked on submit
      }
    }, 400)
    return () => clearTimeout(t)
  }, [username])

  const rules = passwordRules(password)
  const allRules = rules.length && rules.number && rules.symbol

  const userErr =
    username === '' && submitted
      ? 'Enter a username.'
      : username !== '' && !USERNAME_RE.test(username) && (uBlur || submitted)
        ? 'Use 3 to 30 characters: letters, numbers, - or _.'
        : uname.s === 'taken'
          ? (
              <>
                {username} is taken. Try{' '}
                {uname.suggestions.map((s, i) => (
                  <span key={s}>
                    {i > 0 && ' or '}
                    <button type="button" className="inline" onClick={() => setUsername(s)}>
                      {s}
                    </button>
                  </span>
                ))}
                .
              </>
            )
          : null

  const emailErr = emailTaken ? (
    <>
      An account already uses this email.{' '}
      <button type="button" className="inline" onClick={() => go('signin-email', { patch: { carryEmail: email } })}>
        Sign in
      </button>{' '}
      instead, or use another email.
    </>
  ) : email === '' && submitted ? (
    'Enter your email.'
  ) : email !== '' && !EMAIL_RE.test(email) && (eBlur || submitted) ? (
    'Enter a valid email, like name@company.com.'
  ) : null

  const pwErr = submitted && !allRules ? (password === '' ? 'Enter a password.' : 'Password does not meet the rules below.') : null

  const userHelper =
    uname.s === 'ok' && !userErr ? `${username} is available` : uname.s === 'checking' ? 'Checking…' : null

  const submit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (busy) return
    setSubmitted(true)
    setOffline(false)
    setEmailTaken(false)
    const bad =
      !USERNAME_RE.test(username) || uname.s === 'taken'
        ? refs.u
        : !EMAIL_RE.test(email)
          ? refs.e
          : !allRules
            ? refs.p
            : null
    if (bad) {
      bad.current?.focus()
      return
    }
    setBusy(true)
    try {
      const r = await signUp({ username, email, password })
      if (r.ok) return go('verify')
      setBusy(false)
      if (r.error === 'email_registered') {
        setEmailTaken(true)
        refs.e.current?.focus()
      } else {
        setUname({ s: 'taken', suggestions: [`${username}-hall`, `${username}-acme`] })
        refs.u.current?.focus()
      }
    } catch (err) {
      setBusy(false)
      if (err instanceof NetworkError) setOffline(true)
    }
  }

  return (
    <AuthShell title="Create your account" subtitle="Enter your details to create an account.">
      <form onSubmit={submit} noValidate>
        {offline && (
          <Banner tone="danger" title="Account not created" icon={<DangerDot size={16} />}>
            Revolte could not be reached. Check your connection, then select Sign up again. Your details are kept.
          </Banner>
        )}
        <div className="stack-16">
          <Field
            ref={refs.u}
            label="Username"
            icon="user"
            value={username}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            disabled={busy}
            onChange={setUsername}
            onBlur={() => setUBlur(true)}
            error={userErr}
            helper={userHelper}
            placeholder="Choose a username"
          />
          <Field
            ref={refs.e}
            label="Email address"
            icon="mail"
            type="email"
            value={email}
            autoComplete="email"
            disabled={busy}
            onChange={(v) => {
              setEmail(v)
              setEmailTaken(false)
            }}
            onBlur={() => setEBlur(true)}
            error={emailErr}
            placeholder="name@company.com"
          />
          <div>
            <PasswordField
              ref={refs.p}
              label="Password"
              value={password}
              autoComplete="new-password"
              startRevealed={init.reveal}
              disabled={busy}
              onChange={setPassword}
              onBlur={() => setPwBlur(true)}
              error={pwErr}
              placeholder="Create a password"
            />
            {(password.length > 0 || submitted) && (
              <PasswordMeter password={password} rules={rules} showFailed={pwBlur || submitted} />
            )}
          </div>
        </div>
        <div className="actions mt-24">
          <Button type="button" variant="secondary" onClick={() => go('signup')} disabled={busy}>
            Back
          </Button>
          <Button type="submit" loading={busy}>
            Sign up
          </Button>
        </div>
        <div className="link-row mt-20">
          Already have an account?{' '}
          <LinkButton type="button" onClick={() => go('signin-email', { patch: { carryEmail: email } })}>
            Sign in
          </LinkButton>
        </div>
      </form>
    </AuthShell>
  )
}
