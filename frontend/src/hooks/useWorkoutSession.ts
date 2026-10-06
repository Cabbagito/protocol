import { useCallback, useEffect, useRef, useState } from 'react'
import { getUserId } from '../lib/auth'
import { workoutSync } from '../lib/workoutSync'
import { blankSet, sessionFromServer, type SessionExercise, type SessionSet } from '../lib/workoutSession'
import type { MesoSession, SetType } from '../types'

interface Params {
  mesocycleId: string
  weekIndex: number
  sessionIndex: number
  /** The session as currently known (server data + unsynced local drafts). */
  session: MesoSession
  readOnly: boolean
}

type Urgency = 'urgent' | 'edit'

/**
 * Local state of one workout session. Initialized once from `session`
 * (mount the owning component with a key per session); afterwards local
 * state is authoritative. Every action is persisted to the phone right away
 * and synced in the background — merely opening a session never saves.
 */
export function useWorkoutSession({ mesocycleId, weekIndex, sessionIndex, session, readOnly }: Params) {
  const [exercises, setExercises] = useState<SessionExercise[]>(() => sessionFromServer(session))
  const pending = useRef<Urgency | null>(null)

  useEffect(() => {
    const urgency = pending.current
    if (!urgency) return
    pending.current = null
    const userId = getUserId()
    if (!userId) return
    workoutSync.save(
      { userId, mesocycleId, weekIndex, sessionIndex },
      exercises,
      { urgent: urgency === 'urgent' },
    )
  }, [exercises, mesocycleId, weekIndex, sessionIndex])

  // Leaving the page: push whatever is pending without waiting for the debounce.
  useEffect(() => () => workoutSync.schedule(0), [])

  const change = useCallback(
    (urgency: Urgency, fn: (prev: SessionExercise[]) => SessionExercise[]) => {
      if (readOnly) return
      pending.current = pending.current === 'urgent' ? 'urgent' : urgency
      setExercises(fn)
    },
    [readOnly],
  )

  const updateExercise = useCallback(
    (urgency: Urgency, exerciseId: string, fn: (ex: SessionExercise) => SessionExercise) =>
      change(urgency, prev => prev.map(ex => (ex.exercise_id === exerciseId ? fn(ex) : ex))),
    [change],
  )

  const updateSet = useCallback(
    (urgency: Urgency, exerciseId: string, idx: number, fn: (s: SessionSet) => SessionSet) =>
      updateExercise(urgency, exerciseId, ex => ({
        ...ex,
        sets: ex.sets.map((s, i) => (i === idx ? fn(s) : s)),
      })),
    [updateExercise],
  )

  /** Typing a weight carries it onto later untouched (or same-weight) open sets. */
  const setWeight = useCallback(
    (exerciseId: string, idx: number, weight: number) =>
      updateExercise('edit', exerciseId, ex => {
        const old = ex.sets[idx]?.weight ?? null
        return {
          ...ex,
          sets: ex.sets.map((s, i) => {
            if (i === idx) return { ...s, weight }
            if (
              i > idx && !s.logged && s.set_type !== 'myorep_match' &&
              (s.weight === null || s.weight === old)
            ) {
              return { ...s, weight }
            }
            return s
          }),
        }
      }),
    [updateExercise],
  )

  const setReps = useCallback(
    (exerciseId: string, idx: number, reps: number) =>
      updateSet('edit', exerciseId, idx, s => ({ ...s, reps })),
    [updateSet],
  )

  const setSetType = useCallback(
    (exerciseId: string, idx: number, type: SetType) =>
      updateSet('urgent', exerciseId, idx, s => ({ ...s, set_type: type === 'straight' ? null : type })),
    [updateSet],
  )

  /** Log (or re-log) a set with the values shown on screen. */
  const logSet = useCallback(
    (exerciseId: string, idx: number, weight: number, reps: number) =>
      updateSet('urgent', exerciseId, idx, s => ({ ...s, weight, reps, logged: true, skipped: false })),
    [updateSet],
  )

  const toggleSkipSet = useCallback(
    (exerciseId: string, idx: number) =>
      updateSet('urgent', exerciseId, idx, s => (s.logged ? s : { ...s, skipped: !s.skipped })),
    [updateSet],
  )

  const addSet = useCallback(
    (exerciseId: string) =>
      updateExercise('urgent', exerciseId, ex => {
        const last = ex.sets[ex.sets.length - 1]
        // A new set starts at the previous set's typed weight, if any.
        return { ...ex, sets: [...ex.sets, { ...blankSet(), weight: last?.weight ?? null }] }
      }),
    [updateExercise],
  )

  const removeSet = useCallback(
    (exerciseId: string, idx: number) =>
      updateExercise('urgent', exerciseId, ex =>
        ex.sets.length <= 1 ? ex : { ...ex, sets: ex.sets.filter((_, i) => i !== idx) },
      ),
    [updateExercise],
  )

  const toggleSkipExercise = useCallback(
    (exerciseId: string) => updateExercise('urgent', exerciseId, ex => ({ ...ex, skipped: !ex.skipped })),
    [updateExercise],
  )

  /** Replace local state with fresh server data (after a server-side change). */
  const resetFrom = useCallback((fresh: MesoSession) => {
    pending.current = null
    setExercises(sessionFromServer(fresh))
  }, [])

  return {
    exercises,
    setWeight,
    setReps,
    setSetType,
    logSet,
    toggleSkipSet,
    addSet,
    removeSet,
    toggleSkipExercise,
    resetFrom,
  }
}
