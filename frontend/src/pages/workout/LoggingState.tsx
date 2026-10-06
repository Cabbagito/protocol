import { useEffect, useState } from 'react'
import NumeralsCard from '../../components/NumeralsCard'
import MuscleAccent from '../../components/MuscleAccent'
import { getMuscleColor } from '../../lib/muscleColors'
import { SET_TYPE_LABELS, STRAIGHT_PILL } from '../../lib/setConstants'
import type { SessionExercise, SetTarget } from '../../lib/workoutSession'
import type { SetType } from '../../types'
import { NoteIcon, RemoveIcon, SkipIcon, SwapIcon } from './icons'

/* State A — logging the current exercise (same shell once it's complete,
 * with a "Next exercise" CTA). */

type SetTypeOption = { value: SetType; label: string; badge: string; color: string; bg: string; border: string }

const SET_TYPE_NAMES: Record<SetType, string> = {
  straight: 'Straight',
  myorep: 'Myorep',
  myorep_match: 'Myorep match',
}

function setTypeOptions(setNum: number): SetTypeOption[] {
  // myorep_match is meaningless on the first set — it must reference a prior set.
  const types: SetType[] = setNum > 1 ? ['straight', 'myorep', 'myorep_match'] : ['straight', 'myorep']
  return types.map(value => {
    const info = SET_TYPE_LABELS[value]
    return {
      value,
      label: SET_TYPE_NAMES[value],
      badge: info?.label ?? 'ST',
      color: info?.color ?? STRAIGHT_PILL.color,
      bg: info?.bg ?? STRAIGHT_PILL.bg,
      border: info?.border ?? STRAIGHT_PILL.border,
    }
  })
}

interface LoggingStateProps {
  exercise: SessionExercise
  activeIdx: number
  /** Last time's value for each set (same order as exercise.sets). */
  targets: SetTarget[]
  /** One-line summary of last time, e.g. "3×10 @ 60kg". */
  lastSummary: string | null
  isBodyweight: boolean
  note: string | null
  onEditNote: () => void
  onWeight: (idx: number, value: number) => void
  onReps: (idx: number, value: number) => void
  onLog: (idx: number, weight: number, reps: number) => void
  onAddSet: () => void
  onChipTap: (idx: number) => void
  onSetType: (idx: number, type: SetType) => void
  onSkipSet: (idx: number) => void
  onRemoveSet: (idx: number) => void
  onOpenHistory: () => void
  onAdvanceExercise: () => void
  hasNextExercise: boolean
  onSwapExercise: () => void
  onSkipExercise: () => void
  onRemoveExercise: () => void
  /** A server-side change is in flight; block input. */
  busy: boolean
}

