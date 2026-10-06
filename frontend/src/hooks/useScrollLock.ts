import { useEffect } from 'react'

// The document itself is the app's scroll container (there is no inner
// scrolling <main>), so locking means hiding overflow on <html> and <body>.
// Ref-counted so stacked overlays (a sheet opening a scanner, ...) don't
// unlock each other early.
let lockCount = 0
let saved: { html: string; body: string } | null = null

function lock() {
  lockCount += 1
  if (lockCount > 1) return
  const html = document.documentElement
  saved = { html: html.style.overflow, body: document.body.style.overflow }
  html.style.overflow = 'hidden'
  document.body.style.overflow = 'hidden'
}

function unlock() {
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount > 0 || !saved) return
  document.documentElement.style.overflow = saved.html
  document.body.style.overflow = saved.body
  saved = null
}

/** Prevent the page behind an overlay from scrolling while `active`. */
export function useScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return
    lock()
    return unlock
  }, [active])
}
