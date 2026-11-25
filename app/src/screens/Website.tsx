import { useEffect, useRef, useState } from 'react'
import { go, getState, setState } from '../store'
import { Icon } from '../ui/Icon'
import { Logo, Toast } from '../ui/ui'

export const DEFAULT_PROMPT =
  'Build an internal dashboard to monitor webhook deliveries — list failed ones, retry them with backoff, and alert on-call after the last attempt.'

const EXAMPLES: Record<string, string> = {
  'Webhook monitor': DEFAULT_PROMPT,
  'Rate-limit an API':
    'Add rate limiting to our public REST API — per-key limits, a 429 response with Retry-After, and a dashboard of the heaviest callers.',
  'Deploy status page':
    'Build a public status page that shows the live deploy status of each service, with incident history and email subscriptions.',
}

/** U01 · Website: prompt typed, Start building */
export function Website() {
  const [text, setText] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [demo, setDemo] = useState(false)
  const typing = useRef(true)
  const ta = useRef<HTMLTextAreaElement>(null)

  // Type the example prompt once, the way the design shows it, unless the visitor takes over.
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      setText(DEFAULT_PROMPT)
      return
    }
    let i = 0
    const t = setInterval(() => {
      if (!typing.current) return clearInterval(t)
      i += 2
      setText(DEFAULT_PROMPT.slice(0, i))
      if (i >= DEFAULT_PROMPT.length) clearInterval(t)
    }, 16)
    return () => clearInterval(t)
  }, [])

  const takeOver = () => {
    typing.current = false
  }

  // The website is the logged-out front door: arriving here starts a fresh visit,
  // so both calls to action always lead to sign up, never straight into the product.
  useEffect(() => {
    if (getState().session) setState({ session: null })
  }, [])

  const startFree = () => go('signup', { patch: { savedPrompt: '', promptToast: false } })

  const startBuilding = () => {
    // Clicked while the example is still typing itself out: save the whole example, not a fragment.
    const prompt = (typing.current ? DEFAULT_PROMPT : text).trim()
    if (!prompt) {
      setInvalid(true)
      ta.current?.focus()
      setTimeout(() => setInvalid(false), 1800)
      return
    }
    // The request is saved now and follows the person through sign up, verify and
    // workspace setup, then waits in the first chat.
    go('signup', { patch: { savedPrompt: prompt, promptToast: true } })
  }

  return (
    <div className="site">
      <header className="site-nav">
        <a href="#/" aria-label="Revolte home">
          <Logo />
        </a>
        <nav className="site-links" aria-label="Primary">
          {['Product', 'Enterprise', 'Use cases', 'Docs', 'Pricing', 'Resources'].map((l) => (
            <a key={l} href="#/" onClick={(e) => e.preventDefault()}>
              {l}
            </a>
          ))}
        </nav>
        <div className="site-cta">
          <button className="text-btn" onClick={() => setDemo(true)}>
            Book a demo
          </button>
          <button className="btn coral-btn nav-start" style={{ borderRadius: 2 }} onClick={startFree}>
            Start Free
          </button>
        </div>
      </header>

      <i className="dots l" />
      <i className="dots r" />
      {[
        [87, 349, 5],
        [73, 456, 6],
        [165, 504, 6],
        [10, 551, 8],
        [1315, 349, 5],
        [1329, 456, 6],
        [1238, 504, 6],
        [1394, 551, 8],
        [1407, 384, 6],
      ].map(([x, y, s], i) => (
        <i key={i} className="sq" style={{ left: `calc(50% + ${x - 720}px)`, top: y, width: s, height: s }} />
      ))}

      <main className="hero">
        <span className="pill">
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path d="M6 0c.4 3.1 2.9 5.6 6 6-3.1.4-5.6 2.9-6 6-.4-3.1-2.9-5.6-6-6 3.100-.4 5.600-2.900 6-6Z" fill="currentColor" />
          </svg>
          AI for the entire software delivery lifecycle
        </span>
        <h1>
          From intent
          <span className="inline-ic" aria-hidden="true">
            <Icon name="arrowRight" size={20} />
          </span>
          production
          <br />
          You direct, <span className="serif">revolte</span> delivers.
        </h1>
        <p className="hero-sub">
          Revolte&apos;s AI agents run development, testing, deployment, and runtime operations end to end - while your
          engineers stay in control. Not a coding assistant. Not automation. Agentic delivery, governed.
        </p>

        <div className={`prompt ${invalid ? 'is-invalid' : ''}`}>
          <div className="prompt-top">
            <span className="lights" aria-hidden="true">
              <i />
              <i />
              <i />
            </span>
            <span>Grill → Plan → Build → Verify</span>
          </div>
          <label className="sr-only" htmlFor="intent">
            What should Revolte build?
          </label>
          <textarea
            id="intent"
            ref={ta}
            value={text}
            placeholder="Describe what to build or fix."
            onFocus={takeOver}
            onChange={(e) => {
              takeOver()
              setText(e.target.value)
              setInvalid(false)
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) startBuilding()
            }}
          />
          <div className="prompt-bottom">
            <div className="chips">
              {Object.keys(EXAMPLES).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => {
                    takeOver()
                    setText(EXAMPLES[k])
                    setInvalid(false)
                  }}
                >
                  {k}
                </button>
              ))}
            </div>
            <button className="btn coral-btn start-building" style={{ borderRadius: 2 }} onClick={startBuilding}>
              Start Building
            </button>
          </div>
        </div>
        <p className="hint" role="status">
          {invalid ? 'Describe what you want to build, or pick an example.' : ''}
        </p>

        <div className="hero-bottom">
          <div className="ph">
            <span className="medal">3</span>
            <span>
              <small>Product Hunt</small>
              <b>#3 Product of the Day</b>
            </span>
          </div>
          <button className="btn coral-btn start-free" style={{ borderRadius: 2 }} onClick={startFree}>
            Start Free
          </button>
        </div>
      </main>
      {demo && <Toast title="Book a demo" body="Demo booking is outside this onboarding prototype." onClose={() => setDemo(false)} />}
    </div>
  )
}
