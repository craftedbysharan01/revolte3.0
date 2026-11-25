import { useRef, useState } from 'react'
import { NetworkError, passwordRules, requestReset, resetPassword, resetTokenState } from '../api'
import { go, getState, setState } from '../store'
import { DangerDot, Icon } from '../ui/Icon'
import { AuthShell, Banner, Button, LinkButton, PasswordField, PasswordMeter } from '../ui/ui'

const EMAIL = 'james@acmecorp.com'
const STRONG = 'Revolte@2025x'

type View = 'form' | 'expired' | 'done'

function initFor(preset: string | null) {
  const email = getState().carryEmail || EMAIL
  switch (preset) {
    case 'F05':
      return { email, pw: STRONG, confirm: 'Revolte@2025y', submitted: true, view: 'form' as View, err: 'mismatch' as const }
    case 'F06':
      return { email, pw: 'Revolte@2024x', confirm: 'Revolte@2024x', submitted: true, view: 'form' as View, err: 'reused' as const }
    case 'F07':
      return { email, pw: '', confirm: '', submitted: false, view: 'expired' as View, err: null }
    case 'F08':
      return { email, pw: '', confirm: '', submitted: false, view: 'done' as View, err: null }
    case 'F04':
      return { email, pw: '', confirm: '', submitted: false, view: 'form' as View, err: null }
  }
  // arriving from the emailed link
  const token = getState().resetToken
  return {
    email,
    pw: '',
    confirm: '',
    submitted: false,
    view: (resetTokenState(token) === 'valid' ? 'form' : 'expired') as View,
    err: null,
  }
}

/** F04–F08 · Set a new password */
export function Reset({ preset }: { preset: string | null }) {
  const init = useRef(initFor(preset)).current
  const [pw, setPw] = useState(init.pw)
  const [confirm, setConfirm] = useState(init.confirm)
  const [view, setView] = useState<View>(init.view)
  const [submitted, setSubmitted] = useState(init.submitted)
  const [pwBlur, setPwBlur] = useState(false)
  const [reused, setReused] = useState(init.err === 'reused')
  const [mismatch, setMismatch] = useState(init.err === 'mismatch')
  const [busy, setBusy] = useState(false)
  const [offline, setOffline] = useState(false)
  const [resending, setResending] = useState(false)
  const email = init.email
  const pwRef = useRef<HTMLInputElement>(null)
  const cfRef = useRef<HTMLInputElement>(null)

  const rules = passwordRules(pw)
  const allRules = rules.length && rules.number && rules.symbol

  const pwErr = reused
    ? 'You used this password before. Choose a new one.'
    : submitted && !allRules
      ? pw
        ? 'Password does not meet the rules below.'
        : 'Enter a new password.'
      : null
  const cfErr = mismatch
    ? 'Passwords do not match. Check both fields.'
    : submitted && !confirm && allRules
      ? 'Confirm your new password.'
      : null

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (busy) return
    setSubmitted(true)
    setOffline(false)
    if (!allRules) return pwRef.current?.focus()
    if (!confirm) return cfRef.current?.focus()
    if (pw !== confirm) {
      setMismatch(true)
      return cfRef.current?.focus()
    }
    setBusy(true)
    try {
      const r = await resetPassword(email, getState().resetToken ?? '', pw)
      setBusy(false)
      if (r.ok) return setView('done')
      if (r.error === 'reused') {
        setReused(true)
        pwRef.current?.focus()
      } else setView('expired')
    } catch (err) {
      setBusy(false)
      if (err instanceof NetworkError) setOffline(true)
    }
  }

  const sendNew = async () => {
    setResending(true)
    try {
      await requestReset(email)
      go('forgot', { preset: 'F03', patch: { carryEmail: email } })
    } catch {
      setResending(false)
      setOffline(true)
    }
  }

  if (view === 'expired') {
    return (
      <AuthShell
        title="This link expired"
        tile={
          <span className="tile warning">
            <Icon name="clock" size={20} />
          </span>
        }
        subtitle={
          <>
            Reset links work for 30 minutes and only once. Send a new one to <strong>{email}</strong>.
          </>
        }
        footer={false}
      >
        {offline && (
          <Banner tone="danger" title="Link not sent" icon={<DangerDot size={16} />}>
            Revolte could not be reached. Check your connection, then try again.
          </Banner>
        )}
        <Button block loading={resending} onClick={sendNew}>
          Send a new link
        </Button>
        <div className="link-row mt-20">
          <LinkButton onClick={() => go('signin-email', { patch: { carryEmail: email } })}>Back to sign in</LinkButton>
        </div>
      </AuthShell>
    )
  }

  if (view === 'done') {
    return (
      <AuthShell
        title="Password updated"
        tile={
          <span className="tile success">
            <Icon name="check" size={20} />
          </span>
        }
        subtitle="You are signed out on other devices. Sign in with your new password."
        footer={false}
      >
        <Button
          block
          onClick={() => {
            setState({ resetToken: null })
            go('signin-email', { patch: { carryEmail: email } })
          }}
        >
          Sign in
        </Button>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Set a new password"
      subtitle={
        <>
          For <strong>{email}</strong>
        </>
      }
      footer={false}
    >
      <form onSubmit={submit} noValidate>
        {offline && (
          <Banner tone="danger" title="Password not updated" icon={<DangerDot size={16} />}>
            Revolte could not be reached. Check your connection, then select Update password again.
          </Banner>
        )}
        <div>
          <PasswordField
            ref={pwRef}
            label="New password"
            value={pw}
            autoComplete="new-password"
            disabled={busy}
            onChange={(v) => {
              setPw(v)
              setReused(false)
              setMismatch(false)
            }}
            onBlur={() => setPwBlur(true)}
            error={pwErr}
            placeholder="Create a new password"
          />
          {(pw.length > 0 || submitted) && <PasswordMeter password={pw} rules={rules} showFailed={pwBlur || submitted} />}
        </div>
        <div className="mt-16">
          <PasswordField
            ref={cfRef}
            label="Confirm password"
            value={confirm}
            autoComplete="new-password"
            disabled={busy}
            onChange={(v) => {
              setConfirm(v)
              setMismatch(false)
            }}
            error={cfErr}
            placeholder="Repeat the new password"
          />
        </div>
        <Button type="submit" block className="mt-24" loading={busy}>
          Update password
        </Button>
      </form>
    </AuthShell>
  )
}
