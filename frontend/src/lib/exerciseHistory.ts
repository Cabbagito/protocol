import type { MesoSet } from '../types'
import { formatWeight } from './weightUtils'

/**
 * One session's worth of logged sets for an exercise, as returned by
 * GET /api/exercises/{id}/history. Spans all the user's mesocycles.
 */
export interface ExerciseSessionHistory {
  meso_id: string
  meso_name: string
  week_index: number
  session_index: number
  week_number: number
  session_name: string
  date: string | null
  meso_started_at: string
  sets: MesoSet[]
}

/**
 * Format a compact one-line summary of a set of logged sets.
 * - All same weight & reps: "3×10 @ 60kg"
 * - Same weight, diff reps: "60kg · 10, 10, 8"
 * - Different weights: "3 sets · 55–65kg"
 * - Bodyweight-only (0 kg): "3×10 @ BW"
 */
export function formatHistorySummary(sets: MesoSet[]): string | null {
  const valid = sets.filter(s => s.weight != null && s.weight >= 0 && s.reps != null && s.reps > 0)
  if (valid.length === 0) return null

  const weights = valid.map(s => s.weight!)
  const reps = valid.map(s => s.reps!)

  const firstWeight = weights[0]!
  const firstReps = reps[0]!
  const allSameWeight = weights.every(w => w === firstWeight)

  if (allSameWeight) {
    const allSameReps = reps.every(r => r === firstReps)
    const w = firstWeight === 0 ? 'BW' : `${formatWeight(firstWeight)}kg`
    if (allSameReps) {
      return `${valid.length}×${firstReps} @ ${w}`
    }
    return `${w} · ${reps.join(', ')}`
  }

  const minW = formatWeight(Math.min(...weights))
  const maxW = formatWeight(Math.max(...weights))
  return `${valid.length} sets · ${minW}–${maxW}kg`
}
