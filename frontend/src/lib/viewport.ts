/**
 * The app's full screen height, published as the CSS variable --screen-h.
 *
 * iOS 26+ home-screen apps that draw under the status bar (status-bar style
 * black-translucent + viewport-fit=cover) get a window one status-bar height
 * short whenever the page is not taller than that short window (WebKit bug
 * 301108): innerHeight, 100dvh and `bottom: 0` all end ~50-60px above the
 * screen edge and the strip below stays unpainted. Pages taller than the
 * window get the full screen, which is why the strip came and went with the
 * page. The document is therefore always at least the real screen tall
 * (`body` in index.css), measured here because no CSS unit reports it while
 * the bug is active.
 */

let probe: HTMLDivElement | null = null

function safeAreaTop(): number {
  if (!probe) {
    probe = document.createElement('div')
    probe.setAttribute('aria-hidden', 'true')
    probe.style.cssText =
      'position:fixed;top:0;left:0;width:0;visibility:hidden;pointer-events:none;height:env(safe-area-inset-top)'
    document.body.appendChild(probe)
  }
  return probe.offsetHeight
}

/** An installed iPhone/iPad home-screen app (iOS-only flag, never set on Android). */
function isIosStandalone(): boolean {
  return (navigator as Navigator & { standalone?: boolean }).standalone === true
}

/**
 * Height the app fills, in CSS px. Under the status bar in portrait that is
 * the whole screen (the keyboard overlays it); elsewhere the window height.
 */
export function fullScreenHeight(): number {
  const portrait = window.innerWidth < window.innerHeight
  if (isIosStandalone() && portrait && safeAreaTop() > 0) {
    return Math.max(window.innerHeight, window.screen.height)
  }
  return window.innerHeight
}

function apply() {
  const root = document.documentElement
  if (isIosStandalone()) root.style.setProperty('--screen-h', `${fullScreenHeight()}px`)
  else root.style.removeProperty('--screen-h') // CSS falls back to 100svh
}

/** Call once at startup, before the first render. */
export function installViewportHeight() {
  apply()
  window.addEventListener('resize', apply)
  window.addEventListener('orientationchange', apply)
  window.addEventListener('pageshow', apply)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') apply()
  })
}

/** Screen and window measurements, for the diagnostics line in Settings. */
export function viewportDiagnostics(): string {
  const vv = window.visualViewport
  const bottomProbe = document.createElement('div')
  bottomProbe.style.cssText =
    'position:fixed;bottom:0;left:0;width:0;visibility:hidden;height:env(safe-area-inset-bottom)'
  document.body.appendChild(bottomProbe)
  const insetBottom = bottomProbe.offsetHeight
  bottomProbe.remove()
  const parts = [
    `screen ${window.screen.width}×${window.screen.height}`,
    `window ${window.innerWidth}×${window.innerHeight}`,
    vv ? `visual ${Math.round(vv.height)}` : null,
    `app ${fullScreenHeight()}`,
    `insets ${safeAreaTop()}/${insetBottom}`,
    isIosStandalone() ? 'home screen' : 'browser',
  ]
  return parts.filter(Boolean).join(' · ')
}
