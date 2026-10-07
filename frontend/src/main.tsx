import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { ToastProvider } from './components/Toast'
import App from './App'
import './index.css'

// ── Service worker updates ─────────────────────────────────────────
// A new deploy's service worker activates on its own (see vite.config.ts).
// The running page keeps its code until it reloads, which happens:
//   - right away if the update arrived while the app was starting up
//     (a cold start — nothing is in progress yet), or
//   - the next time the app goes to the background.
// Workout changes are saved on the phone first, so a reload never loses
// data. iOS standalone PWAs rarely check for updates on their own, so we
// check whenever the app comes back to the foreground.
const STARTUP_WINDOW_MS = 8000
const bootedAt = Date.now()

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const wasControlled = !!navigator.serviceWorker.controller
  let reloadWhenHidden = false

  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!wasControlled) return // first install, not an update
    if (Date.now() - bootedAt < STARTUP_WINDOW_MS) window.location.reload()
    else reloadWhenHidden = true
  })

  navigator.serviceWorker.register('/sw.js', { scope: '/' }).then((registration) => {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        registration.update().catch(() => {
          // offline — try again next time
        })
      } else if (reloadWhenHidden) {
        window.location.reload()
      }
    })
  }).catch(() => {
    // no service worker: the app still works online
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <ToastProvider>
        <App />
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>,
)
