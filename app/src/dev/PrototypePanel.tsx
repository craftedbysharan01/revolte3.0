import { VALID_CODE } from '../api'
import { go, resetPrototype, setState, useStore } from '../store'
import { GROUPS } from './states'

/**
 * Review tool, not product UI. Jump to any state in the Figma file, flip failure
 * switches, and read the mock inbox (verification codes, reset links).
 */
export function PrototypePanel() {
  const open = useStore((s) => s.panelOpen)
  const net = useStore((s) => s.net)
  const mail = useStore((s) => s.mailbox)
  const route = useStore((s) => s.route)

  const flip = (k: keyof typeof net) => setState((s) => ({ net: { ...s.net, [k]: !s.net[k] } }))

  return (
    <>
      <button className="pp-btn" aria-expanded={open} onClick={() => setState({ panelOpen: !open })}>
        <i /> Prototype{net.offline ? ' · offline' : ''}
      </button>
      {open && (
        <div className="pp" role="region" aria-label="Prototype controls">
          <h3>Onboarding prototype</h3>
          <p className="lead">Jump to any Figma state, or trigger real failures with the switches.</p>

          <section>
            <h4>Simulate</h4>
            <label className="toggle">
              <input type="checkbox" checked={net.offline} onChange={() => flip('offline')} />
              Network offline (any request fails)
            </label>
            <label className="toggle">
              <input type="checkbox" checked={net.failWorkspace} onChange={() => flip('failWorkspace')} />
              Server error when creating workspace
            </label>
            <label className="toggle">
              <input type="checkbox" checked={net.failGithub} onChange={() => flip('failGithub')} />
              GitHub connect fails (Get started, chat)
            </label>
<label className="toggle">
              <input type="checkbox" checked={net.failTests} onChange={() => flip('failTests')} />
              Tests keep failing (3 attempts, then you choose)
            </label>
            <label className="toggle">
              <input type="checkbox" checked={net.failSandbox} onChange={() => flip('failSandbox')} />
              Sandbox does not start
            </label>
            <label className="toggle">
              <input type="checkbox" checked={net.noCredits} onChange={() => flip('noCredits')} />
              Out of credits mid-run
            </label>
            <label className="toggle">
              <input type="checkbox" checked={!!net.noHours} onChange={() => flip('noHours')} />
              Sandbox hours used up
            </label>
          </section>

          <section>
            <h4>Inbox (mock)</h4>
            {mail.length === 0 && <p className="kv">No email yet. Sign up or reset a password.</p>}
            {mail.slice(0, 3).map((m) => (
              <div className="mail" key={m.id}>
                {m.kind === 'code' ? (
                  <>
                    To {m.to}: verification code <code>{m.code}</code>
                  </>
                ) : (
                  <>
                    To {m.to}: password reset link
                    <br />
                    <button
                      onClick={() => {
                        go('reset', { patch: { resetToken: m.token, carryEmail: m.to } })
                      }}
                    >
                      Open reset link
                    </button>
                  </>
                )}
              </div>
            ))}
          </section>

          <section>
            <h4>Test data</h4>
            <p className="kv">
              Registered: <code>james@acmecorp.com</code> / <code>Revolte@2024x</code>
            </p>
            <p className="kv">
              GitHub-only: <code>github@acmecorp.com</code>
            </p>
            <p className="kv">
              Taken usernames: <code>james</code>, <code>admin</code>
            </p>
            <p className="kv">
              Taken URLs: <code>acme</code>, <code>revolte</code>
            </p>
            <p className="kv">
              Code: <code>{VALID_CODE}</code> · expired: <code>000000</code> · other digits are wrong (5 tries)
            </p>
          </section>

          {GROUPS.map((g) => (
            <section key={g.title}>
              <h4>{g.title}</h4>
              <div className="states">
                {g.states.map((st) => (
                  <button
                    key={st.id}
                    className="state"
                    onClick={() => {
                      // route guard bypass: presets render design states directly
                      go(st.route, { preset: st.id, patch: typeof st.patch === 'function' ? st.patch() : st.patch })
                    }}
                  >
                    <code>{st.id}</code>
                    {st.label}
                  </button>
                ))}
              </div>
            </section>
          ))}

          <section>
            <button
              className="reset"
              onClick={() => {
                resetPrototype()
              }}
            >
              Reset prototype data
            </button>
            <p className="kv" style={{ marginTop: 6 }}>
              Current route: <code>{route}</code>
            </p>
          </section>
        </div>
      )}
    </>
  )
}
