import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { EMAIL_RE, NetworkError, SLUG_RE, checkSlug, createWorkspace } from '../api'
import { go, getState } from '../store'
import { DangerDot, Icon, WarnTriangle } from '../ui/Icon'
import { Banner, Button, Field, SavedRequest, Spinner } from '../ui/ui'

type SlugState =
  | { s: 'idle' }
  | { s: 'checking' }
  | { s: 'available' }
  | { s: 'taken'; suggestions: string[] }
  | { s: 'invalid' }
  | { s: 'failed' }

type Stage = 'form' | 'creating' | 'failed' | 'provision' | 'ready'

const MAX_INVITES = 2 // free plan: 3 people including the owner
const slugify = (n: string) => n.toLowerCase().replace(/[^a-z0-9]/g, '')
const titleCase = (u: string) =>
  u
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ')

function initFor(preset: string | null) {
  const s = getState()
  const acct = s.accounts.find((a) => a.email === s.session?.email)
  // Design previews use the Figma sample name; real sessions derive it from the username.
  const name0 = acct && !preset ? titleCase(acct.username) : 'James Hall'
  const base = {
    name: name0,
    slug: slugify(name0),
    slugTouched: false,
    slugState: { s: 'idle' } as SlugState,
    invites: [] as string[],
    inviteText: '',
    inviteError: '',
    stage: 'form' as Stage,
    nameBlur: false,
    failMsg: 'server' as 'server' | 'offline',
  }
  const okSlug = { slugState: { s: 'available' } as SlugState }
  switch (preset) {
    case 'W01':
      return { ...base, slugState: { s: 'checking' } as SlugState }
    case 'W02':
      return { ...base, ...okSlug }
    case 'W03':
      return { ...base, slug: 'acme', slugTouched: true, slugState: { s: 'taken', suggestions: ['acme-corp', 'acme-hq'] } as SlugState }
    case 'W04':
      return { ...base, slug: 'james hall!', slugTouched: true, slugState: { s: 'invalid' } as SlugState }
    case 'W05':
      return { ...base, name: '', slug: 'jameshall', nameBlur: true, ...okSlug }
    case 'W06':
      return { ...base, slugState: { s: 'failed' } as SlugState }
    case 'W07':
      return { ...base, ...okSlug, invites: ['arjun@acmecorp.com', 'meera@acmecorp.com'] }
    case 'W08':
      return { ...base, ...okSlug, invites: ['arjun@acmecorp.com'], inviteText: 'meera@acmecorp', inviteError: 'meera@acmecorp is not a valid email. Fix it or remove it.' }
    case 'W09':
      return { ...base, ...okSlug, invites: ['arjun@acmecorp.com', 'meera@acmecorp.com', 'dev@acmecorp.com'] }
    case 'W10':
      return { ...base, ...okSlug, invites: ['arjun@acmecorp.com', 'meera@acmecorp.com'], stage: 'creating' as Stage }
    case 'W11':
      return { ...base, ...okSlug, invites: ['arjun@acmecorp.com', 'meera@acmecorp.com'], stage: 'failed' as Stage }
    case 'W12':
      return { ...base, ...okSlug, stage: 'provision' as Stage }
    case 'W13':
      return { ...base, ...okSlug, stage: 'ready' as Stage }
  }
  return base
}

function Backdrop() {
  return (
    <div className="skel" aria-hidden="true">
      <div className="sb">
        <i className="bar" style={{ width: 80 }} />
        <i className="bar pill-b" />
        {[120, 150, 96, 112, 130, 100, 118, 140].map((w, i) => (
          <i key={i} className="bar" style={{ width: w }} />
        ))}
        <i className="bar" style={{ width: 64, marginTop: 28 }} />
        {[180, 160, 190, 150].map((w, i) => (
          <i key={i} className="bar" style={{ width: w }} />
        ))}
      </div>
      <div className="main" />
      <div className="content">
        {[300, 260, 200, 0, 300, 250, 180].map((w, i) => (w ? <i key={i} className="bar" style={{ width: w }} /> : <br key={i} />))}
      </div>
    </div>
  )
}

