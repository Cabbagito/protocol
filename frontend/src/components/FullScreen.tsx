import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '../hooks/useEscape'
import { useScrollLock } from '../hooks/useScrollLock'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

/**
 * An overlay that covers the whole screen, for long content (exercise
 * history, reorder). It reads like an inner page: its own copy of the shared
 * background, and chrome whose left button is an X that cancels (Escape too).
 * The content scrolls under the chrome; `footer` stays at the bottom.
 */
export function FullScreen({
  label,
  eyebrow,
  eyebrowColor,
  title,
  onClose,
  footer,
  children,
}: {
  label: string
  eyebrow: string
  eyebrowColor?: string
  title: string
  onClose: () => void
  footer?: ReactNode
  children: ReactNode
}) {
  useScrollLock(true)
  useEscape(true, onClose)

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 102,
        isolation: 'isolate',
        background: 'var(--deep)',
        color: 'var(--text-1)',
        display: 'flex',
        flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top)',
      }}
    >
      <div className="app-bg" aria-hidden="true" />
      <div
        style={{
          width: '100%',
          maxWidth: '32rem',
          margin: '0 auto',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '16px 22px 18px' }}>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: 36,
              height: 36,
              borderRadius: 12,
              background: 'var(--fill-soft)',
              border: '1px solid var(--line)',
              color: 'var(--text-2)',
              display: 'grid',
              placeItems: 'center',
              flex: 'none',
              cursor: 'pointer',
              padding: 0,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
          <div style={{ textAlign: 'center', minWidth: 0, padding: '0 8px' }}>
            <div
              style={{
                fontFamily: MONO,
                fontSize: 9,
                fontWeight: 500,
                letterSpacing: '0.22em',
                textTransform: 'uppercase',
                color: eyebrowColor ?? 'var(--text-m)',
              }}
            >
              {eyebrow}
            </div>
            <div
              className="p-display"
              style={{ fontSize: 18, marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
            >
              {title}
            </div>
          </div>
          <div style={{ width: 36, flex: 'none' }} />
        </div>

        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overscrollBehavior: 'contain',
            padding: `0 22px ${footer ? '24px' : 'calc(env(safe-area-inset-bottom) + 24px)'}`,
          }}
        >
          {children}
        </div>

        {footer && <div style={{ padding: '12px 22px calc(env(safe-area-inset-bottom) + 16px)' }}>{footer}</div>}
      </div>
    </div>,
    document.body,
  )
}
