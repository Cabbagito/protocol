import { useState, useEffect, useCallback, useRef, useMemo, memo } from 'react'
import { parseWeight, formatWeight } from '../../lib/weightUtils'
import { getSetState, SET_STYLES, SET_TYPE_LABELS, STRAIGHT_PILL } from './constants'
import { SavingButton, CompletedButton } from './SetButtons'
import type { WorkingSet, MesoExercise, SetType } from '../../types'

interface SetRowProps {
  set: WorkingSet
  exercise: MesoExercise
  allSets: WorkingSet[]
  targetRir: number
  onUpdate: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => void
  onComplete: (exerciseId: string, setNum: number) => void
  onUncomplete: (exerciseId: string, setNum: number) => void
  locked?: boolean
  isSkipped?: boolean
  onSkipSet: () => void
  onRemoveSet: () => void
  canRemove: boolean
  animPhase?: 'saving' | 'success'
  onClearAnim: (exerciseId: string, setNum: number) => void
  strikethrough?: boolean
}

export const SetRow = memo(function SetRow({ set, exercise, allSets, onUpdate, onComplete, onUncomplete, locked, isSkipped, onSkipSet, onRemoveSet, canRemove, animPhase, onClearAnim, strikethrough }: SetRowProps) {
  const [typePopoverOpen, setTypePopoverOpen] = useState(false)
  const [jiggleTarget, setJiggleTarget] = useState<'weight' | 'reps' | null>(null)
  const jiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const state = getSetState(set)
  const styles = SET_STYLES[state]
  const setType = set.set_type ?? 'straight'
  const typeInfo = SET_TYPE_LABELS[setType]

  // Cleanup jiggle timer on unmount
  useEffect(() => {
    return () => { if (jiggleTimerRef.current) clearTimeout(jiggleTimerRef.current) }
  }, [])

  const triggerLockJiggle = useCallback((target: 'weight' | 'reps') => {
    setJiggleTarget(target)
    if (jiggleTimerRef.current) clearTimeout(jiggleTimerRef.current)
    jiggleTimerRef.current = setTimeout(() => setJiggleTarget(null), 700)
  }, [])

  // Resolve myorep_match reference set: find nearest non-MM set before this one
  const mmRef = useMemo(() => {
    if (setType !== 'myorep_match') return null
    const exerciseSets = allSets
      .filter(s => s.exercise_id === exercise.exercise_id)
      .sort((a, b) => a.set_num - b.set_num)
    for (let i = exerciseSets.findIndex(s => s.set_num === set.set_num) - 1; i >= 0; i--) {
      const ref = exerciseSets[i]!
      if ((ref.set_type ?? 'straight') !== 'myorep_match') return ref
    }
    return null
  }, [setType, allSets, set.set_num, exercise.exercise_id])

  const resolvedTargetReps = useMemo(() => {
    if (!mmRef) return set.target_reps
    return mmRef.completed ? (mmRef.reps ?? set.target_reps) : set.target_reps
  }, [mmRef, set.target_reps])

  const resolvedWeight = useMemo(() => {
    if (!mmRef) return null
    return mmRef.weight ?? 0
  }, [mmRef])

  const isMatchLocked = setType === 'myorep_match'
  const mmRefLogged = mmRef?.completed ?? false
  const mmWaiting = isMatchLocked && !mmRefLogged && !set.completed

  const handleSetTypeChange = (newType: SetType) => {
    onUpdate(exercise.exercise_id, set.set_num, 'set_type', newType)
    if (newType === 'myorep') {
      onUpdate(exercise.exercise_id, set.set_num, 'target_reps', 20)
    } else if (newType === 'myorep_match') {
      // Auto-copy weight from reference set
      const exerciseSets = allSets
        .filter(s => s.exercise_id === exercise.exercise_id)
        .sort((a, b) => a.set_num - b.set_num)
      for (let i = exerciseSets.findIndex(s => s.set_num === set.set_num) - 1; i >= 0; i--) {
        const ref = exerciseSets[i]!
        if ((ref.set_type ?? 'straight') !== 'myorep_match') {
          if (ref.weight) onUpdate(exercise.exercise_id, set.set_num, 'weight', ref.weight)
          break
        }
      }
    }
    setTypePopoverOpen(false)
  }

  const isFirstSet = set.set_num === 1

  // Row tint
  const rowBg = typeInfo
    ? (isMatchLocked && mmWaiting ? 'rgba(251,191,36,0.03)' : typeInfo.rowBg)
    : undefined

  return (
    <div className="relative">
      <div className="flex items-center gap-2 rounded-lg px-2 py-1.5" style={{ background: rowBg, opacity: isSkipped ? 0.4 : 1 }}>
      {/* Set number / type indicator */}
      <div className="w-8 flex justify-center">
        <button
          onClick={() => !locked && !set.completed && setTypePopoverOpen(!typePopoverOpen)}
          disabled={locked || (set.completed && !isSkipped)}
          className="min-w-[28px] h-7 rounded-md flex items-center justify-center text-[11px] font-semibold disabled:cursor-default"
          style={typeInfo ? {
            background: typeInfo.bg,
            color: typeInfo.color,
            border: `1px solid ${typeInfo.border}`,
          } : {
            color: STRAIGHT_PILL.color,
            background: STRAIGHT_PILL.bg,
            border: `1px solid ${STRAIGHT_PILL.border}`,
          }}
        >
          {typeInfo ? typeInfo.label : set.set_num}
        </button>
      </div>

      {/* Weight input */}
      <div className="flex-1 relative">
        <input
          type="text"
          inputMode="decimal"
          pattern="[0-9]*[.,]?[0-9]*"
          value={isMatchLocked ? (resolvedWeight != null ? formatWeight(resolvedWeight) : set.weight != null ? formatWeight(set.weight) : '') : (set.weight ? formatWeight(set.weight) : '')}
          onChange={(e) => onUpdate(exercise.exercise_id, set.set_num, 'weight', parseWeight(e.target.value))}
          readOnly={set.completed || locked || isMatchLocked || isSkipped}
          className="set-input"
          style={{
            background: isMatchLocked ? 'rgba(251,191,36,0.06)' : styles.inputBg,
            border: `1px solid ${isMatchLocked ? 'rgba(251,191,36,0.15)' : styles.inputBorder}`,
            color: isMatchLocked ? '#fbbf24' : styles.textColor,
            opacity: isMatchLocked && !mmRefLogged ? 0.5 : 1,
            textDecoration: strikethrough ? 'line-through' : undefined,
          }}
          onClick={() => { if (isMatchLocked && !set.completed) triggerLockJiggle('weight') }}
        />
        {/* Pulsing lock when waiting */}
        {mmWaiting && !jiggleTarget && (
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 lock-pulse pointer-events-none" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
        {/* Jiggle lock on tap */}
        {jiggleTarget === 'weight' && (
          <svg className="absolute left-1/2 top-1/2 w-5 h-5 lock-jiggle pointer-events-none" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
      </div>

      {/* Reps input */}
      <div className="flex-1 relative">
        <input
          type="number"
          inputMode="numeric"
          value={isMatchLocked
            ? (set.completed ? (set.reps ?? '') : (mmRefLogged ? (resolvedTargetReps ?? '') : ''))
            : (set.completed ? (set.reps ?? '') : (set.reps || ''))
          }
          onChange={(e) => onUpdate(exercise.exercise_id, set.set_num, 'reps', parseInt(e.target.value) || 0)}
          readOnly={set.completed || locked || isMatchLocked || isSkipped}
          placeholder={isMatchLocked ? (mmRefLogged ? `${resolvedTargetReps ?? ''}` : '...') : (set.suggested_weight != null && resolvedTargetReps != null ? `${resolvedTargetReps}` : '')}
          className="set-input reps-ghost"
          style={{
            background: isMatchLocked ? 'rgba(251,191,36,0.06)' : styles.inputBg,
            border: `1px solid ${isMatchLocked ? 'rgba(251,191,36,0.15)' : styles.inputBorder}`,
            color: isMatchLocked ? '#fbbf24' : styles.textColor,
            opacity: isMatchLocked && !mmRefLogged ? 0.5 : 1,
            textDecoration: strikethrough ? 'line-through' : undefined,
          }}
          onClick={() => { if (isMatchLocked && !set.completed) triggerLockJiggle('weight') }}
        />
        {/* Pulsing lock when waiting */}
        {mmWaiting && !jiggleTarget && (
          <svg className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-4 lock-pulse pointer-events-none" style={{ color: '#fbbf24' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
        )}
      </div>

      {/* Check / State button */}
      <div className="w-12 flex justify-center">
        {(() => {
          if (locked) {
            return (
              <div
                className="w-9 h-9 rounded-lg border-2 flex items-center justify-center opacity-30"
                style={{ borderColor: 'var(--border)' }}
              />
            )
          }
          if (animPhase === 'saving') {
            return <SavingButton state={state} />
          }
          if (animPhase === 'success') {
            return (
              <CompletedButton
                state={state}
                onClick={() => onUncomplete(exercise.exercise_id, set.set_num)}
                animated
                onAnimEnd={() => onClearAnim(exercise.exercise_id, set.set_num)}
              />
            )
          }
          if (set.completed) {
            return <CompletedButton state={state} onClick={() => onUncomplete(exercise.exercise_id, set.set_num)} />
          }
          return (
            <button
              onClick={() => {
                const effectiveWeight = isMatchLocked ? (resolvedWeight ?? set.weight ?? 0) : (set.weight ?? 0)
                const effectiveReps = set.reps ?? 0
                if (effectiveWeight > 0 && (isMatchLocked || effectiveReps > 0)) {
                  if (isMatchLocked) {
                    onUpdate(exercise.exercise_id, set.set_num, 'weight', effectiveWeight)
                    onUpdate(exercise.exercise_id, set.set_num, 'reps', resolvedTargetReps ?? 0)
                  }
                  onComplete(exercise.exercise_id, set.set_num)
                }
              }}
              disabled={isMatchLocked ? !mmRefLogged : (!(set.weight ?? 0) || !(set.reps ?? 0))}
              className="w-9 h-9 rounded-lg border-2 flex items-center justify-center check-pop disabled:opacity-30 disabled:cursor-not-allowed"
              style={{ borderColor: isMatchLocked ? 'rgba(251,191,36,0.3)' : 'var(--border)' }}
            />
          )
        })()}
      </div>
      </div>

      {/* Type selection popover - rendered outside opacity container */}
      {typePopoverOpen && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setTypePopoverOpen(false)} />
          <div
            className="absolute left-2 top-full z-50 rounded-lg py-1 min-w-[140px] mt-0.5"
            style={{
              background: 'var(--panel)',
              border: '1px solid rgba(255,255,255,0.08)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.6)',
            }}
          >
            <button
              onClick={() => handleSetTypeChange('straight')}
              className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2"
              style={{ color: setType === 'straight' ? 'var(--accent-l)' : 'var(--text-m)' }}
            >
              <span className="w-4 text-center font-semibold text-[11px]">#</span>
              Straight
            </button>
            <button
              onClick={() => handleSetTypeChange('myorep')}
              className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2"
              style={{ color: setType === 'myorep' ? '#2dd4bf' : 'var(--text-m)' }}
            >
              <span className="w-4 text-center font-semibold text-[11px]" style={{ color: '#2dd4bf' }}>MR</span>
              Myorep
            </button>
            <button
              onClick={() => !isFirstSet && handleSetTypeChange('myorep_match')}
              disabled={isFirstSet}
              className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2 disabled:opacity-30"
              style={{ color: setType === 'myorep_match' ? '#fbbf24' : 'var(--text-m)' }}
            >
              <span className="w-4 text-center font-semibold text-[11px]" style={{ color: '#fbbf24' }}>MM</span>
              Myorep Match
            </button>
            <div className="my-1 mx-2 border-t" style={{ borderColor: 'rgba(255,255,255,0.06)' }} />
            <button
              onClick={() => { onSkipSet(); setTypePopoverOpen(false) }}
              className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2"
              style={{ color: isSkipped ? '#f59e0b' : 'var(--text-m)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                {isSkipped
                  ? <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
                  : <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061A1.125 1.125 0 0 1 3 16.811V8.69ZM12.75 8.689c0-.864.933-1.406 1.683-.977l7.108 4.061a1.125 1.125 0 0 1 0 1.954l-7.108 4.061a1.125 1.125 0 0 1-1.683-.977V8.69Z" />
                }
              </svg>
              {isSkipped ? 'Unskip Set' : 'Skip Set'}
            </button>
            {canRemove && (
              <button
                onClick={() => { onRemoveSet(); setTypePopoverOpen(false) }}
                className="w-full px-3 py-2 text-left text-[13px] flex items-center gap-2"
                style={{ color: '#f87171' }}
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
                </svg>
                Remove Set
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
})
