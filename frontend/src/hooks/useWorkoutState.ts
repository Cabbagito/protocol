import { useState, useEffect, useCallback } from 'react'
import { resolveSetWeight } from '../lib/setDefaults'
import type { WorkingSet, WorkoutTemplate } from '../types'

interface UseWorkoutStateParams {
  template: WorkoutTemplate | undefined
  isFutureSession: boolean
  weekParam: string | null
  sessionParam: string | null
  animPhaseRef: React.MutableRefObject<Map<string, 'saving' | 'success'>>
  setAnimKey: (exerciseId: string, setNum: number) => string
  bumpAnim: () => void
  prevCompletedRef: React.MutableRefObject<number>
  prevSkippedRef: React.MutableRefObject<string>
}

export function useWorkoutState({
  template,
  isFutureSession,
  weekParam,
  sessionParam,
  animPhaseRef,
  setAnimKey,
  bumpAnim,
  prevCompletedRef,
  prevSkippedRef,
}: UseWorkoutStateParams) {
  const [sets, setSets] = useState<WorkingSet[]>([])
  const [initialized, setInitialized] = useState(false)
  const [skippedExercises, setSkippedExercises] = useState<Set<string>>(new Set())
  const [skippedSets, setSkippedSets] = useState<Set<string>>(new Set())
  const [removedExercises, setRemovedExercises] = useState<Set<string>>(new Set())
  const [exerciseNotes, setExerciseNotes] = useState<Record<string, string>>({})

  // Reset state when navigating to a different session
  useEffect(() => {
    setInitialized(false)
    setSets([])
    setSkippedExercises(new Set())
    setSkippedSets(new Set())
    setRemovedExercises(new Set())
    setExerciseNotes({})
    prevCompletedRef.current = 0
    prevSkippedRef.current = ''
    animPhaseRef.current.clear()
  }, [weekParam, sessionParam, animPhaseRef, prevCompletedRef, prevSkippedRef])

  // Initialize from template
  useEffect(() => {
    if (template && !initialized) {
      const initialSets: WorkingSet[] = []
      const initialSkipped = new Set<string>()
      const initialSkippedSets = new Set<string>()
      for (const ex of template.exercises) {
        if (ex.skipped) initialSkipped.add(ex.exercise_id)
        for (const s of ex.sets) {
          if (s.skipped) initialSkippedSets.add(`${ex.exercise_id}:${s.set_num}`)
          initialSets.push({
            ...s,
            exercise_id: ex.exercise_id,
            exercise_name: ex.exercise_name,
            weight: resolveSetWeight(s),
            reps: s.reps ?? 0,
            rir: template.target_rir >= 0 ? template.target_rir : null,
            completed: s.logged,
            set_type: s.set_type,
          })
        }
      }
      setSets(initialSets)
      setSkippedExercises(initialSkipped)
      setSkippedSets(initialSkippedSets)
      setExerciseNotes(template.exercise_notes ?? {})
      prevCompletedRef.current = initialSets.filter(s => s.completed).length
      prevSkippedRef.current = [...initialSkipped].sort().join(',')
      setInitialized(true)
    }
  }, [template, initialized, prevCompletedRef, prevSkippedRef])

  const updateSet = useCallback((exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => {
    if (isFutureSession) return
    setSets((prev) => {
      if (field !== 'weight') {
        return prev.map((s) =>
          s.exercise_id === exerciseId && s.set_num === setNum
            ? { ...s, [field]: value }
            : s
        )
      }
      const oldWeight = prev.find(
        (s) => s.exercise_id === exerciseId && s.set_num === setNum
      )?.weight ?? null

      const numValue = value as number
      return prev.map((s) => {
        if (s.exercise_id !== exerciseId) return s
        if (s.set_num === setNum) return { ...s, weight: numValue }
        if (
          s.set_num > setNum &&
          !s.completed &&
          (s.set_type ?? 'straight') !== 'myorep_match' &&
          (s.weight === oldWeight || s.weight === null || s.weight === 0)
        ) {
          return { ...s, weight: numValue }
        }
        return s
      })
    })
  }, [isFutureSession])

  const completeSet = useCallback((exerciseId: string, setNum: number) => {
    if (isFutureSession) return
    animPhaseRef.current.set(setAnimKey(exerciseId, setNum), 'saving')
    bumpAnim()
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, completed: true }
          : s
      )
    )
  }, [isFutureSession, setAnimKey, bumpAnim, animPhaseRef])

  const uncompleteSet = useCallback((exerciseId: string, setNum: number) => {
    if (isFutureSession) return
    animPhaseRef.current.delete(setAnimKey(exerciseId, setNum))
    bumpAnim()
    setSets((prev) =>
      prev.map((s) =>
        s.exercise_id === exerciseId && s.set_num === setNum
          ? { ...s, completed: false }
          : s
      )
    )
  }, [isFutureSession, setAnimKey, bumpAnim, animPhaseRef])

  const toggleSkip = useCallback((exerciseId: string) => {
    setSkippedExercises(prev => {
      const next = new Set(prev)
      if (next.has(exerciseId)) {
        next.delete(exerciseId)
        // Also clear individual set skips for this exercise
        setSkippedSets(prevSets => {
          const nextSets = new Set(prevSets)
          for (const key of nextSets) {
            if (key.startsWith(`${exerciseId}:`)) nextSets.delete(key)
          }
          return nextSets
        })
      } else {
        next.add(exerciseId)
        // Mark all unlogged sets as skipped
        setSets(currentSets => {
          setSkippedSets(prevSets => {
            const nextSets = new Set(prevSets)
            for (const s of currentSets) {
              if (s.exercise_id === exerciseId && !s.completed) {
                nextSets.add(`${exerciseId}:${s.set_num}`)
              }
            }
            return nextSets
          })
          return currentSets
        })
      }
      return next
    })
  }, [])

  const toggleSkipSet = useCallback((exerciseId: string, setNum: number) => {
    const key = `${exerciseId}:${setNum}`
    setSkippedSets(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const removeExercise = useCallback((exerciseId: string) => {
    setRemovedExercises(prev => {
      const next = new Set(prev)
      next.add(exerciseId)
      return next
    })
    // Also mark as skipped so it's excluded from save
    setSkippedExercises(prev => {
      const next = new Set(prev)
      next.add(exerciseId)
      return next
    })
  }, [])

  const resetForReplace = useCallback(() => {
    setInitialized(false)
    setSets([])
  }, [])

  return {
    sets,
    setSets,
    initialized,
    skippedExercises,
    skippedSets,
    setSkippedSets,
    removedExercises,
    exerciseNotes,
    setExerciseNotes,
    updateSet,
    completeSet,
    uncompleteSet,
    toggleSkip,
    toggleSkipSet,
    removeExercise,
    resetForReplace,
  }
}
