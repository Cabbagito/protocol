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

// ─── History sheet layout ───────────────────────────────────────────────

/**
 * One session's logged sets by set number, with null where a set was
 * skipped, so set N lands in slot N in every row.
 */
export function historySlots(sets: MesoSet[]): (MesoSet | null)[] {
  const byNum = new Map(sets.map(s => [s.set_num, s]))
  const last = Math.max(0, ...sets.map(s => s.set_num))
  return Array.from({ length: last }, (_, i) => byNum.get(i + 1) ?? null)
}

export interface HistoryBlock {
  mesoId: string
  mesoName: string
  /** Newest first, like the history itself. */
  sessions: ExerciseSessionHistory[]
}

/** Consecutive sessions of the same mesocycle (history is newest first). */
export function groupByMesocycle(history: ExerciseSessionHistory[]): HistoryBlock[] {
  const blocks: HistoryBlock[] = []
  for (const h of history) {
    const last = blocks[blocks.length - 1]
    if (last && last.mesoId === h.meso_id) last.sessions.push(h)
    else blocks.push({ mesoId: h.meso_id, mesoName: h.meso_name, sessions: [h] })
  }
  return blocks
}

/** The most common value (the larger one on ties). */
export function usualCount(counts: number[]): number {
  const tally = new Map<number, number>()
  for (const c of counts) tally.set(c, (tally.get(c) ?? 0) + 1)
  let best = 0
  let bestN = 0
  for (const [c, n] of tally) {
    if (n > bestN || (n === bestN && c > best)) {
      best = c
      bestN = n
    }
  }
  return best
}

export interface ChipLayout {
  /** Date beside the chips (else above them). */
  beside: boolean
  chipWidth: number
  perLine: number
}

export const CHIP_GAP = 4
/** Date column plus its gap, when the date sits beside the chips. */
export const DATE_COLUMN = 64
const GLYPH_PX = 7.6
const MAX_CHIP = 76

/**
 * Every chip of one exercise gets the same width, sized for its usual set
 * count plus one spare (so a one-off extra set fits) but never narrower than
 * its longest "weight×reps". When the usual sets don't fit beside the date,
 * the date moves above them; sets beyond `perLine` wrap.
 */
export function chipLayout(rowWidth: number, longestLabel: number, usual: number): ChipLayout {
  const minChip = Math.ceil(longestLabel * GLYPH_PX + 6)
  const n = Math.max(1, usual)
  const beside = n * minChip + (n - 1) * CHIP_GAP <= rowWidth - DATE_COLUMN
  const area = beside ? rowWidth - DATE_COLUMN : rowWidth
  const chipWidth = Math.floor(Math.min(MAX_CHIP, Math.max(minChip, (area - n * CHIP_GAP) / (n + 1))))
  const perLine = Math.max(1, Math.floor((area + CHIP_GAP) / (chipWidth + CHIP_GAP)))
  return { beside, chipWidth, perLine }
}
