import type { MesoStructure, MesoSet } from '../types'
import { formatWeight } from './weightUtils'

export interface ExerciseSessionHistory {
  weekNumber: number
  date: string | null
  rir: number
  sets: MesoSet[]
}

/**
 * Extract history for a specific exercise from previous weeks in the mesocycle structure.
 * Returns sessions newest-first (reverse chronological).
 */
export function getExerciseHistory(
  structure: MesoStructure,
  exerciseId: string,
  currentWeekIndex: number,
  sessionIndex: number,
): ExerciseSessionHistory[] {
  const history: ExerciseSessionHistory[] = []

  for (let w = currentWeekIndex - 1; w >= 0; w--) {
    const week = structure.weeks[w]
    if (!week) continue
    const session = week.sessions[sessionIndex]
    if (!session) continue

    const exercise = session.exercises.find(e => e.exercise_id === exerciseId)
    if (!exercise) continue

    const loggedSets = exercise.sets.filter(s => s.logged && !s.skipped)
    if (loggedSets.length === 0) continue

    history.push({
      weekNumber: week.week_number,
      date: session.date,
      rir: week.rir,
      sets: loggedSets,
    })
  }

  return history
}

/**
 * Format a compact one-line summary of a set of logged sets.
 * - All same weight & reps: "3×10 @ 60kg"
 * - Same weight, diff reps: "60kg · 10, 10, 8"
 * - Different weights: "3 sets · 55–65kg"
 */
export function formatHistorySummary(sets: MesoSet[]): string | null {
  const valid = sets.filter(s => s.weight != null && s.weight > 0 && s.reps != null && s.reps > 0)
  if (valid.length === 0) return null

  const weights = valid.map(s => s.weight!)
  const reps = valid.map(s => s.reps!)

  const firstWeight = weights[0]!
  const firstReps = reps[0]!
  const allSameWeight = weights.every(w => w === firstWeight)

  if (allSameWeight) {
    const allSameReps = reps.every(r => r === firstReps)
    const w = formatWeight(firstWeight)
    if (allSameReps) {
      return `${valid.length}×${firstReps} @ ${w}kg`
    }
    return `${w}kg · ${reps.join(', ')}`
  }

  const minW = formatWeight(Math.min(...weights))
  const maxW = formatWeight(Math.max(...weights))
  return `${valid.length} sets · ${minW}–${maxW}kg`
}
