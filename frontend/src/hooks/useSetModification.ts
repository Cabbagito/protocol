import { useCallback } from 'react'
import { useToast } from '../components/Toast'
import { useModifySets } from '../api/hooks'
import { buildWorkingSet } from '../lib/setDefaults'
import type { WorkingSet, WorkoutTemplate } from '../types'

interface UseSetModificationParams {
  mesocycleId: string | undefined
  template: WorkoutTemplate | undefined
  sets: WorkingSet[]
  setSets: React.Dispatch<React.SetStateAction<WorkingSet[]>>
  setSkippedSets: React.Dispatch<React.SetStateAction<Set<string>>>
  modifyingRef: React.MutableRefObject<boolean>
}

export function useSetModification({
  mesocycleId,
  template,
  sets,
  setSets,
  setSkippedSets,
  modifyingRef,
}: UseSetModificationParams) {
  const toast = useToast()
  const modifySets = useModifySets()

  const handleAddSet = useCallback(async (exerciseId: string) => {
    if (!mesocycleId || !template) return
    modifyingRef.current = true
    try {
      const result = await modifySets.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_id: exerciseId,
        action: 'add',
      })
      // Find exercise name from current sets
      const existingSet = sets.find(s => s.exercise_id === exerciseId)
      const exerciseName = existingSet?.exercise_name ?? ''
      // Replace sets for this exercise with response data
      setSets(prev => {
        const otherSets = prev.filter(s => s.exercise_id !== exerciseId)
        // Preserve all locally-entered data for existing unlogged sets
        const localValues = new Map<number, WorkingSet>()
        prev.filter(s => s.exercise_id === exerciseId && !s.completed)
          .forEach(s => localValues.set(s.set_num, s))
        const newSets: WorkingSet[] = result.sets.map(s => {
          const local = !s.logged ? localValues.get(s.set_num) : undefined
          return buildWorkingSet(s, exerciseId, exerciseName, template.target_rir, local)
        })
        // Maintain exercise ordering from template
        const orderedSets: WorkingSet[] = []
        for (const ex of template.exercises) {
          if (ex.exercise_id === exerciseId) {
            orderedSets.push(...newSets)
          } else {
            orderedSets.push(...otherSets.filter(s => s.exercise_id === ex.exercise_id))
          }
        }
        return orderedSets
      })
    } catch {
      toast.showError('Failed to add set')
    } finally {
      modifyingRef.current = false
    }
  }, [mesocycleId, template, modifySets, sets, toast, setSets, modifyingRef])

  const handleRemoveSet = useCallback(async (exerciseId: string, setNum: number) => {
    if (!mesocycleId || !template) return
    modifyingRef.current = true
    try {
      const result = await modifySets.mutateAsync({
        mesocycle_id: mesocycleId,
        week_index: template.week_index,
        session_index: template.session_index,
        exercise_id: exerciseId,
        action: 'remove',
        set_num: setNum,
      })
      const existingSet = sets.find(s => s.exercise_id === exerciseId)
      const exerciseName = existingSet?.exercise_name ?? ''
      // Clear any skip for the removed set
      setSkippedSets(prev => {
        const next = new Set(prev)
        // Remove all skip keys for this exercise and re-map to new set_nums
        for (const key of prev) {
          if (key.startsWith(`${exerciseId}:`)) next.delete(key)
        }
        return next
      })
      setSets(prev => {
        const otherSets = prev.filter(s => s.exercise_id !== exerciseId)
        // Preserve all locally-entered data, mapping old set_nums to new (accounting for removed set)
        const localValues = new Map<number, WorkingSet>()
        prev.filter(s => s.exercise_id === exerciseId && !s.completed && s.set_num !== setNum)
          .forEach(s => {
            const newNum = s.set_num > setNum ? s.set_num - 1 : s.set_num
            localValues.set(newNum, s)
          })
        const newSets: WorkingSet[] = result.sets.map(s => {
          const local = !s.logged ? localValues.get(s.set_num) : undefined
          return buildWorkingSet(s, exerciseId, exerciseName, template.target_rir, local)
        })
        const orderedSets: WorkingSet[] = []
        for (const ex of template.exercises) {
          if (ex.exercise_id === exerciseId) {
            orderedSets.push(...newSets)
          } else {
            orderedSets.push(...otherSets.filter(s => s.exercise_id === ex.exercise_id))
          }
        }
        return orderedSets
      })
    } catch {
      toast.showError('Failed to remove set')
    } finally {
      modifyingRef.current = false
    }
  }, [mesocycleId, template, modifySets, sets, toast, setSets, setSkippedSets, modifyingRef])

  return { handleAddSet, handleRemoveSet }
}
