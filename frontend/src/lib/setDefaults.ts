import type { MesoSet, SetType, WorkingSet } from '../types'

/**
 * Resolve the display weight for a set.
 * Priority: logged weight > local override > suggested_weight > raw weight > 0
 */
export function resolveSetWeight(set: MesoSet, localWeight?: number | null): number {
  if (set.logged) return set.weight ?? 0
  return localWeight ?? set.suggested_weight ?? set.weight ?? 0
}

/**
 * Resolve the display reps for a set.
 */
export function resolveSetReps(set: MesoSet, localReps?: number | null): number {
  if (set.logged) return set.reps ?? 0
  return localReps ?? set.reps ?? 0
}

/**
 * Resolve the set type for a set.
 */
export function resolveSetType(set: MesoSet, localSetType?: SetType | null): SetType | undefined {
  if (set.logged) return set.set_type
  return localSetType ?? set.set_type
}

/**
 * Build a WorkingSet from a MesoSet, optionally preserving local overrides.
 */
export function buildWorkingSet(
  set: MesoSet,
  exerciseId: string,
  exerciseName: string,
  local?: WorkingSet,
): WorkingSet {
  return {
    ...set,
    exercise_id: exerciseId,
    exercise_name: exerciseName,
    weight: resolveSetWeight(set, local?.weight),
    reps: resolveSetReps(set, local?.reps),
    set_type: resolveSetType(set, local?.set_type),
    completed: set.logged,
  }
}
