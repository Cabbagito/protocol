import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { useLogSets, queryKeys } from '../api/hooks'
import { todayIso } from '../lib/dates'
import type { WorkingSet, WorkoutTemplate, Mesocycle } from '../types'

function getNextSession(weekIndex: number, sessionIndex: number, mesocycle: Mesocycle) {
  const weeks = mesocycle.structure.weeks
  const currentWeek = weeks[weekIndex]
  if (currentWeek && sessionIndex + 1 < currentWeek.sessions.length)
    return { weekIndex, sessionIndex: sessionIndex + 1 }
  if (weekIndex + 1 < weeks.length)
    return { weekIndex: weekIndex + 1, sessionIndex: 0 }
  return null
}

interface UseWorkoutCompletionParams {
  mesocycleId: string | undefined
  template: WorkoutTemplate | undefined
  mesocycle: Mesocycle | undefined
  sets: WorkingSet[]
  skippedExercises: Set<string>
  skippedSets: Set<string>
  isFutureSession: boolean
  isSaving: boolean
  setIsSaving: (saving: boolean) => void
  pendingSavesRef: React.MutableRefObject<number>
  logSets: ReturnType<typeof useLogSets>
  saveChainRef: React.MutableRefObject<Promise<void>>
  cancelDebouncedSave: () => void
}

export function useWorkoutCompletion({
  mesocycleId,
  template,
  mesocycle,
  sets,
  skippedExercises,
  skippedSets,
  isFutureSession,
  setIsSaving,
  pendingSavesRef,
  logSets,
  saveChainRef,
  cancelDebouncedSave,
}: UseWorkoutCompletionParams) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const isLastSession = useMemo(() => {
    if (!mesocycle || !template) return false
    return getNextSession(template.week_index, template.session_index, mesocycle) === null
  }, [mesocycle, template])

  const handleFinishOrNext = async () => {
    // A debounced edit-save may still be queued; cancel it — the final save
    // below carries the full current state (including drafts) itself.
    cancelDebouncedSave()

    if (pendingSavesRef.current > 0) setIsSaving(true)
    // Wait for all in-flight saves; the chain never rejects (errors are
    // handled per-save inside useWorkoutAutoSave).
    await saveChainRef.current

    // Send final save with complete=true to carry weights forward
    if (mesocycleId && template && !isFutureSession) {
      const completed = sets.filter(s => s.completed && !skippedExercises.has(s.exercise_id))
      const uncompleted = sets.filter(s => !s.completed && !skippedExercises.has(s.exercise_id) && !skippedSets.has(`${s.exercise_id}:${s.set_num}`))
      const exerciseUpdates = template.exercises.map(ex => ({
        exercise_id: ex.exercise_id,
        skipped: skippedExercises.has(ex.exercise_id),
      }))
      try {
        await logSets.mutateAsync({
          mesocycle_id: mesocycleId,
          week_index: template.week_index,
          session_index: template.session_index,
          logged_on: todayIso(),
          sets: completed.map(s => ({
            exercise_id: s.exercise_id,
            set_num: s.set_num,
            weight: s.weight ?? 0,
            reps: s.reps ?? 0,
            set_type: s.set_type ?? null,
          })),
          notes: null,
          exercise_updates: exerciseUpdates,
          skipped_sets: skippedSets.size > 0 ? [...skippedSets].map(key => {
            const parts = key.split(':')
            return { exercise_id: parts[0]!, set_num: parseInt(parts[1]!) }
          }) : null,
          draft_sets: uncompleted.length > 0 ? uncompleted.map(s => ({
            exercise_id: s.exercise_id,
            set_num: s.set_num,
            weight: s.weight,
            reps: s.reps,
          })) : null,
          complete: true,
        })
      } catch {
        toast.showError('Failed to finalize workout')
      } finally {
        setIsSaving(false)
      }
    }

    queryClient.invalidateQueries({ queryKey: queryKeys.workouts.all })
    queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
    queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.all })

    if (isLastSession) {
      navigate(`/mesocycles/${mesocycleId}`)
    } else {
      const next = getNextSession(template!.week_index, template!.session_index, mesocycle!)
      navigate(`/workout/${mesocycleId}?week=${next!.weekIndex}&session=${next!.sessionIndex}`)
    }
  }

  return { isLastSession, handleFinishOrNext }
}
