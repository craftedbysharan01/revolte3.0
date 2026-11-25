import { useEffect, useRef, useState } from 'react'
import { MAX_CODE_TRIES, NetworkError, resendCode, verifyCode } from '../api'
import { go, getState } from '../store'
import { DangerDot } from '../ui/Icon'
import {
  AuthShell,
  Banner,
  Button,
  LinkButton,
  OtpInput,
  Spinner,
  fmt,
  useCooldown,
  useCountdown,
} from '../ui/ui'

type Phase = 'idle' | 'verifying' | 'wrong' | 'expired' | 'success' | 'locked'

const FALLBACK_EMAIL = 'james@acmecorp.com'

function initial(preset: string | null) {
  const p = getState().pending
  let phase: Phase = 'idle'
  let code = ''
  let triesLeft = MAX_CODE_TRIES
  let lockUntil = 0
  let cooldown = true
  switch (preset) {
    case 'U19':
      code = '670'
      break
    case 'U20':
      code = '670381'
      phase = 'verifying'
      break
    case 'U21':
      code = '670318'
      phase = 'wrong'
      triesLeft = 4
      break
    case 'U22':
      code = '670381'
      phase = 'expired'
      break
    case 'U23':
      break
    case 'U24':
      phase = 'locked'
      lockUntil = Date.now() + 892_000
      break
    case 'U25':
      code = '670381'
      phase = 'success'
      break
    default:
      if (p && p.lockUntil > Date.now()) {
        phase = 'locked'
        lockUntil = p.lockUntil
      }
  }
  return { phase, code, triesLeft, lockUntil, cooldown }
}

/** U18–U25 · Verify email */
export function Verify({ preset }: { preset: string | null }) {
  // Captured once: a correct code clears the pending signup, which must not bounce this screen.
  const pending = useRef(getState().pending).current
  const email = pending?.email ?? FALLBACK_EMAIL
  const init = useRef(initial(preset)).current
  const [code, setCode] = useState(init.code)
  const [phase, setPhase] = useState<Phase>(init.phase)
  const [triesLeft, setTriesLeft] = useState(init.triesLeft)
  const [lockUntil, setLockUntil] = useState(init.lockUntil)
  const [net, setNet] = useState(false)
  const [sending, setSending] = useState(false)
  const [busyKey, setBusyKey] = useState(0)
  const cool = useCooldown(59, init.cooldown && preset !== 'U24')
  const lockLeft = useCountdown(lockUntil)
  const locked = phase === 'locked' && lockLeft > 0
  const aliveRef = useRef(true)

  useEffect(() => {
    aliveRef.current = true
    return () => {
      aliveRef.current = false
    }
  }, [])

  // The pause ends by itself when the countdown reaches zero.
  useEffect(() => {
    if (phase === 'locked' && lockUntil && lockLeft === 0) {
      setPhase('idle')
      setCode('')
      setTriesLeft(MAX_CODE_TRIES)
    }
  }, [phase, lockUntil, lockLeft])

  // Success hands off to workspace setup.
  useEffect(() => {
    if (phase !== 'success') return
    const t = setTimeout(() => go('workspace'), 1500)
    return () => clearTimeout(t)
  }, [phase])

  // Guard: nothing to verify and not a design preview.
  useEffect(() => {
    if (!pending && !preset) go('signup')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (value: string) => {
    if (phase === 'verifying' || locked || value.length < 6) return
    setNet(false)
    setPhase('verifying')
    try {
      const r = await verifyCode(value)
      if (!aliveRef.current) return
      if (r.ok) return setPhase('success')
      if (r.error === 'wrong') {
        setTriesLeft(r.triesLeft)
        setPhase('wrong')
      } else if (r.error === 'expired') {
        setPhase('expired')
        cool.restart() // a fresh code was just sent
        setBusyKey((k) => k + 1)
      } else {
        setLockUntil(r.until)
        setPhase('locked')
        setCode('')
      }
    } catch (e) {
      if (!aliveRef.current) return
      setPhase('idle')
      if (e instanceof NetworkError) setNet(true)
    }
  }

  const resend = async () => {
    setSending(true)
    setNet(false)
    try {
      await resendCode()
      if (!aliveRef.current) return
      setCode('')
      setPhase('idle')
      setLockUntil(0)
      setTriesLeft(MAX_CODE_TRIES)
      cool.restart()
      setBusyKey((k) => k + 1) // refocus first box
    } catch (e) {
      if (e instanceof NetworkError) setNet(true)
    } finally {
      if (aliveRef.current) setSending(false)
    }
  }

  const boxState = phase === 'wrong' || phase === 'expired' ? 'error' : phase === 'success' ? 'success' : 'idle'
  const verifying = phase === 'verifying'
  const resendWaiting = locked ? lockLeft : cool.left

  return (
    <AuthShell
      title="Verify your email"
      subtitle={
        <>
          Enter the 6-digit code sent to <strong>{email}</strong>.
        </>
      }
    >
      {locked && (
        <Banner tone="danger" title="Code entry paused for 15 minutes" icon={<DangerDot size={16} />}>
          {MAX_CODE_TRIES} wrong codes in a row. Request a new code after {fmt(lockLeft)}, or change the email.
        </Banner>
      )}
      <OtpInput
        key={busyKey}
        value={code}
        autoFocus={!locked && phase !== 'success'}
        disabled={locked || verifying || phase === 'success'}
        state={boxState}
        onChange={(v) => {
          setCode(v)
          if (phase === 'wrong' || phase === 'expired') setPhase('idle')
        }}
        onComplete={submit}
      />

      {phase === 'wrong' && (
        <p className="status-line error" role="alert">
          <DangerDot />
          That code is not right. {triesLeft} {triesLeft === 1 ? 'try' : 'tries'} left.
        </p>
      )}
      {phase === 'expired' && (
        <p className="status-line error" role="alert">
          <DangerDot />
          This code expired after 10 minutes. We sent a new one.
        </p>
      )}
      {net && (
        <p className="status-line error" role="alert">
          <DangerDot />
          Could not reach Revolte. Check your connection and try again.
        </p>
      )}

      {phase === 'success' ? (
        <p className="status-line" role="status">
          <Spinner size={14} /> Email verified. Setting up your workspace.
        </p>
      ) : (
        <>
          <Button
            block
            className="mt-16"
            loading={verifying}
            disabled={code.length < 6 || locked}
            onClick={() => submit(code)}
          >
            Verify
          </Button>
          <div className="link-row mt-24">
            Did not get the code?{' '}
            {resendWaiting > 0 ? (
              <LinkButton disabled>
                {locked ? `Resend at ${fmt(resendWaiting)}` : `Resend in ${fmt(resendWaiting)}`}
              </LinkButton>
            ) : (
              <LinkButton className="strong" onClick={resend} disabled={sending}>
                {sending ? 'Sending…' : 'Resend code'}
              </LinkButton>
            )}
          </div>
          <div className="link-row">
            Wrong email? <LinkButton onClick={() => go('signup-email')}>Change</LinkButton>
          </div>
        </>
      )}
    </AuthShell>
  )
}
