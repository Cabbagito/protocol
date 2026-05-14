import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { useLogSets, queryKeys } from '../api/hooks'
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
}: UseWorkoutCompletionParams) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const toast = useToast()

  const isLastSession = useMemo(() => {
    if (!mesocycle || !template) return false
    return getNextSession(template.week_index, template.session_index, mesocycle) === null
  }, [mesocycle, template])

  const handleFinishOrNext = async () => {
    if (pendingSavesRef.current > 0) {
      setIsSaving(true)
      await new Promise<void>(resolve => {
        const check = setInterval(() => {
          if (pendingSavesRef.current === 0) { clearInterval(check); resolve() }
        }, 100)
      })
    }

    // Send final save with complete=true to trigger progression + performance tracking
    if (mesocycleId && template && !isFutureSession) {
      const completed = sets.filter(s => s.completed && !skippedExercises.has(s.exercise_id))
      const exerciseUpdates = template.exercises.map(ex => ({
        exercise_id: ex.exercise_id,
        skipped: skippedExercises.has(ex.exercise_id),
      }))
      try {
        await logSets.mutateAsync({
          mesocycle_id: mesocycleId,
          week_index: template.week_index,
          session_index: template.session_index,
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
          complete: true,
        })
      } catch {
        toast.showError('Failed to finalize workout')
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
