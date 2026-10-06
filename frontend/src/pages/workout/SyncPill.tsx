import { getUserId } from '../../lib/auth'
import { useSyncStatus, workoutSync } from '../../lib/workoutSync'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

/**
 * Tiny sync indicator for the workout header. Everything is saved on the
 * phone first, so "offline" is informational, not an error.
 */
export function SyncPill() {
  const { state, pending, error } = useSyncStatus()

  let label: string
  let color: string
  let onClick: (() => void) | undefined
  if (state === 'error' && error) {
    label = 'Not synced · retry'
    color = '#fb7185'
    onClick = () => {
      const userId = getUserId()
      if (userId) workoutSync.retryRejected(userId)
    }
  } else if (pending > 0 && state === 'offline') {
    label = 'Offline · saved on phone'
    color = '#f59e0b'
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
