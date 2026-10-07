import { describe, expect, it } from 'vitest'
import {
  earlierPerformances, liftChange, previousInstance, sessionTotals, setsByMuscle,
} from './workoutReview'
import type { ExerciseSessionHistory } from './exerciseHistory'
import type { MesoExercise, MesoSession, MesoSet, Mesocycle } from '../types'

const logged = (n: number, weight: number, reps: number): MesoSet => ({
  set_num: n, weight, reps, logged: true,
})
const open = (n: number): MesoSet => ({ set_num: n, weight: null, reps: null, logged: false })
const ex = (id: string, sets: MesoSet[], muscle = 'back'): MesoExercise => ({
  exercise_id: id, exercise_name: id, muscle_group: muscle, equipment_type: 'cable', sets,
})
const session = (exercises: MesoExercise[], date: string | null): MesoSession => ({
  session_name: 'Pull', day_order: 0, date, notes: null, exercises,
})
const meso = (sessions: MesoSession[]): Mesocycle => ({
  id: 'm2', name: 'Block 2', split_id: null, split_name: null, split_color: null,
  total_weeks: sessions.length, current_week: 1, is_active: true,
  started_at: '2026-02-01T00:00:00', workouts_completed: 0,
  structure: { weeks: sessions.map((s, i) => ({ week_number: i + 1, sessions: [s] })) },
})
const history = (meso_id: string, date: string, sets: MesoSet[]): ExerciseSessionHistory => ({
  meso_id, meso_name: meso_id, week_index: 0, session_index: 0, week_number: 1,
  session_name: 'Pull', date, meso_started_at: `${date}T00:00:00`, sets,
})

describe('earlierPerformances', () => {
  const m = meso([
    session([ex('row', [logged(1, 60, 10)])], '2026-02-02'),
    session([ex('row', [logged(1, 62.5, 9)])], '2026-02-09'),
    session([ex('row', [logged(1, 65, 8)])], '2026-02-16'),
  ])

  it('lists only sessions before the reviewed one, oldest first', () => {
    const out = earlierPerformances(m, 1, 0, 'row', undefined)
    expect(out.map(p => p.date)).toEqual(['2026-02-02'])
  })

  it('includes older mesocycles but not newer ones or this one from the server', () => {
    const out = earlierPerformances(m, 2, 0, 'row', [
      history('m3', '2026-04-01', [logged(1, 70, 8)]),
      history('m2', '2026-02-09', [logged(1, 1, 1)]),
      history('m1', '2026-01-10', [logged(1, 55, 10)]),
    ])
    expect(out.map(p => p.date)).toEqual(['2026-01-10', '2026-02-02', '2026-02-09'])
    expect(out[2]!.sets[0]!.weight).toBe(62.5)
  })

  it('ignores sessions where the exercise has no logged sets', () => {
    const skipped = meso([
      session([ex('row', [open(1)])], null),
      session([ex('row', [logged(1, 60, 10)])], '2026-02-09'),
    ])
    expect(earlierPerformances(skipped, 1, 0, 'row', undefined)).toEqual([])
  })
})

describe('liftChange', () => {
  it('leads with a heavier top weight even with fewer reps', () => {
    expect(liftChange([logged(1, 55, 10)], [logged(1, 50, 13)])).toEqual({ dir: 'up', amount: 5, unit: 'kg' })
  })

  it('compares total reps at the same top weight', () => {
    expect(liftChange([logged(1, 70, 11), logged(2, 70, 9)], [logged(1, 70, 10), logged(2, 70, 9)]))
      .toEqual({ dir: 'up', amount: 1, unit: 'reps' })
    expect(liftChange([logged(1, 70, 8)], [logged(1, 70, 10)])).toEqual({ dir: 'down', amount: 2, unit: 'reps' })
  })

  it('reports a match and a first time', () => {
    expect(liftChange([logged(1, 70, 8)], [logged(1, 70, 8)])).toEqual({ dir: 'same' })
    expect(liftChange([logged(1, 70, 8)], null)).toEqual({ dir: 'first' })
  })
})

describe('session summaries', () => {
  const s = session([
    ex('pulldown', [logged(1, 70, 10), logged(2, 70, 8), open(3)]),
    ex('curl', [logged(1, 10, 12)], 'biceps'),
  ], '2026-02-09')

  it('totals logged sets only', () => {
    expect(sessionTotals(s)).toEqual({ sets: 3, volume: 70 * 18 + 120, reps: 30 })
  })

  it('counts sets per muscle, most first', () => {
    expect(setsByMuscle(s)).toEqual([
      { muscleGroup: 'back', sets: 2 },
      { muscleGroup: 'biceps', sets: 1 },
    ])
  })

  it('finds the same session in the latest earlier week with logged sets', () => {
    const m = meso([
      session([ex('pulldown', [logged(1, 70, 9)])], '2026-02-02'),
      session([ex('pulldown', [open(1)])], null),
      s,
    ])
    expect(previousInstance(m, 2, 0)?.weekNumber).toBe(1)
    expect(previousInstance(m, 0, 0)).toBeNull()
  })
})
