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
    if (open) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => { document.body.style.overflow = '' }
  }, [open])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50" onClick={onClose}>
      {/* Backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }}
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        className="absolute bottom-0 left-0 right-0 rounded-t-2xl pb-safe slide-up"
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(255,255,255,0.06)',
          borderBottom: 'none',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div
            className="w-9 h-1 rounded-full"
            style={{ background: 'rgba(255,255,255,0.15)' }}
          />
        </div>

        {title && (
          <div className="px-5 pb-2">
            <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-m)]">
              {title}
            </span>
          </div>
        )}

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
