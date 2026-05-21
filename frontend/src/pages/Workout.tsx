import { useState, useCallback, useRef, useMemo, useEffect } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import {
  useMesocycle, useUpdateExerciseNote, useReplaceExercise, useAddExercise,
  useReorderExercise, useRemoveExerciseFromSession, useExerciseHistory, queryKeys,
} from '../api/hooks'
import { api } from '../api/client'
import PageLoader from '../components/PageLoader'
import AuroraBackground from '../components/AuroraBackground'
import MuscleSpotlight from '../components/MuscleSpotlight'
import ProgressRail from '../components/ProgressRail'
import ExercisePeekCard from '../components/ExercisePeekCard'
import NumeralsCard from '../components/NumeralsCard'
import MuscleAccent from '../components/MuscleAccent'
import BottomSheet from '../components/BottomSheet'
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
import { SET_TYPE_LABELS } from '../lib/setConstants'
import type { WorkoutTemplate, MesoExercise, WorkingSet, SetType } from '../types'

const ORDINAL_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
] as const

function BackIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  )
}

function DotsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <circle cx="5" cy="12" r="1.8" />
      <circle cx="12" cy="12" r="1.8" />
      <circle cx="19" cy="12" r="1.8" />
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
  const reorderExerciseMutation = useReorderExercise()
  const removeExerciseMutation = useRemoveExerciseFromSession()

  // UI state ──────────────────────────────────────────────────────────
  const [noteModal, setNoteModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null)
  const [replaceModal, setReplaceModal] = useState<{ exerciseId: string; exerciseIndex: number; muscleGroup: string; equipmentType: string } | null>(null)
  const [addExerciseOpen, setAddExerciseOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [perSetSheetOpen, setPerSetSheetOpen] = useState(false)
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

  // Derived: current position in meso (for back-to-current CTA on previews)
  const currentPos = useMemo(() => {
    if (!mesocycle) return null
    return getCurrentPosition(mesocycle.structure)
  }, [mesocycle])

  const isFutureSession = useMemo(() => {
    if (!template || !currentPos) return false
    return template.week_index > currentPos.weekIndex
  }, [template, currentPos])

  // Workout hooks ─────────────────────────────────────────────────────
  const { animPhaseRef, bumpAnim, setAnimKey } = useAnimPhase()

  const {
    sets, setSets, initialized, skippedExercises, skippedSets, setSkippedSets,
    removedExercises, exerciseNotes, setExerciseNotes,
    updateSet, completeSet,
    toggleSkip, resetForReplace,
  } = useWorkoutState({
    template, isFutureSession, weekParam, sessionParam,
    animPhaseRef, setAnimKey, bumpAnim, prevCompletedRef, prevSkippedRef,
  })

  const { isSaving, setIsSaving, pendingSavesRef, logSets } = useWorkoutAutoSave({
    mesocycleId, template, isFutureSession, sets, initialized,
    skippedExercises, skippedSets, animPhaseRef, bumpAnim,
    modifyingRef, prevCompletedRef, prevSkippedRef,
  })

  const { handleAddSet, handleRemoveSet } = useSetModification({
    mesocycleId, template, sets, setSets, setSkippedSets, modifyingRef,
  })

  const { isLastSession, handleFinishOrNext } = useWorkoutCompletion({
    mesocycleId, template, mesocycle, sets,
    skippedExercises, skippedSets, isFutureSession,
    isSaving, setIsSaving, pendingSavesRef, logSets,
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
      queryClient.removeQueries({ queryKey: ['workouts', 'template'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    } catch {
      toast.showError('Failed to remove exercise')
    }
  }, [mesocycleId, template, removeExerciseMutation, queryClient, toast, resetForReplace])

  // Reorder helper (used by the menu sheet)
  const handleReorderExercise = useCallback(async (exerciseIndex: number, direction: 'up' | 'down', visibleIdx: number) => {
    if (!mesocycleId || !template) return
    try {
      await reorderExerciseMutation.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_index: exerciseIndex,
        direction,
        apply_to_future: true,
      })
      resetForReplace()
      setCurIdxOverride(direction === 'up' ? visibleIdx - 1 : visibleIdx + 1)
      queryClient.removeQueries({ queryKey: ['workouts', 'template'] })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })
    } catch {
      toast.showError('Failed to reorder exercise')
    }
  }, [mesocycleId, template, reorderExerciseMutation, queryClient, toast, resetForReplace])

  // Visible (un-removed) exercises with sets attached ─────────────────
  const exerciseList = useMemo(() => {
    if (!template) return [] as Array<MesoExercise & {
      exerciseIndex: number
      workingSets: WorkingSet[]
      allDone: boolean
    }>
    return template.exercises
      .map((ex, idx) => {
        const workingSets = sets.filter(s => s.exercise_id === ex.exercise_id)
        const allDone = workingSets.length > 0 && workingSets.every(s => s.completed || skippedSets.has(`${ex.exercise_id}:${s.set_num}`))
        return {
          ...ex,
          exerciseIndex: idx,
          workingSets,
          allDone,
        }
      })
      .filter(ex => !removedExercises.has(ex.exercise_id) && !skippedExercises.has(ex.exercise_id))
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
  type ScreenState = 'logging' | 'session-done'
  const screenState: ScreenState = allLogged ? 'session-done' : 'logging'

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

      <div style={{ position: 'relative', zIndex: 1, padding: '12px 20px 130px' }}>
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
            onClick={() => setMenuOpen(true)}
            aria-label="Menu"
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
            <DotsIcon />
          </button>
        </div>

        {/* ── Future-session banner (preview only) ── */}
        {isFutureSession && (
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

        {/* ── Progress rail ── */}
        {!isFutureSession && exerciseList.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <ProgressRail exercises={exerciseList} currentIndex={curIdx} />
          </div>
        )}

        {/* ── State C: session complete ── */}
        {!isFutureSession && screenState === 'session-done' && (
          <SessionCompleteHero
            template={template}
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

        {/* ── State A: logging (and exercise-complete: same shell, "Next exercise" CTA) ── */}
        {!isFutureSession && screenState === 'logging' && currentEx && activeSet && (
          <LoggingState
            currentEx={currentEx}
            activeSet={activeSet}
            activeSetIdx={activeSetIdx}
            skippedSets={skippedSets}
            onUpdateSet={updateSet}
            onCompleteSet={(exId, setNum) => {
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
            onChipMore={() => setPerSetSheetOpen(true)}
            onOpenHistory={() => setHistoryOpen(true)}
            onAdvanceExercise={() => setCurIdxOverride(curIdx + 1)}
            hasNextExercise={curIdx < exerciseList.length - 1}
            isSaving={isSaving}
          />
        )}

        {/* ── Workout list (always visible during logging) ── */}
        {!isFutureSession && screenState === 'logging' && exerciseList.length > 0 && (
          <div style={{ marginTop: 28 }}>
            <div
              style={{
                fontSize: 10, fontWeight: 600, letterSpacing: '0.18em',
                textTransform: 'uppercase', color: 'var(--text-m)',
                fontFamily: 'JetBrains Mono, ui-monospace, monospace', marginBottom: 10,
              }}
            >
              Workout
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {exerciseList.map((ex, i) => {
                const status: 'done' | 'current' | 'queued' = ex.allDone
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
        {!isFutureSession && screenState !== 'session-done' && (
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

        {/* ── Go-to-current CTA for preview screens ── */}
        {!keyboardOpen && isFutureSession && currentPos && (
          <button
            type="button"
            onClick={() => navigate(`/workout/${mesocycleId}`)}
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

      {/* ── Header dots menu — exercise-level actions only ── */}
      {currentEx && (() => {
        const close = () => setMenuOpen(false)
        return (
          <BottomSheet
            open={menuOpen}
            onClose={close}
            title={currentEx.exercise_name}
            actions={[
              { label: 'Add note', onClick: () => { close(); setNoteModal({ exerciseId: currentEx.exercise_id, exerciseName: currentEx.exercise_name }) } },
              { label: 'Replace exercise', onClick: () => { close(); setReplaceModal({ exerciseId: currentEx.exercise_id, exerciseIndex: currentEx.exerciseIndex, muscleGroup: currentEx.muscle_group, equipmentType: currentEx.equipment_type }) } },
              { label: 'Add a set', onClick: () => { close(); handleAddSet(currentEx.exercise_id) } },
              ...(curIdx > 0 ? [{ label: 'Move up', onClick: () => { close(); handleReorderExercise(currentEx.exerciseIndex, 'up', curIdx) } }] : []),
              ...(curIdx < exerciseList.length - 1 ? [{ label: 'Move down', onClick: () => { close(); handleReorderExercise(currentEx.exerciseIndex, 'down', curIdx) } }] : []),
              { label: 'Skip exercise', onClick: () => { close(); toggleSkip(currentEx.exercise_id) } },
              { label: 'Remove from workout', variant: 'danger', onClick: () => { close(); handleRemoveExercise(currentEx.exercise_id) } },
            ]}
          />
        )
      })()}

      {/* ── Per-set sheet — opens from the "..." button on the active chip ── */}
      {currentEx && activeSet && (() => {
        const close = () => setPerSetSheetOpen(false)
        const currentSetType: SetType = (activeSet.set_type as SetType | undefined) ?? 'straight'
        const canRemoveSet = currentEx.workingSets.length > 1
        return (
          <BottomSheet
            open={perSetSheetOpen}
            onClose={close}
            title={`Set ${activeSetIdx + 1} · ${currentEx.exercise_name}`}
            actions={[
              { label: currentSetType === 'straight' ? '✓ Straight set' : 'Straight set', onClick: () => { close(); updateSet(currentEx.exercise_id, activeSet.set_num, 'set_type', 'straight') } },
              { label: currentSetType === 'myorep' ? '✓ Myorep' : 'Myorep', onClick: () => { close(); updateSet(currentEx.exercise_id, activeSet.set_num, 'set_type', 'myorep') } },
              // myorep_match is meaningless on the first set — it must reference a prior set.
              ...(activeSet.set_num > 1 ? [{ label: currentSetType === 'myorep_match' ? '✓ Myorep match' : 'Myorep match', onClick: () => { close(); updateSet(currentEx.exercise_id, activeSet.set_num, 'set_type', 'myorep_match') } }] : []),
              ...(canRemoveSet ? [{ label: `Remove this set`, variant: 'danger' as const, onClick: () => { close(); handleRemoveSet(currentEx.exercise_id, activeSet.set_num) } }] : []),
            ]}
          />
        )
      })()}

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
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  STATE A — logging                                                  */
/* ─────────────────────────────────────────────────────────────────── */

interface LoggingStateProps {
  currentEx: MesoExercise & { workingSets: WorkingSet[] }
  activeSet: WorkingSet
  activeSetIdx: number
  skippedSets: Set<string>
  onUpdateSet: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => void
  onCompleteSet: (exerciseId: string, setNum: number) => void
  onAddSet: (exerciseId: string) => void
  onChipTap: (setIdx: number) => void
  onChipMore: () => void
  onOpenHistory: () => void
  onAdvanceExercise: () => void
  hasNextExercise: boolean
  isSaving: boolean
}

function LoggingState({
  currentEx, activeSet, activeSetIdx, skippedSets,
  onUpdateSet, onCompleteSet, onAddSet, onChipTap, onChipMore,
  onOpenHistory, onAdvanceExercise, hasNextExercise, isSaving,
}: LoggingStateProps) {
  const c = getMuscleColor(currentEx.muscle_group)

  // Cross-meso "last session" reference (Commit 2's history endpoint).
  const { data: history } = useExerciseHistory(currentEx.exercise_id)
  const previousSession = history?.find(h => h.sets.length > 0) ?? null
  const lastSummary = previousSession ? formatHistorySummary(previousSession.sets) : null

  const weight = activeSet.weight ?? 0
  const reps = activeSet.reps ?? 0
  const isLogValid = weight > 0 && reps > 0
  const isActiveLogged = !!activeSet.completed
  const allDone = currentEx.workingSets.every(
    s => s.completed || skippedSets.has(`${currentEx.exercise_id}:${s.set_num}`),
  )

  // LOG button label adapts to what the user is doing.
  const logLabel = isActiveLogged ? 'UPDATE' : 'LOG'

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

      <div style={{ marginTop: 24 }}>
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
        />
      </div>

      {/* Set chips ─ persistent set_type badge + "..." on active chip ─── */}
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
                onClick={() => onChipTap(i)}
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
                  }}
                >
                  SET {i + 1}
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

              {/* "..." button on the active chip → opens per-set sheet */}
              {isActive && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChipMore() }}
                  aria-label="Set options"
                  style={{
                    position: 'absolute',
                    top: 1, right: 1,
                    width: 22, height: 22,
                    background: 'transparent',
                    border: 'none',
                    color: c.light,
                    display: 'grid', placeItems: 'center',
                    cursor: 'pointer',
                    fontSize: 14,
                  }}
                >
                  ⋯
                </button>
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
/*  STATE C — session complete                                         */
/* ─────────────────────────────────────────────────────────────────── */

interface SessionCompleteHeroProps {
  template: WorkoutTemplate
  exerciseList: Array<MesoExercise & { workingSets: WorkingSet[] }>
  isLastSession: boolean
  isSaving: boolean
  onFinish: () => void
  onReviewSets: () => void
}

function SessionCompleteHero({
  template, exerciseList, isLastSession, isSaving, onFinish, onReviewSets,
}: SessionCompleteHeroProps) {
  const totalSets = exerciseList.reduce((n, ex) => n + ex.workingSets.filter(s => s.completed).length, 0)
  const exerciseCount = exerciseList.length
  const dayOrdinal = ORDINAL_WORDS[template.session_index] ?? String(template.session_index + 1)

  return (
    <div
      style={{
        minHeight: 'calc(100vh - 260px)',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', marginTop: 24,
      }}
    >
      <div
        style={{
          fontSize: 11, color: 'var(--accent-l)', letterSpacing: '0.22em',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 600,
          textTransform: 'uppercase',
        }}
      >
        Session complete
      </div>
      <div
        className="p-grad-text"
        style={{
          fontSize: 110, fontWeight: 700, letterSpacing: '-0.05em',
          lineHeight: 1.05, paddingBottom: '0.05em', marginTop: 10,
          filter: 'drop-shadow(0 0 40px rgba(var(--accent-rgb),0.4))',
        }}
      >
        Done.
      </div>
      <div
        style={{
          fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
          fontStyle: 'italic', fontSize: 17, color: 'var(--text-2)', marginTop: 8,
        }}
      >
        {template.session_name.toLowerCase()} · day {dayOrdinal}
      </div>
      <div
        style={{
          fontSize: 10, color: 'var(--text-m)', letterSpacing: '0.2em',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          marginTop: 14, fontWeight: 500,
        }}
      >
        {totalSets} SETS · {exerciseCount} {exerciseCount === 1 ? 'EXERCISE' : 'EXERCISES'}
      </div>

      <div style={{ width: '100%', maxWidth: 420, marginTop: 36, padding: '0 8px' }}>
        <button
          type="button"
          onClick={onFinish}
          disabled={isSaving}
          style={{
            position: 'relative',
            width: '100%', height: 58, borderRadius: 16,
            background: 'var(--p-grad-cta)',
            color: 'var(--btn-text)',
            fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
            fontWeight: 500, fontSize: 14,
            letterSpacing: '0.2em',
            border: 'none',
            cursor: isSaving ? 'not-allowed' : 'pointer',
            opacity: isSaving ? 0.7 : 1,
            boxShadow:
              '0 14px 40px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
          }}
        >
          {isSaving ? 'SAVING…' : isLastSession ? 'FINISH MESOCYCLE' : 'FINISH'}
        </button>
        <button
          type="button"
          onClick={onReviewSets}
          style={{
            marginTop: 10, width: '100%', height: 50, borderRadius: 14,
            background: 'transparent',
            border: '1px solid rgba(255,255,255,0.08)',
            color: 'var(--text-2)', fontWeight: 500, fontSize: 14,
            cursor: 'pointer',
          }}
        >
          Review sets
        </button>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Menu sheet rows                                                    */
/* ─────────────────────────────────────────────────────────────────── */