/** W01–W13 · Workspace setup */
export function Workspace({ preset }: { preset: string | null }) {
  const init = useRef(initFor(preset)).current
  const [name, setName] = useState(init.name)
  const [slug, setSlug] = useState(init.slug)
  const [slugTouched, setSlugTouched] = useState(init.slugTouched)
  const [slugState, setSlugState] = useState<SlugState>(init.slugState)
  const [invites, setInvites] = useState(init.invites)
  const [inviteText, setInviteText] = useState(init.inviteText)
  const [inviteError, setInviteError] = useState(init.inviteError)
  const [stage, setStage] = useState<Stage>(init.stage)
  const [nameBlur, setNameBlur] = useState(init.nameBlur)
  const [failMsg, setFailMsg] = useState<'server' | 'offline'>(init.failMsg)
  const [retryTick, setRetryTick] = useState(0)
  const seq = useRef(0)
  const skip = useRef(preset !== null)
  const mirror = useRef<HTMLSpanElement>(null)
  const [slugW, setSlugW] = useState(40)
  const alive = useRef(true)

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
    }
  }, [])

  // Name drives the URL until the person edits the URL themselves.
  const onName = (v: string) => {
    setName(v)
    if (!slugTouched) setSlug(slugify(v))
  }

  // Live URL check.
  useEffect(() => {
    if (skip.current) {
      skip.current = false
      return
    }
    if (!slug) return setSlugState({ s: 'idle' })
    if (!SLUG_RE.test(slug)) return setSlugState({ s: 'invalid' })
    setSlugState({ s: 'checking' })
    const mine = ++seq.current
    const t = setTimeout(async () => {
      try {
        const r = await checkSlug(slug)
        if (mine !== seq.current) return
        setSlugState(r.status === 'available' ? { s: 'available' } : { s: 'taken', suggestions: r.suggestions })
      } catch {
        if (mine === seq.current) setSlugState({ s: 'failed' })
      }
    }, 450)
    return () => clearTimeout(t)
  }, [slug, retryTick])

  // Size the slug input to its text so ".revolte.ai" follows what is typed.
  useLayoutEffect(() => {
    if (mirror.current) setSlugW(Math.max(6, mirror.current.offsetWidth + 2))
  }, [slug])

  // Provision → ready → open the first chat.
  useEffect(() => {
    if (stage === 'provision') {
      const t = setTimeout(() => setStage('ready'), 1800)
      return () => clearTimeout(t)
    }
    if (stage === 'ready') {
      const t = setTimeout(() => go('app'), 1700)
      return () => clearTimeout(t)
    }
  }, [stage])

  // W10 preview resolves to the failure after a moment.
  useEffect(() => {
    if (preset !== 'W10') return
    const t = setTimeout(() => setStage('failed'), 2200)
    return () => clearTimeout(t)
  }, [preset])

  /* ----- invites ----- */
  const commitInvites = (raw: string) => {
    const tokens = raw
      .split(/[,\s;]+/)
      .map((t) => t.trim())
      .filter(Boolean)
    if (!tokens.length) return true
    const next = [...invites]
    let firstBad = ''
    const keep: string[] = []
    for (const t of tokens) {
      const e = t.toLowerCase()
      if (EMAIL_RE.test(e)) {
        if (!next.includes(e)) next.push(e)
      } else {
        if (!firstBad) firstBad = t
        keep.push(t)
      }
    }
    setInvites(next)
    if (firstBad) {
      setInviteText(keep.join(', '))
      setInviteError(`${firstBad} is not a valid email. Fix it or remove it.`)
      return false
    }
    setInviteText('')
    setInviteError('')
    return true
  }

  const over = invites.length > MAX_INVITES
  const nameErr = nameBlur && !name.trim() ? 'Enter a workspace name.' : null
  const slugBlocked = slugState.s !== 'available'
  const canCreate = !!name.trim() && !slugBlocked && !inviteError && !over

  const create = async () => {
    if (!commitInvites(inviteText) || !canCreate || stage === 'creating') return
    setStage('creating')
    try {
      await createWorkspace({ name: name.trim(), slug, invites })
      if (alive.current) setStage('provision')
    } catch (e) {
      if (!alive.current) return
      setFailMsg(e instanceof NetworkError ? 'offline' : 'server')
      setStage('failed')
    }
  }

  /* ----- provisioning / ready ----- */
  if (stage === 'provision' || stage === 'ready') {
    const ready = stage === 'ready'
    return (
      <div className="ws">
        <Backdrop />
        <div className="setup bare" role="status" aria-live="polite">
          <span className="tile round" style={{ width: 48, height: 48 }}>
            <img src="/assets/submark.svg" alt="" width={21.1738} height={14.2337} />
          </span>
          <h1>{ready ? 'Your workspace is ready' : 'Creating your workspace'}</h1>
          <span className="url-chip">
            <Icon name="globe" size={14} />
            {slug}.revolte.ai
          </span>
          <p className="status-pill">
            <Spinner />
            {ready
              ? getState().savedPrompt
                ? 'Opening your first chat with your request'
                : 'Opening your first chat'
              : 'This takes a few seconds'}
          </p>
        </div>
        <SavedRequest />
      </div>
    )
  }

  const busy = stage === 'creating'
  const failed = stage === 'failed'

  const slugTrailing =
    slugState.s === 'checking' ? (
      <Spinner size={14} />
    ) : slugState.s === 'available' ? (
      <span className="status-ok" aria-label="Available">
        <svg width="16" height="16" viewBox="0 0 16 16">
          <circle cx="8" cy="8" r="8" fill="currentColor" />
          <path d="m4.6 8.2 2.3 2.3 4.5-4.6" fill="none" stroke="#0b2b1b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    ) : slugState.s === 'failed' ? (
      <span className="status-warn">
        <WarnTriangle size={16} />
      </span>
    ) : slug ? (
      <button type="button" className="icon-btn" aria-label="Clear URL" onClick={() => { setSlugTouched(true); setSlug('') }}>
        <Icon name="x" size={14} />
      </button>
    ) : null

  const slugErr =
    slugState.s === 'taken' ? (
      `${slug}.revolte.ai is taken.`
    ) : slugState.s === 'invalid' ? (
      'Use lowercase letters, numbers and hyphens, 3 to 30 characters.'
    ) : slugState.s === 'failed' ? (
      <>
        Could not check this URL. Check your connection, then{' '}
        <button type="button" className="inline" onClick={() => setRetryTick((t) => t + 1)}>
          try again
        </button>
        .
      </>
    ) : null

  const inviteMsg = inviteError ? (
    inviteError
  ) : over ? (
    <>
      Free plan workspaces have 3 people, you included. Remove an invite, or{' '}
      <button type="button" className="upgrade" onClick={() => alert('Upgrade is outside this onboarding prototype.')}>
        upgrade
      </button>{' '}
      to add more.
    </>
  ) : null

  return (
    <div className="ws">
      <Backdrop />
      <section className="setup" aria-labelledby="setup-h">
        <span className="tile">
          <Icon name="users" size={20} />
        </span>
        <h1 id="setup-h">Set up your workspace</h1>
        <p className="sub">This is the last step before work begins.</p>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            create()
          }}
          noValidate
        >
          {failed && (
            <Banner tone="danger" title="Workspace not created" icon={<DangerDot size={16} />}>
              {failMsg === 'offline'
                ? 'Revolte could not be reached. Check your connection. Your details are kept. Try again in a moment.'
                : 'A server error stopped the setup. Your details are kept. Try again in a moment.'}
            </Banner>
          )}

          <Field
            label="Workspace name"
            value={name}
            placeholder="Acme Corp"
            disabled={busy}
            autoFocus={!preset}
            onChange={onName}
            onBlur={() => setNameBlur(true)}
            error={nameErr}
          />

          <div className="field">
            <label className="field-label" htmlFor="ws-slug">
              Workspace URL
            </label>
            <div className={`control ${slugErr ? 'is-error' : ''} ${busy ? 'is-disabled' : ''}`}>
              <Icon name="globe" size={16} className="control-icon" />
              <div className="slug-input">
                <span className="mirror" ref={mirror} aria-hidden="true">
                  {slug}
                </span>
                <input
                  id="ws-slug"
                  value={slug}
                  disabled={busy}
                  style={{ width: slugW }}
                  autoCapitalize="none"
                  autoComplete="off"
                  spellCheck={false}
                  aria-invalid={slugErr ? true : undefined}
                  aria-describedby="slug-msg"
                  onChange={(e) => {
                    setSlugTouched(true)
                    setSlug(e.target.value)
                  }}
                />
                <span className="suffix">.revolte.ai</span>
              </div>
              {slugTrailing}
            </div>
            {slugErr && (
              <div className="helper helper-error" id="slug-msg" role="alert">
                <DangerDot />
                <span>{slugErr}</span>
              </div>
            )}
            {slugState.s === 'taken' && (
              <div className="suggest">
                Try
                {slugState.suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => {
                      setSlugTouched(true)
                      setSlug(s)
                    }}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <Field
              label="Invite your team"
              optional
              icon="mail"
              value={inviteText}
              placeholder="Add emails, separated by commas"
              disabled={busy}
              error={inviteMsg}
              onChange={(v) => {
                setInviteError('')
                if (/[,;]\s*$/.test(v)) commitInvites(v)
                else setInviteText(v)
              }}
              onBlur={() => commitInvites(inviteText)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  if (inviteText.trim()) commitInvites(inviteText)
                  else create()
                }
                if (e.key === 'Backspace' && !inviteText && invites.length) setInvites(invites.slice(0, -1))
              }}
              onPaste={(e) => {
                const t = e.clipboardData.getData('text')
                if (/[,\s;]/.test(t.trim())) {
                  e.preventDefault()
                  commitInvites(inviteText + ' ' + t)
                }
              }}
            />
            {invites.length > 0 && (
              <ul className="invite-chips" aria-label="People to invite" style={{ listStyle: 'none', padding: 0, margin: '8px 0 0' }}>
                {invites.map((m) => (
                  <li key={m} className="chip">
                    {m}
                    <button
                      type="button"
                      aria-label={`Remove ${m}`}
                      onClick={() => {
                        setInvites(invites.filter((x) => x !== m))
                      }}
                      disabled={busy}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <Button type="submit" block loading={busy} disabled={!canCreate && !busy}>
            {failed ? 'Try again' : 'Create workspace'}
          </Button>
        </form>
      </section>
      <SavedRequest />
    </div>
  )
}
