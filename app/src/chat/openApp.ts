import { SANDBOX_APP } from './sandboxApp'

/** Opens the deployed app in a new browser tab (the prototype writes the built app into it). */
export function openApp() {
  const w = window.open('', '_blank')
  if (!w) return
  w.document.open()
  w.document.write(SANDBOX_APP)
  w.document.title = 'Webhook deliveries'
  w.document.close()
}
