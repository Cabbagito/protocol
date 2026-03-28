import { useEffect } from 'react'
import { SET_ANIM_CONFIG, type SetState } from './constants'

export function SavingButton({ state }: { state: SetState }) {
  const cfg = SET_ANIM_CONFIG[state === 'pending' ? 'logged' : state]
  return (
    <div className="w-9 h-9 relative">
      <svg className="absolute inset-0 w-full h-full" viewBox="0 0 36 36">
        <rect
          x="1.5" y="1.5" width="33" height="33" rx="7"
          fill="none"
          stroke={cfg.spinner}
          strokeWidth="2.5"
          pathLength={100}
          strokeDasharray="22 78"
          strokeLinecap="round"
          style={{ animation: 'set-saving-trace 0.9s linear infinite' }}
        />
      </svg>
    </div>
  )
}

export function CompletedButton({ state, onClick, animated, onAnimEnd }: {
  state: SetState
  onClick: () => void
  animated?: boolean
  onAnimEnd?: () => void
}) {
  const cfg = SET_ANIM_CONFIG[state === 'pending' ? 'logged' : state]

  useEffect(() => {
    if (!animated || !onAnimEnd) return
    const t = setTimeout(onAnimEnd, 600)
    return () => clearTimeout(t)
  }, [animated, onAnimEnd])

  return (
    <button
      onClick={onClick}
      className="w-9 h-9 rounded-lg flex items-center justify-center check-pop relative overflow-hidden"
      style={{ background: cfg.bg }}
    >
      {animated && (
        <span
          className="absolute inset-0 rounded-lg"
          style={{
            background: cfg.ripple,
            animation: 'set-success-ripple 0.45s forwards',
          }}
        />
      )}
      <svg className="w-4 h-4 relative z-10" viewBox="0 0 24 24" fill="none">
        <path
          d={cfg.iconPath}
          stroke="white"
          strokeWidth={cfg.strokeWidth}
          strokeLinecap="round"
          strokeLinejoin="round"
          {...(animated ? {
            strokeDasharray: 30,
            strokeDashoffset: 30,
            style: { animation: 'set-success-draw 0.28s 0.06s forwards' },
          } : {})}
        />
      </svg>
    </button>
  )
}
