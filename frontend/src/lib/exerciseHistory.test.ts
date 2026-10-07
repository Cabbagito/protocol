import { describe, expect, it } from 'vitest'
import { chipLayout, groupByMesocycle, historySlots, usualCount, type ExerciseSessionHistory } from './exerciseHistory'
import type { MesoSet } from '../types'

const set = (n: number, weight = 70, reps = 10): MesoSet => ({ set_num: n, weight, reps, logged: true })
const entry = (meso_id: string, date: string): ExerciseSessionHistory => ({
  meso_id, meso_name: meso_id, week_index: 0, session_index: 0, week_number: 1,
  session_name: 'Pull', date, meso_started_at: `${date}T00:00:00`, sets: [set(1)],
})

describe('historySlots', () => {
  it('keeps a skipped set as a blank so later sets stay in place', () => {
    const slots = historySlots([set(1), set(2), set(4)])
    expect(slots.map(s => s?.set_num ?? null)).toEqual([1, 2, null, 4])
  })
})

describe('groupByMesocycle', () => {
  it('groups consecutive sessions of one mesocycle, newest first', () => {
    const blocks = groupByMesocycle([entry('b', '2026-02-02'), entry('b', '2026-01-26'), entry('a', '2025-12-01')])
    expect(blocks.map(b => [b.mesoId, b.sessions.length])).toEqual([['b', 2], ['a', 1]])
  })
})

describe('usualCount', () => {
  it('picks the most common set count, the larger on ties', () => {
    expect(usualCount([3, 3, 4, 2, 3])).toBe(3)
    expect(usualCount([2, 3])).toBe(3)
  })
})

describe('chipLayout', () => {
  it('puts a usual 3 sets beside the date with room for a fourth', () => {
    const l = chipLayout(335, 5, 3)
    expect(l.beside).toBe(true)
    expect(l.perLine).toBeGreaterThanOrEqual(4)
  })

  it('moves the date above 6 sets that would not fit beside it, keeping all 6 on one line', () => {
    const l = chipLayout(335, 5, 6)
    expect(l.beside).toBe(false)
    expect(l.perLine).toBeGreaterThanOrEqual(6)
  })

  it('never makes a chip narrower than its numbers', () => {
    expect(chipLayout(335, 8, 8).chipWidth).toBeGreaterThanOrEqual(Math.ceil(8 * 7.6 + 6))
  })
})
