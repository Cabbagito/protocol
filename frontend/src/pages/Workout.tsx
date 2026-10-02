import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import {
  useMesocycle, useUpdateExerciseNote, useReplaceExercise, useAddExercise,
  useReorderExercises, useRemoveExerciseFromSession, useExerciseHistory, useSkipSession, queryKeys,
} from '../api/hooks'
import { api } from '../api/client'
import PageLoader from '../components/PageLoader'
import AuroraBackground from '../components/AuroraBackground'
import MuscleSpotlight from '../components/MuscleSpotlight'
import ProgressRail from '../components/ProgressRail'
import ExercisePeekCard from '../components/ExercisePeekCard'
import NumeralsCard from '../components/NumeralsCard'
import MuscleAccent from '../components/MuscleAccent'
import { getMuscleColor } from '../lib/muscleColors'
import { formatHistorySummary } from '../lib/exerciseHistory'
import { getCurrentPosition } from '../lib/mesoUtils'
import { useKeyboardVisible } from '../lib/useKeyboardVisible'
import { useAnimPhase } from '../hooks/useAnimPhase'
import { useWorkoutState } from '../hooks/useWorkoutState'
import { useWorkoutAutoSave } from '../hooks/useWorkoutAutoSave'
import { useSetModification } from '../hooks/useSetModification'
import { useWorkoutCompletion } from '../hooks/useWorkoutCompletion'
import { NoteModal } from './workout/NoteModal'
import { ExercisePicker } from './workout/ExercisePicker'
import { ExerciseHistoryPopup } from './workout/ExerciseHistoryPopup'
import { ReorderSheet } from './workout/ReorderSheet'
import { SET_TYPE_LABELS, STRAIGHT_PILL } from '../lib/setConstants'
import type { WorkoutTemplate, MesoExercise, WorkingSet, SetType } from '../types'

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function MesocycleIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <line x1="16" y1="2" x2="16" y2="6" />
      <line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  )
}

function ReorderIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </svg>
  )
}

function SkipIcon({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="5 4 15 12 5 20 5 4" />
      <line x1="19" y1="5" x2="19" y2="19" />
    </svg>
  )
}

function SwapIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7 4 3 8l4 4" />
      <path d="M3 8h14" />
      <path d="m17 20 4-4-4-4" />
      <path d="M21 16H7" />
    </svg>
  )
}

function RemoveIcon() {
  return (
    <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  )
}

function NoteIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  )
}

