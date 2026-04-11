import { useEffect, useRef } from 'react'

interface BottomSheetAction {
  label: string
  icon?: React.ReactNode
  onClick: () => void
  variant?: 'default' | 'danger'
}

interface BottomSheetProps {
  open: boolean
  onClose: () => void
  title?: string
  actions: BottomSheetAction[]
}

export default function BottomSheet({ open, onClose, title, actions }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>('[data-main-scroll]')
    if (open) {
      if (scrollEl) scrollEl.style.overflow = 'hidden'
    } else {
      if (scrollEl) scrollEl.style.overflow = ''
    }
    return () => { if (scrollEl) scrollEl.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-[102] flex items-center justify-center px-4" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      />

      {/* Popup */}
      <div
        ref={sheetRef}
        className="relative w-full max-w-sm rounded-2xl flex flex-col slide-up"
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 pt-4 pb-2 flex items-center justify-between">
          {title && (
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-m)]">
              {title}
            </span>
          )}
          {!title && <span />}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Actions */}
        <div className="px-3 pb-4">
          {actions.map((action, i) => (
            <button
              key={i}
              onClick={() => {
                action.onClick()
                onClose()
              }}
              className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-left active:scale-[0.98] transition-transform"
              style={{
                color: action.variant === 'danger' ? '#f87171' : 'var(--text-1)',
              }}
            >
              {action.icon && (
                <span className="w-5 h-5 flex-shrink-0 opacity-70">{action.icon}</span>
              )}
              <span className="text-[15px] font-medium">{action.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
