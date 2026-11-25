import { SANDBOX_APP } from './sandboxApp'

const BAR = `<div style="display:flex;align-items:center;gap:8px;padding:8px 24px;border-bottom:1px solid #ffffff1f;font:12px/1.4 system-ui,sans-serif;color:#a1a1a8;background:#0b0b0c">
<span style="width:6px;height:6px;border-radius:99px;background:#3ecf6e;box-shadow:0 0 0 3px #3ecf6e33"></span>
<b style="color:#f7f6f3;font-weight:500">webhook-monitor.acme.revolte.app</b> · Live · deployed with Revolte</div>`

/** Opens the deployed app in a new browser tab (the prototype writes the built app into it). */
export function openApp(): boolean {
  const w = window.open('', '_blank')
  if (!w) return false
  w.document.open()
  w.document.write(SANDBOX_APP.replace('<body>', `<body style="padding:0"><!--live-->${BAR}<div style="padding:24px">`).replace('</body>', '</div></body>'))
  w.document.title = 'Webhook deliveries · Live'
  w.document.close()
  return true
}