export default function Workout() {
  const toast = useToast()
  const keyboardOpen = useKeyboardVisible()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { mesocycleId } = useParams<{ mesocycleId: string }>()
  const [searchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const sessionParam = searchParams.get('session')

  // Data fetching ─────────────────────────────────────────────────────
  const { data: template, isLoading } = useQuery({
    queryKey: weekParam !== null && sessionParam !== null
      ? ['workouts', 'template', mesocycleId, Number(weekParam), Number(sessionParam)]
      : ['workouts', 'template', mesocycleId],
    queryFn: () => weekParam !== null && sessionParam !== null
      ? api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}/${weekParam}/${sessionParam}`)
      : api.get<WorkoutTemplate>(`/workouts/template/${mesocycleId}`),
    enabled: !!mesocycleId,
  })
  const { data: mesocycle } = useMesocycle(mesocycleId!)
  const updateExerciseNote = useUpdateExerciseNote()
  const replaceExercise = useReplaceExercise()
  const addExerciseMutation = useAddExercise()
  const reorderExercisesMutation = useReorderExercises()
  const removeExerciseMutation = useRemoveExerciseFromSession()
  const skipSessionMutation = useSkipSession()

  // UI state ──────────────────────────────────────────────────────────
  const [noteModal, setNoteModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null)
  const [replaceModal, setReplaceModal] = useState<{ exerciseId: string; exerciseIndex: number; muscleGroup: string; equipmentType: string } | null>(null)
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [reorderOpen, setReorderOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  // Local current-exercise cursor. Defaults to first un-finished exercise.
  // User can jump by tapping a peek card.
  const [curIdxOverride, setCurIdxOverride] = useState<number | null>(null)
  // Per-exercise active-set override (chip taps).
  const [activeSetOverride, setActiveSetOverride] = useState<Record<string, number>>({})

  // Shared refs ───────────────────────────────────────────────────────
  const modifyingRef = useRef(false)
  const prevCompletedRef = useRef(0)
  const prevSkippedRef = useRef<string>('')
  const prevSkippedSetsRef = useRef<string>('')

  // Derived: current position in meso (for back-to-current CTA on previews)
  const currentPos = useMemo(() => {
    if (!mesocycle) return null
    return getCurrentPosition(mesocycle.structure)
  }, [mesocycle])

  // Only later *weeks* are locked as previews; any session in the current
  // week can be logged out of order.
  const isFutureSession = useMemo(() => {
    if (!template || !currentPos) return false
    return template.week_index > currentPos.weekIndex
  }, [template, currentPos])
  const isSkippedSession = !!template?.skipped

  // Workout hooks ─────────────────────────────────────────────────────
  const { animPhaseRef, bumpAnim, setAnimKey } = useAnimPhase()

  const {
    sets, setSets, initialized, skippedExercises, skippedSets, setSkippedSets,
    removedExercises, exerciseNotes, setExerciseNotes,
    updateSet, completeSet,
    toggleSkip, toggleSkipSet, resetForReplace,
  } = useWorkoutState({
    template, isFutureSession, weekParam, sessionParam,
    animPhaseRef, setAnimKey, bumpAnim, prevCompletedRef, prevSkippedRef, prevSkippedSetsRef,
  })

  const { isSaving, setIsSaving, pendingSavesRef, logSets, saveChainRef, cancelDebouncedSave } = useWorkoutAutoSave({
    mesocycleId, template, isFutureSession, sets, initialized,
    skippedExercises, skippedSets, animPhaseRef, bumpAnim,
    modifyingRef, prevCompletedRef, prevSkippedRef, prevSkippedSetsRef,
  })

  const { handleAddSet, handleRemoveSet } = useSetModification({
    mesocycleId, template, sets, setSets, setSkippedSets, modifyingRef,
  })

  const { isLastSession, handleFinishOrNext } = useWorkoutCompletion({
    mesocycleId, template, mesocycle, sets,
    skippedExercises, skippedSets, isFutureSession,
    isSaving, setIsSaving, pendingSavesRef, logSets, saveChainRef, cancelDebouncedSave,
  })

  // Reset overrides when route changes
  useEffect(() => {
    setCurIdxOverride(null)
    setActiveSetOverride({})
  }, [weekParam, sessionParam, mesocycleId])

  // Note save handler
  const handleSaveNote = useCallback((exerciseId: string, note: string | null) => {
    if (!mesocycleId) return
    const trimmed = note?.trim() || null
    setExerciseNotes(prev => {
      if (trimmed) return { ...prev, [exerciseId]: trimmed }
      const next = { ...prev }
      delete next[exerciseId]
      return next
    })
    updateExerciseNote.mutate({ mesocycle_id: mesocycleId, exercise_id: exerciseId, note: trimmed })
  }, [mesocycleId, updateExerciseNote, setExerciseNotes])

  // Replace exercise handler
  const handleReplace = useCallback(async (newExerciseId: string, applyToFuture: boolean) => {
    if (!mesocycleId || !template || !replaceModal) return
    try {
      await replaceExercise.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_index: replaceModal.exerciseIndex,
        old_exercise_id: replaceModal.exerciseId,
        new_exercise_id: newExerciseId,
        apply_to_future: applyToFuture,
      })
      setReplaceModal(null)
      resetForReplace()
      queryClient.removeQueries({ queryKey: ['workouts', 'template'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    } catch {
      toast.showError('Failed to replace exercise')
    }
  }, [mesocycleId, template, replaceModal, replaceExercise, queryClient, toast, resetForReplace])

  const handleAddExercise = useCallback(async (newExerciseId: string) => {
    if (!mesocycleId || !template) return
    try {
      await addExerciseMutation.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_id: newExerciseId,
        apply_to_future: true,
      })
      setAddExerciseOpen(false)
      resetForReplace()
      queryClient.removeQueries({ queryKey: ['workouts', 'template'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    } catch {
      toast.showError('Failed to add exercise')
    }
  }, [mesocycleId, template, addExerciseMutation, queryClient, toast, resetForReplace])

  const handleRemoveExercise = useCallback(async (exerciseId: string) => {
    if (!mesocycleId || !template) return
    try {
      await removeExerciseMutation.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_id: exerciseId,
        apply_to_future: true,
      })
      resetForReplace()
      setCurIdxOverride(null)
      queryClient.removeQueries({ queryKey: ['workouts', 'template'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    } catch {
      toast.showError('Failed to remove exercise')
    }
  }, [mesocycleId, template, removeExerciseMutation, queryClient, toast, resetForReplace])

  // Skip / restore the whole session. Logged sets are kept server-side, so
  // undo brings the workout back exactly as it was.
  const handleSetSessionSkipped = useCallback(async (skipped: boolean) => {
    if (!mesocycleId || !template) return
    if (skipped && !confirm('Skip this workout? You can undo this later.')) return
    cancelDebouncedSave()
    await saveChainRef.current
    try {
      await skipSessionMutation.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        skipped,
      })
      // Pin the URL to this session: the param-less route re-resolves to
      // "where we left off", which has just moved.
      navigate(`/workout/${mesocycleId}?week=${template.week_index}&session=${template.session_index}`, { replace: true })
    } catch {
      toast.showError(skipped ? 'Failed to skip workout' : 'Failed to restore workout')
    }
  }, [mesocycleId, template, skipSessionMutation, navigate, toast, cancelDebouncedSave, saveChainRef])

  // Persist a new exercise order from the reorder sheet. The cursor follows
  // the exercise the user was on, not its old position.
  const handleReorderExercises = useCallback(async (exerciseIds: string[], currentExerciseId: string | null) => {
    if (!mesocycleId || !template) return
    try {
      await reorderExercisesMutation.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_ids: exerciseIds,
        apply_to_future: true,
      })
      setReorderOpen(false)
      resetForReplace()
      if (currentExerciseId) {
        const idx = exerciseIds.indexOf(currentExerciseId)
        if (idx !== -1) setCurIdxOverride(idx)
      }
      queryClient.removeQueries({ queryKey: ['workouts', 'template'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    } catch {
      toast.showError('Failed to reorder exercises')
    }
  }, [mesocycleId, template, reorderExercisesMutation, queryClient, toast, resetForReplace])

  // Visible (un-removed) exercises with sets attached ─────────────────
  // Skipped exercises stay in the list with `skipped: true` (dimmed, with an
  // undo) rather than vanishing; they count as done for session completion.
  const exerciseList = useMemo(() => {
    if (!template) return [] as Array<MesoExercise & {
      exerciseIndex: number
      workingSets: WorkingSet[]
      allDone: boolean
      skipped: boolean
    }>
    return template.exercises
      .map((ex, idx) => {
        const workingSets = sets.filter(s => s.exercise_id === ex.exercise_id)
        const skipped = skippedExercises.has(ex.exercise_id)
        const allDone = skipped || (workingSets.length > 0 && workingSets.every(s => s.completed || skippedSets.has(`${ex.exercise_id}:${s.set_num}`)))
        return {
          ...ex,
          exerciseIndex: idx,
          workingSets,
          allDone,
          skipped,
        }
      })
      .filter(ex => !removedExercises.has(ex.exercise_id))
  }, [template, sets, removedExercises, skippedExercises, skippedSets])

  // Loading / empty states ────────────────────────────────────────────
  if (isLoading) return <PageLoader className="min-h-[60vh]" />
  if (!template) return (
    <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-m)' }}>
      Workout template not found
    </div>
  )

  // ─── DERIVED STATE ──────────────────────────────────────────────────
  // Active "current" exercise: an explicit override (set on first LOG,
  // chip taps, or NEXT EXERCISE) wins; otherwise we default to the first
  // unfinished exercise. The cursor sticks even when an exercise becomes
  // fully done, so the user can review/edit before advancing.
  const firstUnfinished = exerciseList.findIndex(ex => !ex.allDone)
  const fallbackIdx = firstUnfinished === -1 ? Math.max(0, exerciseList.length - 1) : firstUnfinished
  const curIdx = Math.min(
    curIdxOverride ?? fallbackIdx,
    Math.max(0, exerciseList.length - 1),
  )
  const currentEx = exerciseList[curIdx]

  const allLogged = exerciseList.length > 0 && exerciseList.every(ex => ex.allDone)
  const canLog = !isFutureSession && !isSkippedSession
  const showFinishBar = canLog && allLogged && !keyboardOpen

  // Active set within current exercise: override (chip tap) > first unlogged > last
  let activeSetIdx = 0
  if (currentEx) {
    const override = activeSetOverride[currentEx.exercise_id]
    if (override != null && override < currentEx.workingSets.length) {
      activeSetIdx = override
    } else {
      const firstOpen = currentEx.workingSets.findIndex(
        s => !s.completed && !skippedSets.has(`${currentEx.exercise_id}:${s.set_num}`),
      )
      activeSetIdx = firstOpen === -1 ? currentEx.workingSets.length - 1 : firstOpen
    }
  }
  const activeSet = currentEx?.workingSets[activeSetIdx]

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--deep)',
        overflow: 'hidden',
      }}
    >
      <AuroraBackground />
      <MuscleSpotlight group={currentEx?.muscle_group ?? 'chest'} />

      <div style={{ position: 'relative', zIndex: 1, padding: `12px 20px ${showFinishBar ? 250 : 130}px` }}>
        {/* ── Header: back / title / menu ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Back"
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--text-2)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <BackIcon />
          </button>
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                fontSize: 9, color: 'var(--text-m)', letterSpacing: '0.22em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 500,
              }}
            >
              WEEK {template.week_number} · DAY {template.session_index + 1}
            </div>
            <div
              style={{
                fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
                fontStyle: 'italic', fontSize: 18,
                color: 'var(--text-1)', marginTop: 1,
              }}
            >
              {template.session_name}
            </div>
          </div>
          <button
            type="button"
            onClick={() => navigate(`/mesocycles/${mesocycleId}`)}
            aria-label="View mesocycle"
            style={{
              width: 36, height: 36, borderRadius: 12,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--text-2)',
              display: 'grid', placeItems: 'center',
            }}
          >
            <MesocycleIcon />
          </button>
        </div>

        {/* ── Future-session banner (preview only) ── */}
        {isFutureSession && !isSkippedSession && (
          <div
            style={{
              marginTop: 14, padding: '10px 12px', borderRadius: 12,
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.2)',
              display: 'flex', alignItems: 'center', gap: 8,
              fontSize: 12, color: '#f59e0b', fontWeight: 500,
            }}
          >
            Preview — complete previous workouts first.
          </div>
        )}

        {/* ── Skipped-session banner ── */}
        {isSkippedSession && (
          <div
            style={{
              marginTop: 14, padding: '14px 14px 12px', borderRadius: 14,
              background: 'rgba(148,163,184,0.07)',
              border: '1px dashed rgba(148,163,184,0.3)',
            }}
          >
            <div
              style={{
                fontSize: 10, color: 'var(--text-m)', letterSpacing: '0.22em',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 600,
                textTransform: 'uppercase',
              }}
            >
              Workout skipped
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6, lineHeight: 1.4 }}>
              This session is marked as skipped and won't count toward the mesocycle.
              {exerciseList.some(ex => ex.workingSets.some(s => s.completed)) && ' Sets you already logged are kept.'}
            </div>
            <button
              type="button"
              onClick={() => handleSetSessionSkipped(false)}
              disabled={skipSessionMutation.isPending}
              style={{
                marginTop: 12, width: '100%', height: 44, borderRadius: 12,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'var(--text-1)', fontWeight: 600, fontSize: 13,
                cursor: 'pointer',
                opacity: skipSessionMutation.isPending ? 0.6 : 1,
              }}
            >
              Undo skip
            </button>
          </div>
        )}

        {/* ── Progress rail ── */}
        {canLog && exerciseList.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <ProgressRail exercises={exerciseList} currentIndex={curIdx} />
          </div>
        )}

        {/* ── Skipped exercise: dimmed shell with undo ── */}
        {canLog && currentEx && currentEx.skipped && (
          <SkippedExerciseState
            currentEx={currentEx}
            onUnskip={() => toggleSkip(currentEx.exercise_id)}
            onAdvanceExercise={() => setCurIdxOverride(curIdx + 1)}
            hasNextExercise={curIdx < exerciseList.length - 1}
          />
        )}

        {/* ── State A: logging (and exercise-complete: same shell, "Next exercise" CTA) ── */}
        {canLog && currentEx && !currentEx.skipped && activeSet && (
          <LoggingState
            currentEx={currentEx}
            activeSet={activeSet}
            activeSetIdx={activeSetIdx}
            skippedSets={skippedSets}
            onUpdateSet={updateSet}
            onCompleteSet={(exId, setNum) => {
              // Logging a skipped set brings it back.
              if (skippedSets.has(`${exId}:${setNum}`)) toggleSkipSet(exId, setNum)
              // Lock cursor to current exercise so we don't auto-jump off
              // it when this becomes the last set — user must tap "Next
              // exercise" explicitly.
              setCurIdxOverride(curIdx)
              completeSet(exId, setNum)
              // Advance to the next still-open set within this exercise.
              // If every later set is already done/skipped, leave the
              // cursor here so the "Next exercise" CTA appears.
              const nextIdx = currentEx.workingSets.findIndex(
                (s, i) => i > activeSetIdx && !s.completed && !skippedSets.has(`${exId}:${s.set_num}`),
              )
              if (nextIdx !== -1) {
                setActiveSetOverride(prev => ({ ...prev, [exId]: nextIdx }))
              }
            }}
            onAddSet={handleAddSet}
            onChipTap={(setIdx) => setActiveSetOverride(prev => ({
              ...prev,
              [currentEx.exercise_id]: setIdx,
            }))}
            note={exerciseNotes[currentEx.exercise_id] ?? null}
            onEditNote={() => setNoteModal({ exerciseId: currentEx.exercise_id, exerciseName: currentEx.exercise_name })}
            onSetType={(type) => updateSet(currentEx.exercise_id, activeSet.set_num, 'set_type', type)}
            onSkipSet={() => {
              const exId = currentEx.exercise_id
              const wasSkipped = skippedSets.has(`${exId}:${activeSet.set_num}`)
              toggleSkipSet(exId, activeSet.set_num)
              if (wasSkipped) return
              // Move on to the next still-open set, like logging does.
              setCurIdxOverride(curIdx)
              const nextIdx = currentEx.workingSets.findIndex(
                (s, i) => i > activeSetIdx && !s.completed && !skippedSets.has(`${exId}:${s.set_num}`),
              )
              if (nextIdx !== -1) {
                setActiveSetOverride(prev => ({ ...prev, [exId]: nextIdx }))
              }
            }}
            onRemoveSet={currentEx.workingSets.length > 1
              ? () => handleRemoveSet(currentEx.exercise_id, activeSet.set_num)
              : undefined}
            onSwapExercise={() => setReplaceModal({
              exerciseId: currentEx.exercise_id,
              exerciseIndex: currentEx.exerciseIndex,
              muscleGroup: currentEx.muscle_group,
              equipmentType: currentEx.equipment_type,
            })}
            onSkipExercise={() => {
              toggleSkip(currentEx.exercise_id)
              setCurIdxOverride(null)
            }}
            onRemoveExercise={() => handleRemoveExercise(currentEx.exercise_id)}
            onOpenHistory={() => setHistoryOpen(true)}
            onAdvanceExercise={() => setCurIdxOverride(curIdx + 1)}
            hasNextExercise={curIdx < exerciseList.length - 1}
            isSaving={isSaving}
          />
        )}

        {/* ── Workout list (always visible during logging) ── */}
        {canLog && exerciseList.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <div
                style={{
                  fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                  textTransform: 'uppercase', color: 'var(--text-m)',
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                }}
              >
                Workout
              </div>
              {exerciseList.length > 1 && (
                <button
                  type="button"
                  onClick={() => setReorderOpen(true)}
                  style={{
                    height: 34, padding: '0 12px', borderRadius: 10,
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: 'var(--text-2)', fontSize: 12, fontWeight: 500,
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                    cursor: 'pointer',
                  }}
                >
                  <ReorderIcon />
                  Reorder
                </button>
              )}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exerciseList.map((ex, i) => {
                const status: 'done' | 'current' | 'queued' | 'skipped' = ex.skipped
                  ? 'skipped'
                  : ex.allDone
                  ? 'done'
                  : i === curIdx
                  ? 'current'
                  : 'queued'
                return (
                  <ExercisePeekCard
                    key={ex.exercise_id}
                    exercise={ex}
                    index={i}
                    status={status}
                    onClick={() => setCurIdxOverride(i)}
                  />
                )
              })}
            </div>
          </div>
        )}

        {/* ── Add exercise CTA below the list ── */}
        {canLog && (
          <button
            type="button"
            onClick={() => setAddExerciseOpen(true)}
            style={{
              marginTop: 16, width: '100%', padding: '14px 0',
              fontSize: 13, fontWeight: 500,
              color: 'var(--text-m)',
              borderRadius: 14,
              border: '1.5px dashed rgba(255,255,255,0.1)',
              background: 'rgba(255,255,255,0.02)',
              cursor: 'pointer',
            }}
          >
            + Add Exercise
          </button>
        )}

        {/* ── Skip the whole workout ── */}
        {canLog && !keyboardOpen && (
          <button
            type="button"
            onClick={() => handleSetSessionSkipped(true)}
            disabled={skipSessionMutation.isPending}
            style={{
              marginTop: 10, width: '100%', padding: '12px 0',
              fontSize: 12, fontWeight: 500, letterSpacing: '0.05em',
              color: 'var(--text-m)',
              borderRadius: 14,
              border: 'none',
              background: 'transparent',
              cursor: 'pointer',
              opacity: skipSessionMutation.isPending ? 0.6 : 1,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            <SkipIcon />
            Skip this workout
          </button>
        )}

        {/* ── Go-to-current CTA for preview / skipped screens ── */}
        {!keyboardOpen && (isFutureSession || isSkippedSession) && currentPos && (
          <button
            type="button"
            onClick={() => navigate(`/workout/${mesocycleId}?week=${currentPos.weekIndex}&session=${currentPos.sessionIndex}`)}
            style={{
              marginTop: 20, width: '100%', height: 52, borderRadius: 14,
              background: 'rgba(var(--accent-rgb),0.15)',
              border: '1.5px solid rgba(var(--accent-rgb),0.3)',
              color: 'var(--accent-l)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer',
            }}
          >
            Go to current workout
          </button>
        )}
      </div>

      {/* ── Note Modal ── */}
      {noteModal && (
        <NoteModal
          exerciseName={noteModal.exerciseName}
          initialNote={exerciseNotes[noteModal.exerciseId] ?? ''}
          onSave={(note) => {
            handleSaveNote(noteModal.exerciseId, note || null)
            setNoteModal(null)
          }}
          onClose={() => setNoteModal(null)}
        />
      )}

      {/* ── Replace Exercise Picker ── */}
      {replaceModal && (
        <ExercisePicker
          mode="replace"
          initialMuscleGroup={replaceModal.muscleGroup}
          initialEquipmentType={replaceModal.equipmentType}
          currentExerciseId={replaceModal.exerciseId}
          onSelect={handleReplace}
          onClose={() => setReplaceModal(null)}
        />
      )}

      {/* ── Add Exercise Picker ── */}
      {addExerciseOpen && (
        <ExercisePicker
          mode="add"
          excludeExerciseIds={exerciseList.map(ex => ex.exercise_id)}
          onSelect={(exerciseId) => handleAddExercise(exerciseId)}
          onClose={() => setAddExerciseOpen(false)}
        />
      )}

      {/* ── Reorder sheet (opened from the list header) ── */}
      {reorderOpen && (
        <ReorderSheet
          subtitle={`${template.session_name} · Week ${template.week_number}`}
          exercises={exerciseList}
          saving={reorderExercisesMutation.isPending}
          onSave={(ids) => handleReorderExercises(ids, currentEx?.exercise_id ?? null)}
          onClose={() => setReorderOpen(false)}
        />
      )}

      {/* ── Exercise history popup ── */}
      {historyOpen && currentEx && (
        <ExerciseHistoryWrap
          exerciseId={currentEx.exercise_id}
          exerciseName={currentEx.exercise_name}
          muscleGroup={currentEx.muscle_group}
          equipmentType={currentEx.equipment_type}
          onClose={() => setHistoryOpen(false)}
        />
      )}

      {/* ── Sticky finish bar — all sets logged, user must explicitly finish ── */}
      {showFinishBar && (
        <WorkoutFinishBar
          exerciseList={exerciseList}
          isLastSession={isLastSession}
          isSaving={isSaving}
          onFinish={handleFinishOrNext}
          onReviewSets={() => {
            if (!mesocycleId || !template) return
            navigate(`/workouts/${mesocycleId}/${template.week_index}/${template.session_index}`)
          }}
        />
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  STATE A — logging                                                  */
/* ─────────────────────────────────────────────────────────────────── */

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
  currentEx: MesoExercise & { workingSets: WorkingSet[] }
  activeSet: WorkingSet
  activeSetIdx: number
  skippedSets: Set<string>
  note: string | null
  onEditNote: () => void
  onUpdateSet: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => void
  onCompleteSet: (exerciseId: string, setNum: number) => void
  onAddSet: (exerciseId: string) => void
  onChipTap: (setIdx: number) => void
  onSetType: (type: SetType) => void
  onSkipSet: () => void
  /** Omitted when the exercise is down to its last set. */
  onRemoveSet?: () => void
  onOpenHistory: () => void
  onAdvanceExercise: () => void
  hasNextExercise: boolean
  onSwapExercise: () => void
  onSkipExercise: () => void
  onRemoveExercise: () => void
  isSaving: boolean
}

function LoggingState({
  currentEx, activeSet, activeSetIdx, skippedSets, note, onEditNote,
  onUpdateSet, onCompleteSet, onAddSet, onChipTap, onSetType, onSkipSet, onRemoveSet,
  onOpenHistory, onAdvanceExercise, hasNextExercise,
  onSwapExercise, onSkipExercise, onRemoveExercise, isSaving,
}: LoggingStateProps) {
  const c = getMuscleColor(currentEx.muscle_group)

  // Set-type menu: opened by tapping the already-selected chip. Keyed by
  // exercise + set so it closes on its own when the selection moves.
  const activeKey = `${currentEx.exercise_id}:${activeSet.set_num}`
  const [typeMenuFor, setTypeMenuFor] = useState<string | null>(null)
  const typeMenuOpen = typeMenuFor === activeKey

  // Remove exercise carries over to the rest of the mesocycle, so it needs a
  // second tap within a few seconds.
  const [confirmRemoveFor, setConfirmRemoveFor] = useState<string | null>(null)
  const confirmRemove = confirmRemoveFor === currentEx.exercise_id
  useEffect(() => {
    if (!confirmRemoveFor) return
    const t = setTimeout(() => setConfirmRemoveFor(null), 3000)
    return () => clearTimeout(t)
  }, [confirmRemoveFor])

  // Cross-meso "last session" reference (Commit 2's history endpoint).
  const { data: history } = useExerciseHistory(currentEx.exercise_id)
  const previousSession = history?.find(h => h.sets.length > 0) ?? null
  const lastSummary = previousSession ? formatHistorySummary(previousSession.sets) : null

  const weight = activeSet.weight ?? 0
  const reps = activeSet.reps ?? 0
  const isLogValid = weight > 0 && reps > 0
  const isActiveLogged = !!activeSet.completed
  const isActiveSkipped = skippedSets.has(activeKey)
  const allDone = currentEx.workingSets.every(
    s => s.completed || skippedSets.has(`${currentEx.exercise_id}:${s.set_num}`),
  )
  const currentSetType: SetType = activeSet.set_type ?? 'straight'
  const lastChipIdx = currentEx.workingSets.length - 1

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
        <MuscleAccent group={currentEx.muscle_group} variant="dot" />
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
        {currentEx.exercise_name}
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
          group={currentEx.muscle_group}
          weight={weight}
          reps={reps}
          setNum={activeSetIdx + 1}
          totalSets={currentEx.workingSets.length}
          lastSummary={lastSummary}
          onLastClick={onOpenHistory}
          onWeightChange={(n) => onUpdateSet(currentEx.exercise_id, activeSet.set_num, 'weight', n)}
          onRepsChange={(n) => onUpdateSet(currentEx.exercise_id, activeSet.set_num, 'reps', n)}
          onLog={() => onCompleteSet(currentEx.exercise_id, activeSet.set_num)}
          disabled={isSaving || !isLogValid}
          logLabel={logLabel}
          // A logged set can't be skipped; a skipped one can always be unskipped.
          onSkipSet={!isActiveLogged || isActiveSkipped ? onSkipSet : undefined}
          setSkipped={isActiveSkipped}
          onRemoveSet={onRemoveSet}
        />
      </div>

      {/* Set chips — tap to select, tap the selected one again for its type */}
      <div style={{ marginTop: 12, display: 'flex', gap: 6 }}>
        {currentEx.workingSets.map((s, i) => {
          const key = `${currentEx.exercise_id}:${s.set_num}`
          const isSkipped = skippedSets.has(key)
          const isActive = i === activeSetIdx
          const done = s.completed
          const colorText = done ? c.light : isActive ? 'var(--text-1)' : 'var(--text-m)'
          const setTypeInfo = s.set_type && s.set_type !== 'straight' ? SET_TYPE_LABELS[s.set_type] : null
          return (
            <div
              key={s.set_num}
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
                  backdropFilter: 'blur(20px)',
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
                    ? `${s.weight}×${s.reps}`
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
                    {setTypeOptions(s.set_num).map(opt => {
                      const checked = opt.value === currentSetType
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          role="menuitemradio"
                          aria-checked={checked}
                          onClick={() => {
                            setTypeMenuFor(null)
                            if (!checked) onSetType(opt.value)
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
          onClick={() => onAddSet(currentEx.exercise_id)}
          aria-label="Add set"
          style={{
            width: 36, padding: '10px 0', borderRadius: 10,
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
        <button type="button" aria-label="Swap exercise" onClick={onSwapExercise} style={stripButton}>
          <SwapIcon />
        </button>
        <button type="button" aria-label="Skip exercise" onClick={onSkipExercise} style={stripButton}>
          <SkipIcon size={23} />
        </button>
        <button
          type="button"
          aria-label={confirmRemove ? 'Tap again to remove exercise' : 'Remove exercise'}
          onClick={() => {
            if (confirmRemove) {
              setConfirmRemoveFor(null)
              onRemoveExercise()
            } else {
              setConfirmRemoveFor(currentEx.exercise_id)
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
            ? <span style={{ fontSize: 13, fontWeight: 600 }}>Remove?</span>
            : <RemoveIcon />}
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Skipped exercise — same shell as logging, but dimmed with an undo  */
/* ─────────────────────────────────────────────────────────────────── */

interface SkippedExerciseStateProps {
  currentEx: MesoExercise & { workingSets: WorkingSet[] }
  onUnskip: () => void
  onAdvanceExercise: () => void
  hasNextExercise: boolean
}

function SkippedExerciseState({ currentEx, onUnskip, onAdvanceExercise, hasNextExercise }: SkippedExerciseStateProps) {
  const c = getMuscleColor(currentEx.muscle_group)
  const loggedCount = currentEx.workingSets.filter(s => s.completed).length

  return (
    <div style={{ marginTop: 28, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14, opacity: 0.5 }}>
        <MuscleAccent group={currentEx.muscle_group} variant="dot" />
      </div>
      <div
        style={{
          fontSize: 36, fontWeight: 700,
          color: 'var(--text-2)',
          lineHeight: 1.05, letterSpacing: '-0.025em',
          padding: '0 12px',
          textDecoration: 'line-through',
          textDecorationColor: 'rgba(148,163,184,0.5)',
        }}
      >
        {currentEx.exercise_name}
      </div>
      <div
        style={{
          fontSize: 11, color: 'var(--text-m)', marginTop: 8, letterSpacing: '0.22em',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          textTransform: 'uppercase', fontWeight: 600,
        }}
      >
        Exercise skipped
      </div>
      {loggedCount > 0 && (
        <div style={{ fontSize: 12, color: 'var(--text-m)', marginTop: 6 }}>
          {loggedCount} logged {loggedCount === 1 ? 'set is' : 'sets are'} kept.
        </div>
      )}

      <button
        type="button"
        onClick={onUnskip}
        style={{
          marginTop: 24, width: '100%', height: 50, borderRadius: 14,
          background: 'rgba(255,255,255,0.05)',
          border: `1px solid color-mix(in oklab, ${c.primary} 40%, transparent)`,
          color: 'var(--text-1)', fontWeight: 600, fontSize: 14,
          cursor: 'pointer',
        }}
      >
        Undo skip
      </button>

      {hasNextExercise && (
        <button
          type="button"
          onClick={onAdvanceExercise}
          style={{
            marginTop: 10, width: '100%', height: 44, borderRadius: 14,
            background: 'transparent', border: 'none',
            color: 'var(--text-m)', fontWeight: 600, fontSize: 12, letterSpacing: '0.2em',
            cursor: 'pointer',
          }}
        >
          NEXT EXERCISE →
        </button>
      )}
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Exercise history popup wrapper — fetches history then renders     */
/* ─────────────────────────────────────────────────────────────────── */

interface ExerciseHistoryWrapProps {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  equipmentType: string
  onClose: () => void
}

function ExerciseHistoryWrap({ exerciseId, exerciseName, muscleGroup, equipmentType, onClose }: ExerciseHistoryWrapProps) {
  const { data: history = [] } = useExerciseHistory(exerciseId)
  return (
    <ExerciseHistoryPopup
      exerciseName={exerciseName}
      muscleGroup={muscleGroup}
      equipmentType={equipmentType}
      history={history}
      onClose={onClose}
    />
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Sticky finish bar — shown when every set is logged or skipped       */
/* ─────────────────────────────────────────────────────────────────── */

interface WorkoutFinishBarProps {
  exerciseList: Array<MesoExercise & { workingSets: WorkingSet[] }>
  isLastSession: boolean
  isSaving: boolean
  onFinish: () => void
  onReviewSets: () => void
}

function WorkoutFinishBar({
  exerciseList, isLastSession, isSaving, onFinish, onReviewSets,
}: WorkoutFinishBarProps) {
  const totalSets = exerciseList.reduce((n, ex) => n + ex.workingSets.filter(s => s.completed).length, 0)
  const exerciseCount = exerciseList.filter(ex => !ex.skipped).length

  return (
    <div
      style={{
        position: 'fixed',
        left: 18, right: 18,
        bottom: 'calc(env(safe-area-inset-bottom) + 98px)',
        zIndex: 100,
        maxWidth: 480,
        marginLeft: 'auto', marginRight: 'auto',
        padding: 14,
        borderRadius: 22,
        background: 'color-mix(in oklab, var(--card) 88%, transparent)',
        backdropFilter: 'blur(28px) saturate(180%)',
        WebkitBackdropFilter: 'blur(28px) saturate(180%)',
        border: '1px solid rgba(255,255,255,0.06)',
        boxShadow:
          '0 18px 50px -14px rgba(0,0,0,0.7), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
    >
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0 4px 10px',
        }}
      >
        <span
          style={{
            fontSize: 10, color: 'var(--accent-l)', letterSpacing: '0.22em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            fontWeight: 600, textTransform: 'uppercase',
          }}
        >
          Session complete
        </span>
        <span
          style={{
            fontSize: 10, color: 'var(--text-m)', letterSpacing: '0.18em',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 500,
          }}
        >
          {totalSets} SETS · {exerciseCount} {exerciseCount === 1 ? 'EX' : 'EX'}
        </span>
      </div>
      <button
        type="button"
        onClick={onFinish}
        disabled={isSaving}
        style={{
          width: '100%', height: 54, borderRadius: 16,
          background: 'var(--p-grad-cta)',
          color: 'var(--btn-text)',
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontWeight: 500, fontSize: 13,
          letterSpacing: '0.22em',
          border: 'none',
          cursor: isSaving ? 'not-allowed' : 'pointer',
          opacity: isSaving ? 0.7 : 1,
          boxShadow:
            '0 14px 36px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        {isSaving ? 'SAVING…' : isLastSession ? 'FINISH MESOCYCLE' : 'FINISH WORKOUT'}
      </button>
      <button
        type="button"
        onClick={onReviewSets}
        style={{
          marginTop: 8, width: '100%', height: 36, borderRadius: 12,
          background: 'transparent', border: 'none',
          color: 'var(--text-m)', fontSize: 12, letterSpacing: '0.05em',
          cursor: 'pointer',
        }}
      >
        Review sets
      </button>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Menu sheet rows                                                    */
/* ─────────────────────────────────────────────────────────────────── */

