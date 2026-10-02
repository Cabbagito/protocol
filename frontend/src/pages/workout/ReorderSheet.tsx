import { useEffect, useState } from 'react'
import { getMuscleColor } from '../../lib/muscleColors'

export interface ReorderItem {
  exercise_id: string
  exercise_name: string
  muscle_group: string
}

interface ReorderSheetProps {
  /** Eyebrow above the title, e.g. "Push A · Week 3". */
  subtitle: string
  exercises: ReorderItem[]
  saving: boolean
  onSave: (exerciseIds: string[]) => void
  onClose: () => void
}

/**
 * Reorder-only sheet for the workout's exercise list. The order is edited
 * locally with up/down arrows and persisted once, on Done. The last moved
 * row stays highlighted so repeated taps keep their place. Tapping the
 * backdrop discards the changes.
 */
export function ReorderSheet({ subtitle, exercises, saving, onSave, onClose }: ReorderSheetProps) {
  const [order, setOrder] = useState(exercises)
  const [lastMoved, setLastMoved] = useState<string | null>(null)

  useEffect(() => {
    const scrollEl = document.querySelector<HTMLElement>('[data-main-scroll]')
    if (scrollEl) scrollEl.style.overflow = 'hidden'
    return () => { if (scrollEl) scrollEl.style.overflow = '' }
  }, [])

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta
    const moving = order[index]
    const displaced = order[target]
    if (!moving || !displaced) return
    const next = [...order]
    next[index] = displaced
    next[target] = moving
    setOrder(next)
    setLastMoved(moving.exercise_id)
  }

  const changed = order.some((ex, i) => ex.exercise_id !== exercises[i]?.exercise_id)

  const handleDone = () => {
    if (!changed) {
      onClose()
      return
    }
    onSave(order.map(ex => ex.exercise_id))
  }

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 102,
        display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
      }}
    >
      <button
        type="button"
        aria-label="Cancel reorder"
        onClick={onClose}
        style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          border: 'none', cursor: 'default',
        }}
      />
      <div
        role="dialog"
        aria-label="Reorder exercises"
        className="slide-up"
        style={{
          position: 'relative',
          width: '100%', maxWidth: 480, margin: '0 auto',
          maxHeight: '85vh', overflowY: 'auto',
          background: 'var(--card)',
          borderRadius: '24px 24px 0 0',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 -20px 50px rgba(0,0,0,0.5)',
          padding: '10px 16px calc(env(safe-area-inset-bottom) + 24px)',
        }}
      >
        <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.16)', margin: '0 auto' }} />

        <div style={{ marginTop: 14, padding: '0 4px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
          <div>
            <div
              style={{
                fontSize: 9, color: 'var(--text-m)', letterSpacing: '0.22em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 500,
                textTransform: 'uppercase',
              }}
            >
              {subtitle}
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
                fontStyle: 'italic', fontSize: 24, color: 'var(--text-1)', marginTop: 2,
              }}
            >
              Reorder
            </div>
          </div>
          <button
            type="button"
            onClick={handleDone}
            disabled={saving}
            style={{
              height: 40, padding: '0 18px', borderRadius: 11,
              background: 'rgba(var(--accent-rgb),0.14)',
              border: '1px solid rgba(var(--accent-rgb),0.35)',
              color: 'var(--accent-l)', fontSize: 13, fontWeight: 600,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
            }}
          >
            {saving ? 'Saving…' : 'Done'}
          </button>
        </div>

        <div style={{ marginTop: 18, display: 'flex', flexDirection: 'column', gap: 8 }}>
          {order.map((ex, i) => {
            const c = getMuscleColor(ex.muscle_group)
            const highlighted = ex.exercise_id === lastMoved
            return (
              <div
                key={ex.exercise_id}
                style={{
                  minHeight: 64, padding: '0 8px 0 12px', borderRadius: 14,
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: highlighted
                    ? `color-mix(in oklab, ${c.primary} 9%, transparent)`
                    : 'rgba(255,255,255,0.03)',
                  border: `1px solid ${highlighted
                    ? `color-mix(in oklab, ${c.primary} 45%, transparent)`
                    : 'rgba(255,255,255,0.06)'}`,
                  transition: 'background 0.2s, border-color 0.2s',
                }}
              >
                <span
                  style={{
                    width: 3, height: 36, borderRadius: 2, flexShrink: 0,
                    background: `linear-gradient(180deg, ${c.primary}, ${c.light})`,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0, paddingLeft: 8 }}>
                  <div
                    style={{
                      fontSize: 14, fontWeight: 600, color: 'var(--text-1)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}
                  >
                    {ex.exercise_name}
                  </div>
                  <div
                    style={{
                      marginTop: 3, fontSize: 9, letterSpacing: '0.14em', color: 'var(--text-m)',
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace', textTransform: 'uppercase',
                    }}
                  >
                    {String(i + 1).padStart(2, '0')} · {ex.muscle_group}
                  </div>
                </div>
                <ArrowButton
                  label={`Move ${ex.exercise_name} up`}
                  direction="up"
                  disabled={i === 0 || saving}
                  onClick={() => move(i, -1)}
                />
                <ArrowButton
                  label={`Move ${ex.exercise_name} down`}
                  direction="down"
                  disabled={i === order.length - 1 || saving}
                  onClick={() => move(i, 1)}
                />
              </div>
            )
          })}
        </div>

        <p style={{ margin: '16px 6px 0', fontSize: 12, lineHeight: 1.5, color: 'var(--text-m)' }}>
          The new order carries over to the rest of this mesocycle.
        </p>
      </div>
    </div>
  )
}

function ArrowButton({ label, direction, disabled, onClick }: {
  label: string
  direction: 'up' | 'down'
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 44, height: 44, flexShrink: 0, borderRadius: 11,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        color: 'var(--text-2)',
        display: 'grid', placeItems: 'center', padding: 0,
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.25 : 1,
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points={direction === 'up' ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
      </svg>
    </button>
  )
}
