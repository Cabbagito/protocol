import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { registerSW } from 'virtual:pwa-register'
import { ToastProvider } from './components/Toast'
import App from './App'
import './index.css'

// ── Service worker updates ─────────────────────────────────────────
// A new deploy installs in the background and waits; it is never forced on
// the user mid-task. It is applied (skipWaiting + reload):
//   - right away if it was found while the app was starting up (a cold
//     start — nothing is in progress yet), or
//   - the next time the app goes to the background (visibility → hidden).
// iOS standalone PWAs rarely check for updates on their own, so we also
// check whenever the app comes back to the foreground.
const STARTUP_WINDOW_MS = 8000
const bootedAt = Date.now()
let updateWaiting = false

const updateSW = registerSW({
  onNeedRefresh() {
    updateWaiting = true
    if (Date.now() - bootedAt < STARTUP_WINDOW_MS) updateSW(true)
  },
  onRegisteredSW(_swUrl: string, registration: ServiceWorkerRegistration | undefined) {
    if (!registration) return
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {
          // offline — try again next time
        })
      }
    })
  },
})

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden' && updateWaiting) {
    updateWaiting = false
    updateSW(true)
  }
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
