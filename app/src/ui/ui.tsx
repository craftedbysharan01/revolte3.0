import {
  ButtonHTMLAttributes,
  ReactNode,
  forwardRef,
  InputHTMLAttributes,
  useEffect,
  useId,
  useRef,
  useState,
  ClipboardEvent,
  KeyboardEvent,
} from 'react'
import { DangerDot, Icon, IconName } from './Icon'
import { Rules, strength } from '../api'
import { useStore } from '../store'

export const Spinner = ({ size = 16 }: { size?: number }) => (
  <img src={`${import.meta.env.BASE_URL}assets/spinner.svg`} alt="" width={size} height={size} className="spin" />
)

export const Logo = ({ className = '' }: { className?: string }) => (
  <span className={`logo ${className}`} role="img" aria-label="Revolte">
    <img src={`${import.meta.env.BASE_URL}assets/logo.svg`} alt="" width={83.165} height={14.0614} />
  </span>
)

/* ---------- Button ---------- */

type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'outline'
  loading?: boolean
  block?: boolean
  icon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, BtnProps>(function Button(
  { variant = 'primary', loading, block, icon, children, className = '', disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={`btn btn-${variant} ${block ? 'btn-block' : ''} ${className}`}
      disabled={disabled}
      aria-busy={loading || undefined}
      {...rest}
      // loading keeps the label and blocks clicks (design system rule)
      onClick={loading ? (e) => e.preventDefault() : rest.onClick}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  )
})

export const LinkButton = ({
  children,
  disabled,
  className = '',
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) => (
  <button type="button" className={`link-btn ${className}`} disabled={disabled} {...rest}>
    {children}
  </button>
)

/* ---------- Field ---------- */

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> & {
  label: string
  optional?: boolean
  icon?: IconName
  value: string
  onChange: (v: string) => void
  error?: ReactNode
  helper?: ReactNode
  /** extra content on the right of the control (status, spinner) */
  status?: ReactNode
  /** show the show/hide eye for password fields */
  reveal?: boolean
  revealed?: boolean
  onReveal?: () => void
  /** show a clear (×) once filled */
  clearable?: boolean
  readOnlyMuted?: boolean
}

export const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  {
    label,
    optional,
    icon,
    value,
    onChange,
    error,
    helper,
    status,
    reveal,
    revealed,
    onReveal,
    clearable,
    className = '',
    disabled,
    ...rest
  },
  ref,
) {
  const id = useId()
  const msgId = `${id}-msg`
  return (
    <div className={`field ${className}`}>
      <label className="field-label" htmlFor={id}>
        {label}
        {optional && <span className="optional"> (optional)</span>}
      </label>
      <div className={`control ${error ? 'is-error' : ''} ${disabled ? 'is-disabled' : ''}`}>
        {icon && <Icon name={icon} size={16} className="control-icon" />}
        <input
          id={id}
          ref={ref}
          value={value}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || helper ? msgId : undefined}
          onChange={(e) => onChange(e.target.value)}
          {...rest}
        />
        {status}
        {clearable && value && !disabled && (
          <button type="button" className="icon-btn" aria-label="Clear" onClick={() => onChange('')}>
            <Icon name="x" size={14} />
          </button>
        )}
        {reveal && (
          <button
            type="button"
            className="icon-btn"
            aria-label={revealed ? 'Hide password' : 'Show password'}
            onClick={onReveal}
            disabled={disabled}
          >
            <Icon name={revealed ? 'eyeOff' : 'eye'} size={16} />
          </button>
        )}
      </div>
      {error ? (
        <div className="helper helper-error" id={msgId} role="alert">
          <DangerDot />
          <span>{error}</span>
        </div>
      ) : helper ? (
        <div className="helper" id={msgId}>
          {helper}
        </div>
      ) : null}
    </div>
  )
})

/** Password field with its own reveal toggle. */
export const PasswordField = forwardRef<HTMLInputElement, Omit<FieldProps, 'type' | 'icon' | 'reveal' | 'revealed' | 'onReveal'> & { startRevealed?: boolean }>(
  function PasswordField({ startRevealed, ...p }, ref) {
    const [shown, setShown] = useState(!!startRevealed)
    return (
      <Field
        ref={ref}
        {...p}
        type={shown ? 'text' : 'password'}
        icon="lock"
        reveal
        revealed={shown}
        onReveal={() => setShown((v) => !v)}
        autoComplete={p.autoComplete ?? 'off'}
      />
    )
  },
)

/* ---------- Password strength + rules ---------- */

const RULE_TEXT: [keyof Rules, string][] = [
  ['length', 'At least 12 characters'],
  ['number', 'A number'],
  ['symbol', 'A symbol'],
]