export function LoggingState({
  exercise, activeIdx, targets, lastSummary, isBodyweight, note, onEditNote,
  onWeight, onReps, onLog, onAddSet, onChipTap, onSetType, onSkipSet, onRemoveSet,
  onOpenHistory, onAdvanceExercise, hasNextExercise,
  onSwapExercise, onSkipExercise, onRemoveExercise, busy,
}: LoggingStateProps) {
  const c = getMuscleColor(exercise.muscle_group)
  const activeSet = exercise.sets[activeIdx]!
  const target = targets[activeIdx] ?? { weight: null, reps: null }

  // Set-type menu: opened by tapping the already-selected chip. Keyed by
  // exercise + set so it closes on its own when the selection moves.
  const activeKey = `${exercise.exercise_id}:${activeIdx}`
  const [typeMenuFor, setTypeMenuFor] = useState<string | null>(null)
  const typeMenuOpen = typeMenuFor === activeKey

  // Remove exercise carries over to the rest of the mesocycle, so it needs a
  // second tap within a few seconds.
  const [confirmRemoveFor, setConfirmRemoveFor] = useState<string | null>(null)
  const confirmRemove = confirmRemoveFor === exercise.exercise_id
  useEffect(() => {
    if (!confirmRemoveFor) return
    const t = setTimeout(() => setConfirmRemoveFor(null), 3000)
    return () => clearTimeout(t)
  }, [confirmRemoveFor])

  // What LOG will record: typed values, else last time's (the grey targets).
  const weight = activeSet.weight ?? target.weight ?? (isBodyweight ? 0 : null)
  const reps = activeSet.reps ?? target.reps
  const isLogValid = weight != null && reps != null && reps > 0 && (weight > 0 || isBodyweight)
  const isActiveLogged = activeSet.logged
  const isActiveSkipped = activeSet.skipped
  const allDone = exercise.sets.every(s => s.logged || s.skipped)
  const currentSetType: SetType = activeSet.set_type ?? 'straight'
  const lastChipIdx = exercise.sets.length - 1
  const loggedCount = exercise.sets.filter(s => s.logged).length

  // LOG button label adapts to what the user is doing.
  const logLabel = isActiveLogged ? 'UPDATE' : 'LOG'

  const stripButton: React.CSSProperties = {
    height: 56,
    background: 'transparent',
    border: 'none',
    borderRight: '1px solid rgba(255,255,255,0.07)',
    color: 'var(--text-2)',
    display: 'grid', placeItems: 'center',
    padding: 0,
    cursor: 'pointer',
  }

  return (
    <div style={{ marginTop: 28, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
        <MuscleAccent group={exercise.muscle_group} variant="dot" />
      </div>
      <div
        style={{
          fontSize: 36, fontWeight: 700,
          color: 'var(--text-1)',
          lineHeight: 1.05, letterSpacing: '-0.025em',
          padding: '0 12px',
          filter: `drop-shadow(0 0 28px color-mix(in oklab, ${c.primary} 45%, transparent))`,
        }}
      >
        {exercise.exercise_name}
      </div>
      {allDone && (
        <div
          style={{
            fontSize: 11, color: c.light, marginTop: 8, letterSpacing: '0.22em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            textTransform: 'uppercase', fontWeight: 600,
          }}
        >
          Exercise complete
        </div>
      )}

      {/* Exercise note — shown inline, tap to edit */}
      <button
        type="button"
        onClick={onEditNote}
        style={{
          marginTop: 8, maxWidth: '100%',
          display: 'inline-flex', alignItems: 'center', gap: 7,
          minHeight: 36, padding: '4px 10px',
          background: 'transparent', border: 'none',
          color: note ? 'var(--text-2)' : 'var(--text-m)',
          fontSize: 13, fontStyle: note ? 'italic' : 'normal',
          cursor: 'pointer',
        }}
      >
        <NoteIcon />
        <span
          style={{
            borderBottom: '1px dotted rgba(148,163,184,0.4)',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}
        >
          {note ?? 'Add note'}
        </span>
      </button>

      <div style={{ marginTop: 16 }}>
        <NumeralsCard
          group={exercise.muscle_group}
          weight={activeSet.weight}
          reps={activeSet.reps}
          weightTarget={target.weight ?? (isBodyweight ? 0 : null)}
          repsTarget={target.reps}
          weightLabel={isBodyweight ? 'WEIGHT · BW' : 'WEIGHT'}
          setNum={activeIdx + 1}
          totalSets={exercise.sets.length}
          lastSummary={lastSummary}
          onLastClick={onOpenHistory}
          onWeightChange={(n) => onWeight(activeIdx, n)}
          onRepsChange={(n) => onReps(activeIdx, n)}
          onLog={() => { if (isLogValid && weight != null && reps != null) onLog(activeIdx, weight, reps) }}
          disabled={busy || !isLogValid}
          logLabel={logLabel}
          // A logged set can't be skipped; a skipped one can always be unskipped.
          onSkipSet={!isActiveLogged || isActiveSkipped ? () => onSkipSet(activeIdx) : undefined}
          setSkipped={isActiveSkipped}
          onRemoveSet={exercise.sets.length > 1 ? () => onRemoveSet(activeIdx) : undefined}
        />
      </div>

      {/* Set chips — tap to select, tap the selected one again for its type */}
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        {exercise.sets.map((s, i) => {
          const isSkipped = s.skipped
          const isActive = i === activeIdx
          const done = s.logged
          const colorText = done ? c.light : isActive ? 'var(--text-1)' : 'var(--text-m)'
          const setTypeInfo = s.set_type && s.set_type !== 'straight' ? SET_TYPE_LABELS[s.set_type] : null
          return (
            <div
              key={i}
              style={{ flex: 1, position: 'relative' }}
            >
              <button
                type="button"
                onClick={() => {
                  if (isActive) setTypeMenuFor(typeMenuOpen ? null : activeKey)
                  else onChipTap(i)
                }}
                aria-label={isActive ? `Set ${i + 1}, selected. Tap for set type` : `Set ${i + 1}`}
                aria-expanded={isActive ? typeMenuOpen : undefined}
                style={{
                  width: '100%',
                  padding: '10px 4px',
                  borderRadius: 10,
                  textAlign: 'center',
                  background: isActive
                    ? 'rgba(255,255,255,0.04)'
                    : 'rgba(255,255,255,0.02)',
                  border: `1px solid ${
                    isActive
                      ? `color-mix(in oklab, ${c.primary} 60%, transparent)`
                      : 'rgba(255,255,255,0.06)'
                  }`,
                  boxShadow: isActive
                    ? `0 0 14px -4px color-mix(in oklab, ${c.primary} 55%, transparent)`
                    : 'none',
                  cursor: 'pointer',
                  opacity: isSkipped ? 0.4 : 1,
                }}
              >
                <div
                  style={{
                    fontSize: 8, color: 'var(--text-m)', letterSpacing: '0.15em',
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
                  }}
                >
                  SET {i + 1}
                  {isActive && (
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke={c.light} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points={typeMenuOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
                    </svg>
                  )}
                </div>
                <div
                  style={{
                    fontSize: 13, fontWeight: 600, marginTop: 3, color: colorText,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  }}
                >
                  {done && s.weight != null && s.reps != null
                    ? `${s.weight === 0 ? 'BW' : s.weight}×${s.reps}`
                    : '—'}
                </div>
              </button>

              {/* Set-type badge (top-left of chip, always visible if set) */}
              {setTypeInfo && (
                <span
                  style={{
                    position: 'absolute',
                    top: 3, left: 3,
                    fontSize: 8, fontWeight: 700,
                    padding: '1px 4px',
                    borderRadius: 4,
                    background: setTypeInfo.bg,
                    border: `1px solid ${setTypeInfo.border}`,
                    color: setTypeInfo.color,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    pointerEvents: 'none',
                  }}
                >
                  {setTypeInfo.label}
                </span>
              )}

              {/* Set-type menu, anchored under the selected chip */}
              {isActive && typeMenuOpen && (
                <>
                  <button
                    type="button"
                    aria-label="Close set type menu"
                    onClick={() => setTypeMenuFor(null)}
                    style={{
                      position: 'fixed', inset: 0, zIndex: 5,
                      background: 'transparent', border: 'none', cursor: 'default',
                    }}
                  />
                  <div
                    role="menu"
                    aria-label={`Set ${i + 1} type`}
                    style={{
                      position: 'absolute', zIndex: 6,
                      top: 'calc(100% + 8px)',
                      ...(i === 0
                        ? { left: 0 }
                        : i === lastChipIdx
                        ? { right: 0 }
                        : { left: '50%', transform: 'translateX(-50%)' }),
                      width: 220, padding: 6, borderRadius: 14,
                      background: 'var(--panel)',
                      border: '1px solid rgba(255,255,255,0.10)',
                      boxShadow: '0 24px 50px -10px rgba(0,0,0,0.85)',
                      textAlign: 'left',
                    }}
                  >
                    <div
                      style={{
                        padding: '6px 10px 4px',
                        fontSize: 9, letterSpacing: '0.18em', color: 'var(--text-m)', fontWeight: 600,
                        fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                      }}
                    >
                      SET {i + 1} TYPE
                    </div>
                    {setTypeOptions(i + 1).map(opt => {
                      const checked = opt.value === currentSetType
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={checked}
                          onClick={() => {
                            setTypeMenuFor(null)
                            if (!checked) onSetType(i, opt.value)
                          }}
                          style={{
                            width: '100%', height: 44, padding: '0 10px', borderRadius: 10,
                            background: checked ? 'rgba(255,255,255,0.06)' : 'transparent',
                            border: 'none',
                            color: checked ? 'var(--text-1)' : 'var(--text-2)',
                            display: 'flex', alignItems: 'center', gap: 10,
                            fontSize: 13, fontWeight: checked ? 600 : 500,
                            textAlign: 'left', cursor: 'pointer',
                          }}
                        >
                          <span
                            style={{
                              width: 22, padding: '1px 0', textAlign: 'center', borderRadius: 4,
                              fontSize: 8, fontWeight: 700,
                              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                              background: opt.bg, border: `1px solid ${opt.border}`, color: opt.color,
                            }}
                          >
                            {opt.badge}
                          </span>
                          <span style={{ flex: 1 }}>{opt.label}</span>
                          {checked && (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={c.light} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          )
        })}
        <button
          type="button"
          onClick={onAddSet}
          aria-label="Add set"
          style={{
            width: 44, padding: '10px 0', borderRadius: 10,
            background: 'transparent',
            border: '1px dashed rgba(255,255,255,0.08)',
            color: 'var(--text-m)',
            display: 'grid', placeItems: 'center',
            cursor: 'pointer',
          }}
        >
          +
        </button>
      </div>

      {/* "Next exercise" CTA — only when the exercise is fully done AND there's a next one. */}
      {allDone && hasNextExercise && (
        <button
          type="button"
          onClick={onAdvanceExercise}
          style={{
            marginTop: 16, width: '100%', height: 50, borderRadius: 14,
            background: `linear-gradient(135deg, ${c.primary}, ${c.light})`,
            color: 'white', fontWeight: 700, fontSize: 14, letterSpacing: '0.2em',
            border: 'none', cursor: 'pointer',
            boxShadow: `0 12px 30px -8px color-mix(in oklab, ${c.primary} 60%, transparent)`,
          }}
        >
          NEXT EXERCISE →
        </button>
      )}

      {/* Exercise actions — swap, skip, remove (remove asks for a second tap) */}
      <div
        style={{
          marginTop: 18,
          display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
          borderRadius: 16,
          background: 'rgba(255,255,255,0.03)',
          border: '1px solid rgba(255,255,255,0.08)',
          overflow: 'hidden',
        }}
      >
        <button type="button" aria-label="Swap exercise" disabled={busy} onClick={onSwapExercise} style={stripButton}>
          <SwapIcon />
        </button>
        <button type="button" aria-label="Skip exercise" onClick={onSkipExercise} style={stripButton}>
          <SkipIcon size={23} />
        </button>
        <button
          type="button"
          aria-label={confirmRemove ? 'Tap again to remove exercise' : 'Remove exercise'}
          disabled={busy}
          onClick={() => {
            if (confirmRemove) {
              setConfirmRemoveFor(null)
              onRemoveExercise()
            } else {
              setConfirmRemoveFor(exercise.exercise_id)
            }
          }}
          style={{
            ...stripButton,
            borderRight: 'none',
            color: '#fb7185',
            background: confirmRemove ? 'rgba(251,113,133,0.14)' : 'transparent',
            transition: 'background 0.15s',
          }}
        >
          {confirmRemove
            ? (
              <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2 }}>
                {loggedCount > 0 ? `Delete ${loggedCount} logged?` : 'Remove?'}
              </span>
            )
            : <RemoveIcon />}
        </button>
      </div>
    </div>
  )
}
