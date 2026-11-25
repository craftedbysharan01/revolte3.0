import { useEffect, useRef, useState } from 'react'
import { EMAIL_RE, NetworkError, requestReset } from '../api'
import { go, getState } from '../store'
import { DangerDot, Icon } from '../ui/Icon'
import { AuthShell, Banner, Button, Field, LinkButton, fmt, useCooldown } from '../ui/ui'

/** F01–F03 · Reset password: enter email, sending, check your email */
export function Forgot({ preset }: { preset: string | null }) {
  const [email, setEmail] = useState(preset === 'F03' || preset === 'F02' ? 'james@acmecorp.com' : getState().carryEmail)
  const [err, setErr] = useState<string | null>(null)
  const [busy, setBusy] = useState(preset === 'F02')
  const [sent, setSent] = useState(preset === 'F03')
  const [offline, setOffline] = useState(false)
  const [resending, setResending] = useState(false)
  const cool = useCooldown(60, preset === 'F03')
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (preset !== 'F02') return
    const t = setTimeout(() => setBusy(false), 2500)
    return () => clearTimeout(t)
  }, [preset])

  const send = async (isResend = false) => {
    if (busy || resending) return
    setOffline(false)
    if (!isResend) {
      if (!email.trim()) {
        setErr('Enter your email.')
        return ref.current?.focus()
      }
      if (!EMAIL_RE.test(email.trim())) {
        setErr('Enter a valid email, like name@company.com.')
        return ref.current?.focus()
      }
    }
    isResend ? setResending(true) : setBusy(true)
    try {
      await requestReset(email)
      setSent(true)
      cool.restart()
    } catch (e) {
      if (e instanceof NetworkError) setOffline(true)
    } finally {
      setBusy(false)
      setResending(false)
    }
  }

  if (sent) {
    return (
      <AuthShell
        title="Check your email"
        tile={
          <span className="tile">
            <Icon name="mail" size={20} />
          </span>
        }
        subtitle={
          <>
            We sent a reset link to <strong>{email}</strong>. It works for 30 minutes.
          </>
        }
        footer={false}
      >
        {offline && (
          <Banner tone="danger" title="Link not sent" icon={<DangerDot size={16} />}>
            Revolte could not be reached. Check your connection, then try again.
          </Banner>
        )}
        <Button block onClick={() => go('signin-email', { patch: { carryEmail: email } })}>
          Back to sign in
        </Button>
        <div className="link-row mt-24">
          Did not get it?{' '}
          {cool.left > 0 ? (
            <LinkButton disabled>Resend in {fmt(cool.left)}</LinkButton>
          ) : (
            <LinkButton className="strong" onClick={() => send(true)} disabled={resending}>
              {resending ? 'Sending…' : 'Resend link'}
            </LinkButton>
          )}
        </div>
        <div className="link-row">
          Wrong email?{' '}
          <LinkButton
            onClick={() => {
              setSent(false)
              setBusy(false)
            }}
          >
            Change
          </LinkButton>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell
      title="Reset your password"
      subtitle="Enter the email you use for Revolte. We will send a link to set a new password."
      footer={false}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault()
          send()
        }}
        noValidate
      >
        {offline && (
          <Banner tone="danger" title="Link not sent" icon={<DangerDot size={16} />}>
            Revolte could not be reached. Check your connection, then select Send reset link again.
          </Banner>
        )}
        <Field
          ref={ref}
          label="Email address"
          icon="mail"
          type="email"
          value={email}
          autoComplete="email"
          disabled={busy}
          onChange={(v) => {
            setEmail(v)
            setErr(null)
          }}
          error={err}
          placeholder="Enter your email address"
        />
        <Button type="submit" block className="mt-24" loading={busy}>
          Send reset link
        </Button>
        <div className="link-row mt-20">
          Remembered it?{' '}
          <LinkButton type="button" onClick={() => go('signin-email', { patch: { carryEmail: email } })}>
            Sign in
          </LinkButton>
        </div>
      </form>
    </AuthShell>
  )
}