export function PasswordMeter({
  password,
  rules,
  showFailed,
}: {
  password: string
  rules: Rules
  /** Failed only after the user leaves the field or submits */
  showFailed: boolean
}) {
  const s = strength(password)
  const tone = s === 1 ? 'weak' : s === 2 ? 'fair' : s === 3 ? 'strong' : ''
  return (
    <div className="pw-meter">
      <div className="pw-bars" aria-hidden="true" data-tone={tone}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={i <= s ? 'on' : ''} />
        ))}
      </div>
      <ul className="pw-rules" aria-label="Password rules">
        {RULE_TEXT.map(([k, text]) => {
          const met = rules[k] && password.length > 0
          const failed = !met && showFailed
          return (
            <li key={k} className={met ? 'met' : failed ? 'failed' : 'pending'}>
              <span className="rule-ic">
                {met ? <Icon name="check" size={14} /> : failed ? <Icon name="x" size={14} /> : <i />}
              </span>
              <span>{text}</span>
              <span className="sr-only">{met ? 'met' : failed ? 'not met' : 'pending'}</span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

/* ---------- OTP ---------- */

export function OtpInput({
  value,
  onChange,
  onComplete,
  state,
  disabled,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  state: 'idle' | 'error' | 'success'
  disabled?: boolean
  autoFocus?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[Math.min(value.length, 5)]?.focus()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoFocus, disabled])

  const set = (next: string) => {
    const clean = next.replace(/\D/g, '').slice(0, 6)
    onChange(clean)
    if (clean.length === 6) onComplete?.(clean)
    return clean
  }

  const onKey = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      e.preventDefault()
      const next = digits[i] ? value.slice(0, i) + value.slice(i + 1) : value.slice(0, Math.max(0, i - 1)) + value.slice(i)
      onChange(next)
      refs.current[digits[i] ? i : Math.max(0, i - 1)]?.focus()
    } else if (e.key === 'ArrowLeft') refs.current[Math.max(0, i - 1)]?.focus()
    else if (e.key === 'ArrowRight') refs.current[Math.min(5, i + 1)]?.focus()
  }

  const onInput = (i: number, raw: string) => {
    let ins = raw.replace(/\D/g, '')
    if (!ins) return
    const prev = digits[i]
    // typing into a filled box yields two characters: keep the new one
    if (prev && ins.length === 2) ins = ins.replace(prev, '')
    // one digit replaces in place; several (autofill, paste) fill from this box onward
    const next = set(
      prev && ins.length === 1 ? value.slice(0, i) + ins + value.slice(i + 1) : value.slice(0, i) + ins,
    )
    refs.current[Math.min(5, i + ins.length, next.length)]?.focus()
  }

  const onPaste = (e: ClipboardEvent) => {
    e.preventDefault()
    const clean = set(e.clipboardData.getData('text'))
    refs.current[Math.min(5, clean.length)]?.focus()
  }

  return (
    <div className="otp" role="group" aria-label="6-digit code" onPaste={onPaste}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          className={`otp-box ${state}`}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          value={d}
          disabled={disabled}
          aria-label={`Digit ${i + 1}`}
          aria-invalid={state === 'error' || undefined}
          onChange={(e) => onInput(i, e.target.value)}
          onKeyDown={(e) => onKey(i, e)}
          onFocus={(e) => e.target.select()}
        />
      ))}
    </div>
  )
}

/* ---------- Banner ---------- */

export function Banner({
  tone,
  title,
  children,
  icon,
}: {
  tone: 'danger' | 'warning' | 'info'
  title: string
  children: ReactNode
  icon: ReactNode
}) {
  return (
    <div className={`banner banner-${tone}`} role={tone === 'info' ? 'status' : 'alert'}>
      <span className="banner-ic">{icon}</span>
      <div>
        <p className="banner-title">{title}</p>
        <p className="banner-body">{children}</p>
      </div>
    </div>
  )
}

/* ---------- saved request reminder ---------- */

/** Keeps the person's website request in view through every step, so the goal never gets lost. */
export function SavedRequest() {
  const prompt = useStore((s) => s.savedPrompt)
  const toastShowing = useStore((s) => s.promptToast && s.route === 'signup')
  if (!prompt || toastShowing) return null
  return (
    <div className="saved-req" role="note">
      <span className="toast-ic">
        <Icon name="check" size={12} />
      </span>
      <span className="saved-text">
        <b>Your request is saved</b>
        <span>{prompt}</span>
      </span>
    </div>
  )
}

/* ---------- Auth shell ---------- */

export function AuthShell({
  title,
  subtitle,
  children,
  footer = true,
  tile,
}: {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: boolean
  /** icon tile shown above the title instead of the logo header (reset screens) */
  tile?: ReactNode
}) {
  return (
    <main className="auth">
      <div className="auth-col">
        <Logo />
        {tile && <div className="tile-wrap">{tile}</div>}
        <h1 className={`auth-title ${tile ? 'with-tile' : ''}`}>{title}</h1>
        {subtitle && <p className="auth-sub">{subtitle}</p>}
        <div className="auth-body">{children}</div>
      </div>
      <SavedRequest />
      {footer && (
        <p className="auth-foot">
          By signing up, you agree to our <a href="#/">Terms</a> and <a href="#/">Privacy Policy</a>.
        </p>
      )}
    </main>
  )
}

export const Divider = ({ children }: { children: ReactNode }) => (
  <div className="or" role="separator">
    <span>{children}</span>
  </div>
)

/* ---------- countdown ---------- */

export function fmt(ms: number) {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

/** Remaining ms until `until`, re-rendering every second. */
export function useCountdown(until: number) {
  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    if (until <= Date.now()) return
    const t = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(t)
  }, [until])
  return Math.max(0, until - now)
}

/** A `until` timestamp helper that restarts when `restart()` is called. */
export function useCooldown(seconds: number, startActive = true) {
  const [until, setUntil] = useState(startActive ? Date.now() + seconds * 1000 : 0)
  const left = useCountdown(until)
  return { left, restart: () => setUntil(Date.now() + seconds * 1000), clear: () => setUntil(0) }
}

/* ---------- toast ---------- */

export function Toast({
  title,
  body,
  onClose,
  ms = 7000,
}: {
  title: string
  body?: string
  onClose: () => void
  ms?: number
}) {
  useEffect(() => {
    const t = setTimeout(onClose, ms)
    return () => clearTimeout(t)
  }, [ms, onClose])
  return (
    <div className="toast" role="status">
      <span className="toast-ic">
        <Icon name="check" size={14} />
      </span>
      <div className="toast-text">
        <p className="toast-title">{title}</p>
        {body && <p className="toast-body">{body}</p>}
      </div>
      <button className="icon-btn" aria-label="Dismiss" onClick={onClose}>
        <Icon name="x" size={14} />
      </button>
    </div>
  )
}
