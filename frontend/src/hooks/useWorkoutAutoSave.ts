import { useState, useEffect, useCallback, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useToast } from '../components/Toast'
import { useLogSets, queryKeys } from '../api/hooks'
import type { WorkingSet, WorkoutTemplate } from '../types'

interface UseWorkoutAutoSaveParams {
  mesocycleId: string | undefined
  template: WorkoutTemplate | undefined
  isFutureSession: boolean
  sets: WorkingSet[]
  initialized: boolean
  skippedExercises: Set<string>
  skippedSets: Set<string>
  animPhaseRef: React.MutableRefObject<Map<string, 'saving' | 'success'>>
  bumpAnim: () => void
  modifyingRef: React.MutableRefObject<boolean>
  prevCompletedRef: React.MutableRefObject<number>
  prevSkippedRef: React.MutableRefObject<string>
}

export function useWorkoutAutoSave({
  mesocycleId,
  template,
  isFutureSession,
  sets,
  initialized,
  skippedExercises,
  skippedSets,
  animPhaseRef,
  bumpAnim,
  modifyingRef,
  prevCompletedRef,
  prevSkippedRef,
}: UseWorkoutAutoSaveParams) {
  const toast = useToast()
  const queryClient = useQueryClient()
  const logSets = useLogSets()
  const [isSaving, setIsSaving] = useState(false)
  const pendingSavesRef = useRef(0)
  const prevSkippedSetsRef = useRef<string>('')

  const triggerAutoSave = useCallback((currentSets: WorkingSet[], currentSkipped?: Set<string>, currentSkippedSets?: Set<string>) => {
    if (!mesocycleId || !template || isFutureSession || modifyingRef.current) return
    const skipped = currentSkipped ?? skippedExercises
    const skipSets = currentSkippedSets ?? skippedSets
    const completed = currentSets.filter(s => s.completed && !skipped.has(s.exercise_id))

    // Build exercise updates for skipped state
    const exerciseUpdates = template.exercises.map(ex => ({
      exercise_id: ex.exercise_id,
      skipped: skipped.has(ex.exercise_id),
    }))

    // Build skipped sets payload
    const skippedSetsPayload = [...skipSets].map(key => {
      const parts = key.split(':')
      return { exercise_id: parts[0]!, set_num: parseInt(parts[1]!) }
    })

    // Snapshot keys currently in 'saving' phase
    const savingKeys = [...animPhaseRef.current.entries()]
      .filter(([, phase]) => phase === 'saving')
      .map(([key]) => key)

    pendingSavesRef.current++
    setIsSaving(true)

    logSets.mutateAsync({
      mesocycle_id: mesocycleId,
      week_index: template.week_index,
      session_index: template.session_index,
      sets: completed.map(s => ({
        exercise_id: s.exercise_id,
        set_num: s.set_num,
        weight: s.weight ?? 0,
        reps: s.reps ?? 0,
        rir: s.rir,
        set_type: s.set_type ?? null,
      })),
      notes: null,
      exercise_updates: exerciseUpdates,
      skipped_sets: skippedSetsPayload.length > 0 ? skippedSetsPayload : null,
    }).then(() => {
      // Update cached templates so navigating away and back shows correct logged state
      const loggedKeys = new Set(
        completed.map(s => `${s.exercise_id}:${s.set_num}`)
      )
      const skippedIds = new Set(
        exerciseUpdates.filter(eu => eu.skipped).map(eu => eu.exercise_id)
      )

      queryClient.setQueriesData<WorkoutTemplate>(
        { queryKey: ['workouts', 'template', mesocycleId] },
        (old) => {
          if (!old) return old
          return {
            ...old,
            exercises: old.exercises.map(ex => ({
              ...ex,
              skipped: skippedIds.has(ex.exercise_id),
              sets: ex.sets.map(s => {
                const key = `${ex.exercise_id}:${s.set_num}`
                if (loggedKeys.has(key)) {
                  const logged = completed.find(
                    c => c.exercise_id === ex.exercise_id && c.set_num === s.set_num
                  )!
                  return { ...s, weight: logged.weight, reps: logged.reps, rir: logged.rir, logged: true, set_type: logged.set_type ?? s.set_type }
                }
                return { ...s, logged: false }
              }),
            })),
          }
        }
      )

      // Invalidate mesocycle caches (they compute derived fields server-side)
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.detail(mesocycleId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.mesocycles.active })
      queryClient.invalidateQueries({ queryKey: queryKeys.workouts.history(mesocycleId) })
    }).catch(() => {
      toast.showError('Auto-save failed')
      // On error, remove saving keys so no success animation plays
      for (const key of savingKeys) animPhaseRef.current.delete(key)
      bumpAnim()
    }).finally(() => {
      pendingSavesRef.current--
      if (pendingSavesRef.current === 0) setIsSaving(false)

      // Transition remaining 'saving' → 'success'
      for (const key of savingKeys) {
        if (animPhaseRef.current.get(key) === 'saving') {
          animPhaseRef.current.set(key, 'success')
        }
      }
      bumpAnim()

      // Clean up 'success' entries after animation completes
      setTimeout(() => {
        for (const key of savingKeys) {
          if (animPhaseRef.current.get(key) === 'success') {
            animPhaseRef.current.delete(key)
          }
        }
        bumpAnim()
      }, 600)
    })
  }, [mesocycleId, template, logSets, toast, isFutureSession, skippedExercises, skippedSets, bumpAnim, queryClient, animPhaseRef, modifyingRef])

  // Trigger auto-save when completed count or skipped state changes
  useEffect(() => {
    if (!initialized) return
    const count = sets.filter(s => s.completed).length
    const skippedKey = [...skippedExercises].sort().join(',')
    const skippedSetsKey = [...skippedSets].sort().join(',')
    if (count !== prevCompletedRef.current || skippedKey !== prevSkippedRef.current || skippedSetsKey !== prevSkippedSetsRef.current) {
      triggerAutoSave(sets, skippedExercises, skippedSets)
    }
    prevCompletedRef.current = count
    prevSkippedRef.current = skippedKey
    prevSkippedSetsRef.current = skippedSetsKey
  }, [sets, initialized, triggerAutoSave, skippedExercises, skippedSets, prevCompletedRef, prevSkippedRef])

  return { isSaving, setIsSaving, pendingSavesRef, logSets }
}
