import type { SyncStatus } from '../lib/workoutSync'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

/** The offline colour of sync indicators and notes. */
export const OFFLINE_COLOR = '#f59e0b'

/**
 * Tiny sync indicator under a screen's title (workout, meal). Everything is
 * saved on the phone first, so "offline" is informational, not an error.
 */
export function SyncPill({
  status: { state, pending, error },
  onRetry,
}: {
  status: Pick<SyncStatus, 'state' | 'pending' | 'error'>
  onRetry: () => void
}) {
  let label: string
  let color: string
  let onClick: (() => void) | undefined
  if (state === 'error' && error) {
    label = 'Not synced · retry'
    color = '#fb7185'
    onClick = onRetry
  } else if (pending > 0 && state === 'offline') {
    label = 'Offline · saved on phone'
    color = OFFLINE_COLOR
  } else if (pending > 0) {
    label = 'Syncing…'
    color = 'var(--text-m)'
  } else {
    label = 'Synced'
    color = 'var(--text-m)'
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      aria-live="polite"
      title={error ?? undefined}
      style={{
        marginTop: 3,
        display: 'inline-flex', alignItems: 'center', gap: 5,
        padding: 0, background: 'transparent', border: 'none',
        fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em', textTransform: 'uppercase',
        color, cursor: onClick ? 'pointer' : 'default',
      }}
    >
      <span
        aria-hidden="true"
        style={{ width: 5, height: 5, borderRadius: 999, background: 'currentColor', opacity: 0.9 }}
      />
      {label}
    </button>
  )
}
