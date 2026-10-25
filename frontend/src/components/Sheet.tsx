import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useEscape } from '../hooks/useEscape'
import { useScrollLock } from '../hooks/useScrollLock'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

/** The visual viewport, so a sheet's bottom stays above the iOS keyboard. */
function useVisualViewport(): { top: number; height: number } {
  const read = () => {
    const vv = window.visualViewport
    return vv ? { top: vv.offsetTop, height: vv.height } : { top: 0, height: window.innerHeight }
  }
  const [box, setBox] = useState(read)
  useEffect(() => {
    const vv = window.visualViewport
    if (!vv) return
    const update = () => setBox(read())
    vv.addEventListener('resize', update)
    vv.addEventListener('scroll', update)
    return () => {
      vv.removeEventListener('resize', update)
      vv.removeEventListener('scroll', update)
    }
  }, [])
  return box
}

/**
 * A bottom sheet on a scrim, for short forms and pickers. It can't be dragged:
 * it closes from the X in its `SheetHeader`, a tap on the scrim, or Escape,
 * and each of those cancels. Long content uses `FullScreen` instead.
 */
export function Sheet({
  open,
  onClose,
  label,
  children,
}: {
  open: boolean
  onClose: () => void
  label: string
  children: ReactNode
}) {
  useScrollLock(open)
  useEscape(open, onClose)
  const box = useVisualViewport()

  if (!open) return null
  return createPortal(
    <div
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        top: box.top,
        height: box.height,
        zIndex: 102,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <div
        aria-hidden="true"
        onClick={onClose}
        style={{ position: 'absolute', inset: 0, background: 'var(--scrim)', backdropFilter: 'blur(2px)' }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className="slide-up"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 520,
          margin: '0 auto',
          maxHeight: '92%',
          overflowY: 'auto',
          overscrollBehavior: 'contain',
          borderRadius: '22px 22px 0 0',
          background: 'var(--base)',
          borderTop: '1px solid var(--border)',
          padding: '20px 20px calc(env(safe-area-inset-bottom) + 20px)',
          boxSizing: 'border-box',
          color: 'var(--text-1)',
        }}
      >
        {children}
      </div>
    </div>,
    document.body,
  )
}

/**
 * A sheet's first row: an optional eyebrow over the title, anything else the
 * sheet needs under them (`children`), and the close button on the right.
 */
export function SheetHeader({
  title,
  eyebrow,
  eyebrowColor,
  onClose,
  children,
}: {
  title: ReactNode
  eyebrow?: ReactNode
  /** The eyebrow's colour and a dot before it, e.g. the muscle's. */
  eyebrowColor?: { dot: string; text: string }
  onClose: () => void
  children?: ReactNode
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        {eyebrow && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              marginBottom: 4,
              fontFamily: MONO,
              fontSize: 9,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: eyebrowColor?.text ?? 'var(--text-m)',
            }}
          >
            {eyebrowColor && (
              <span
                aria-hidden="true"
                style={{ width: 7, height: 7, borderRadius: '50%', background: eyebrowColor.dot, flex: 'none' }}
              />
            )}
            {eyebrow}
          </div>
        )}
        <div style={{ fontSize: 19, fontWeight: 600, letterSpacing: '-0.01em', color: 'var(--text-1)' }}>{title}</div>
        {children}
      </div>
      <CloseButton onClick={onClose} />
    </div>
  )
}

/** The round X that closes a sheet (or cancels an inline form). */
export function CloseButton({ onClick, label = 'Close' }: { onClick: () => void; label?: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      style={{
        width: 36,
        height: 36,
        borderRadius: '50%',
        background: 'var(--fill-strong)',
        border: 'none',
        color: 'var(--text-2)',
        display: 'grid',
        placeItems: 'center',
        flex: 'none',
        cursor: 'pointer',
        padding: 0,
      }}
    >
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.5}
        strokeLinecap="round"
        aria-hidden="true"
      >
        <path d="M18 6 6 18M6 6l12 12" />
      </svg>
    </button>
  )
}
