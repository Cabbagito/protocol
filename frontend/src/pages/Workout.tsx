import { useState, useCallback, useRef, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { useMesocycle, useUpdateExerciseNote, useReplaceExercise, queryKeys } from '../api/hooks'
import { api } from '../api/client'
import PageLoader from '../components/PageLoader'
import AppHeader from '../components/AppHeader'
import RirBadge from '../components/RirBadge'
import MesoGrid from '../components/MesoGrid'
import { getCurrentPosition } from '../lib/mesoUtils'
import { getExerciseHistory } from '../lib/exerciseHistory'
import { useKeyboardVisible } from '../lib/useKeyboardVisible'
import { useAnimPhase } from '../hooks/useAnimPhase'
import { useWorkoutState } from '../hooks/useWorkoutState'
import { useWorkoutAutoSave } from '../hooks/useWorkoutAutoSave'
import { useSetModification } from '../hooks/useSetModification'
import { useWorkoutCompletion } from '../hooks/useWorkoutCompletion'
import { ExerciseCard } from './workout/ExerciseCard'
import { NoteModal } from './workout/NoteModal'
import { ExercisePicker } from './workout/ExercisePicker'
import type { WorkoutTemplate } from '../types'

export default function Workout() {
  const toast = useToast()
  const keyboardOpen = useKeyboardVisible()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { mesocycleId } = useParams<{ mesocycleId: string }>()
  const [searchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const sessionParam = searchParams.get('session')

  // Data fetching
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

  // UI state
  const [headerExpanded, setHeaderExpanded] = useState(false)
  const [noteModal, setNoteModal] = useState<{ exerciseId: string; exerciseName: string } | null>(null)
  const [replaceModal, setReplaceModal] = useState<{ exerciseId: string; exerciseIndex: number; muscleGroup: string; equipmentType: string } | null>(null)

  // Refs shared across hooks
  const modifyingRef = useRef(false)
  const prevCompletedRef = useRef(0)
  const prevSkippedRef = useRef<string>('')

  // Derived state
  const currentPos = useMemo(() => {
    if (!mesocycle) return null
    return getCurrentPosition(mesocycle.structure)
  }, [mesocycle])

  const isFutureSession = useMemo(() => {
    if (!template || !currentPos) return false
    return template.week_index > currentPos.weekIndex
  }, [template, currentPos])

  // Hooks
  const { animPhaseRef, bumpAnim, setAnimKey, clearAnim } = useAnimPhase()

  const {
    sets, setSets, initialized, skippedExercises, skippedSets, setSkippedSets,
    removedExercises, exerciseNotes, setExerciseNotes,
    updateSet, completeSet, uncompleteSet,
    toggleSkip, toggleSkipSet, removeExercise, resetForReplace,
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

  // Current workout info for "go to current" CTA
  const currentWorkoutInfo = useMemo(() => {
    if (!mesocycle || !currentPos) return null
    const session = mesocycle.structure.weeks[currentPos.weekIndex]?.sessions[currentPos.sessionIndex]
    const rir = mesocycle.rir_scheme[currentPos.weekIndex]
    return {
      name: session?.session_name ?? 'Workout',
      week: currentPos.weekIndex + 1,
      rir: rir === -1 ? 'Deload' : `RiR ${rir}`,
    }
  }, [mesocycle, currentPos])

  // Loading / error states
  if (isLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  if (!template) {
    return <div className="text-[var(--text-m)] text-center py-8">Workout template not found</div>
  }

  // Compute completion excluding skipped exercises
  const activeSets = sets.filter(s => !skippedExercises.has(s.exercise_id) && !removedExercises.has(s.exercise_id) && !skippedSets.has(`${s.exercise_id}:${s.set_num}`))
  const completedSets = activeSets.filter(s => s.completed).length
  const totalSets = activeSets.length

  const exerciseGroups = useMemo(() => template.exercises
    .map((ex, idx) => ({
      ...ex,
      exerciseIndex: idx,
      workingSets: sets.filter((s) => s.exercise_id === ex.exercise_id),
      history: mesocycle ? getExerciseHistory(
        mesocycle.structure, ex.exercise_id, template.week_index, template.session_index,
      ) : [],
    }))
    .filter(ex => !removedExercises.has(ex.exercise_id)),
  [template, sets, mesocycle, removedExercises])

  const rirLabel = template.target_rir === -1 ? 'Deload' : `RiR ${template.target_rir}`

  return (
    <div className="pb-20">
      <AppHeader
        title={template.session_name}
        subtitle={isFutureSession ? `Week ${template.week_number} · ${rirLabel}` : `Week ${template.week_number}`}
        rightContent={
          isFutureSession ? (
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg"
              style={{ background: 'rgba(148,163,184,0.1)', border: '1px solid rgba(148,163,184,0.15)' }}
            >
              <svg className="w-3.5 h-3.5" style={{ color: 'var(--text-2)' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
              </svg>
              <span className="text-xs font-medium" style={{ color: 'var(--text-2)' }}>Preview</span>
            </div>
          ) : (
            <RirBadge rir={template.target_rir} />
          )
        }
        progressPercent={isFutureSession ? undefined : (totalSets > 0 ? (completedSets / totalSets) * 100 : 0)}
        drawerContent={mesocycle && (
          <MesoGrid
            mesocycle={mesocycle}
            compact
            viewingWeek={(template.week_index !== currentPos?.weekIndex || template.session_index !== currentPos?.sessionIndex) ? template.week_index : undefined}
            viewingSession={(template.week_index !== currentPos?.weekIndex || template.session_index !== currentPos?.sessionIndex) ? template.session_index : undefined}
          />
        )}
        drawerExpanded={headerExpanded}
        onHeaderAreaClick={() => setHeaderExpanded(prev => !prev)}
      />

      {/* Future session banner */}
      {isFutureSession && (
        <div
          className="mx-2.5 mt-3 px-3 py-2 rounded-lg flex items-center gap-2"
          style={{
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.2)',
          }}
        >
          <svg className="w-4 h-4 flex-shrink-0" style={{ color: '#f59e0b' }} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          <span className="text-xs font-medium" style={{ color: '#f59e0b' }}>
            Complete previous workouts first
          </span>
        </div>
      )}

      {/* Exercise Cards */}
      <div className="px-2.5 pt-4 flex flex-col gap-3" style={isFutureSession ? { opacity: 0.5, pointerEvents: 'none' } : undefined}>
        {exerciseGroups.map((ex) => (
          <ExerciseCard
            key={ex.exercise_id}
            exercise={ex}
            exerciseIndex={ex.exerciseIndex}
            sets={ex.workingSets}
            allSets={sets}
            targetRir={template.target_rir}
            onUpdateSet={updateSet}
            onCompleteSet={completeSet}
            onUncompleteSet={uncompleteSet}
            locked={isFutureSession}
            skipped={skippedExercises.has(ex.exercise_id)}
            onToggleSkip={() => toggleSkip(ex.exercise_id)}
            note={exerciseNotes[ex.exercise_id]}
            onEditNote={() => setNoteModal({ exerciseId: ex.exercise_id, exerciseName: ex.exercise_name })}
            onReplace={() => setReplaceModal({ exerciseId: ex.exercise_id, exerciseIndex: ex.exerciseIndex, muscleGroup: ex.muscle_group, equipmentType: ex.equipment_type })}
            onAddSet={handleAddSet}
            onRemoveSet={handleRemoveSet}
            onToggleSkipSet={toggleSkipSet}
            onRemoveExercise={() => removeExercise(ex.exercise_id)}
            skippedSets={skippedSets}
            animPhaseRef={animPhaseRef}
            onClearAnim={clearAnim}
            history={ex.history}
          />
        ))}
      </div>

      {/* Context-aware sticky button */}
      {!keyboardOpen && !isFutureSession && completedSets === totalSets && totalSets > 0 && (
        <div className="sticky bottom-0 z-30 px-4 pb-3">
          <div className="max-w-lg mx-auto">
            <button
              onClick={handleFinishOrNext}
              disabled={isSaving}
              className="btn btn-primary w-full"
            >
              {isSaving ? 'Saving...' : isLastSession ? 'Finish Mesocycle' : 'Next Workout'}
            </button>
          </div>
        </div>
      )}

      {/* Go to current workout CTA */}
      {!keyboardOpen && isFutureSession && currentWorkoutInfo && (
        <div className="sticky bottom-0 z-30 px-4 pb-3">
          <div className="max-w-lg mx-auto flex flex-col gap-1.5">
            <button
              onClick={() => navigate(`/workout/${mesocycleId}`)}
              className="btn w-full font-medium"
              style={{
                background: 'rgba(var(--accent-rgb),0.15)',
                border: '1.5px solid rgba(var(--accent-rgb),0.3)',
                color: 'var(--accent-l)',
              }}
            >
              Go to Current Workout
            </button>
            <span className="text-[11px] text-center" style={{ color: 'var(--text-m)' }}>
              {currentWorkoutInfo.name} · Week {currentWorkoutInfo.week} · {currentWorkoutInfo.rir}
            </span>
          </div>
        </div>
      )}

      {/* Note Modal */}
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

      {/* Replace Exercise Picker */}
      {replaceModal && (
        <ExercisePicker
          initialMuscleGroup={replaceModal.muscleGroup}
          initialEquipmentType={replaceModal.equipmentType}
          currentExerciseId={replaceModal.exerciseId}
          onSelect={handleReplace}
          onClose={() => setReplaceModal(null)}
        />
      )}
    </div>
  )
}
