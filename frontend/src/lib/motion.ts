// ─── Motion (animated background) preference ──────────────────────
// Persists to localStorage and writes data-motion on <html>. Kept in
// sync with the blocking <script> in index.html.
// ──────────────────────────────────────────────────────────────────

export const MOTION_IDS = ['aurora', 'pulse', 'still', 'none'] as const
export type MotionId = (typeof MOTION_IDS)[number]
export const DEFAULT_MOTION: MotionId = 'aurora'

const STORAGE_KEY = 'protocol_motion'

function prefersReducedMotion(): boolean {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false
  } catch {
    return false
  }
}

export function getSavedMotion(): MotionId {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && MOTION_IDS.includes(stored as MotionId)) return stored as MotionId
  } catch {
    // localStorage blocked
  }
  return DEFAULT_MOTION
}

export function applyMotion(id: MotionId): void {
  // OS-level reduced-motion overrides whatever the user picked
  const effective: MotionId = prefersReducedMotion() ? 'still' : id
  document.documentElement.setAttribute('data-motion', effective)
  try {
    localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // localStorage blocked
  }
}

export function initMotion(): void {
  applyMotion(getSavedMotion())
}
