import { describe, expect, it } from 'vitest'
import {
  applySnapshotToSession, findPreviousPerformance, overlayDrafts, snapshotPayload, targetForSet,
  type SessionDraft, type SessionExercise,
} from './workoutSession'
import { getCurrentPosition, isSessionDone } from './mesoUtils'
import type { MesoExercise, MesoSession, MesoSet, MesoStructure, Mesocycle } from '../types'

const set = (n: number, over: Partial<MesoSet> = {}): MesoSet => ({
  set_num: n, weight: null, reps: null, logged: false, ...over,
})
const logged = (n: number, weight: number, reps: number): MesoSet => set(n, { weight, reps, logged: true })
const ex = (id: string, sets: MesoSet[], over: Partial<MesoExercise> = {}): MesoExercise => ({
  exercise_id: id, exercise_name: id, muscle_group: 'chest', equipment_type: 'barbell', sets, ...over,
})
const session = (exercises: MesoExercise[], over: Partial<MesoSession> = {}): MesoSession => ({
  session_name: 'Push', day_order: 0, date: null, notes: null, exercises, ...over,
})
const local = (id: string, sets: Array<[number | null, number | null, boolean, boolean?]>, skipped = false): SessionExercise => ({
  exercise_id: id, exercise_name: id, muscle_group: 'chest', equipment_type: 'barbell', skipped,
  sets: sets.map(([weight, reps, isLogged, isSkipped]) => ({
    weight, reps, set_type: null, logged: isLogged, skipped: !!isSkipped,
  })),
})

describe('session done rules (mirror the backend)', () => {
  it('counts skipped sets as done', () => {
    expect(isSessionDone(session([ex('a', [logged(1, 100, 5), set(2, { skipped: true })])]))).toBe(true)
  })

  it('a skipped set does not hold up the next week', () => {
    const structure: MesoStructure = {
      weeks: [
        { week_number: 1, sessions: [session([ex('a', [logged(1, 100, 5), set(2, { skipped: true })])])] },
        { week_number: 2, sessions: [session([ex('a', [set(1)])])] },
      ],
    }
    expect(getCurrentPosition(structure)).toEqual({ weekIndex: 1, sessionIndex: 0 })
  })

  it('a skipped exercise with open sets is done', () => {
    expect(isSessionDone(session([ex('a', [logged(1, 100, 5), set(2)], { skipped: true })]))).toBe(true)
  })
})

describe('applySnapshotToSession', () => {
  it('logs sets and dates the session the day its first set is logged', () => {
    const out = applySnapshotToSession(
      session([ex('a', [set(1), set(2)])]),
      [local('a', [[100, 5, true], [null, null, false]])],
      '2026-10-06',
    )
    expect(out.date).toBe('2026-10-06')
    expect(out.exercises[0]!.sets[0]).toMatchObject({ set_num: 1, weight: 100, reps: 5, logged: true })
  })

  it('keeps the date when editing a session that was already logged', () => {
    const out = applySnapshotToSession(
      session([ex('a', [logged(1, 100, 5)])], { date: '2026-09-01' }),
      [local('a', [[105, 5, true]])],
      '2026-10-06',
    )
    expect(out.date).toBe('2026-09-01')
  })

  it('clears the date when nothing is logged', () => {
    const out = applySnapshotToSession(
      session([ex('a', [set(1)])], { date: '2026-09-01' }),
      [local('a', [[100, null, false]])],
      '2026-10-06',
    )
    expect(out.date).toBeNull()
  })

  it('leaves exercises the snapshot does not mention untouched', () => {
    const out = applySnapshotToSession(
      session([ex('a', [set(1)]), ex('b', [logged(1, 50, 10)])]),
      [local('a', [[100, 5, true]])],
      '2026-10-06',
    )
    expect(out.exercises[1]!.sets[0]).toMatchObject({ weight: 50, logged: true })
  })

  it('renumbers sets after one is removed', () => {
    const out = applySnapshotToSession(
      session([ex('a', [set(1), set(2), set(3)])]),
      [local('a', [[null, null, false], [null, null, false]])],
      '2026-10-06',
    )
    expect(out.exercises[0]!.sets.map(s => s.set_num)).toEqual([1, 2])
  })
})

describe('snapshotPayload', () => {
  it('sends every exercise with its full set list, never logged+skipped', () => {
    const draft: SessionDraft = {
      v: 1, userId: 'u', mesocycleId: 'm', weekIndex: 1, sessionIndex: 2,
      exercises: [local('a', [[100, 5, true, true], [null, null, false, true]], true)],
      loggedOn: null, rev: 1, syncedRev: 0, updatedAt: 0, error: null,
    }
    const p = snapshotPayload(draft, '2026-10-06')
    expect(p).toMatchObject({ mesocycle_id: 'm', week_index: 1, session_index: 2, logged_on: '2026-10-06' })
    expect(p.exercises[0]!.skipped).toBe(true)
    expect(p.exercises[0]!.sets.map(s => [s.logged, s.skipped])).toEqual([[true, false], [false, true]])
  })
})

describe('overlayDrafts', () => {
  const meso: Mesocycle = {
    id: 'm', name: 'M', split_id: 's', split_name: 'S', split_color: null, total_weeks: 1,
    current_week: 1, is_active: true, started_at: '2026-10-01', workouts_completed: 0,
    structure: { weeks: [{ week_number: 1, sessions: [session([ex('a', [set(1)])])] }] },
  }
  const draft = (over: Partial<SessionDraft>): SessionDraft => ({
    v: 1, userId: 'u', mesocycleId: 'm', weekIndex: 0, sessionIndex: 0,
    exercises: [local('a', [[100, 5, true]])], loggedOn: '2026-10-05',
    rev: 2, syncedRev: 1, updatedAt: 0, error: null, ...over,
  })

  it('shows unsynced local sets on top of server data', () => {
    const out = overlayDrafts(meso, [draft({})], '2026-10-06')
    const s = out.structure.weeks[0]!.sessions[0]!
    expect(s.exercises[0]!.sets[0]!.logged).toBe(true)
    expect(s.date).toBe('2026-10-05')
  })

  it('ignores synced drafts and other mesocycles', () => {
    expect(overlayDrafts(meso, [draft({ syncedRev: 2 })], '2026-10-06')).toBe(meso)
    expect(overlayDrafts(meso, [draft({ mesocycleId: 'other' })], '2026-10-06')).toBe(meso)
  })
})

describe('last-time targets', () => {
  const structure: MesoStructure = {
    weeks: [
      {
        week_number: 1,
        sessions: [
          session([ex('bench', [logged(1, 100, 8), logged(2, 100, 7)])], { date: '2026-09-01' }),
          session([ex('bench', [logged(1, 102.5, 6)])], { session_name: 'Push 2', date: '2026-09-04' }),
        ],
      },
      { week_number: 2, sessions: [session([ex('bench', [set(1), set(2), set(3)])]), session([])] },
    ],
  }

  it('uses the most recent earlier session in this mesocycle', () => {
    const prev = findPreviousPerformance(structure, 'm', 1, 0, 'bench', undefined)
    expect(prev?.date).toBe('2026-09-04')
  })

  it('never uses the session being logged', () => {
    const prev = findPreviousPerformance(structure, 'm', 0, 1, 'bench', undefined)
    expect(prev?.date).toBe('2026-09-01')
  })

  it('falls back to an older mesocycle', () => {
    const prev = findPreviousPerformance(structure, 'm', 1, 0, 'squat', [
      {
        meso_id: 'old', meso_name: 'Block 1', week_index: 3, session_index: 0, week_number: 4,
        session_name: 'Legs', date: '2026-08-01', meso_started_at: '2026-07-01', sets: [logged(1, 140, 5)],
      },
      {
        meso_id: 'm', meso_name: 'M', week_index: 0, session_index: 0, week_number: 1,
        session_name: 'Legs', date: '2026-09-01', meso_started_at: '2026-09-01', sets: [logged(1, 150, 5)],
      },
    ])
    expect(prev?.sets[0]!.weight).toBe(140)
  })

  it('maps set N to set N, extra sets to the last one', () => {
    const prev = findPreviousPerformance(structure, 'm', 0, 1, 'bench', undefined)
    expect(targetForSet(prev, 1)).toEqual({ weight: 100, reps: 8 })
    expect(targetForSet(prev, 2)).toEqual({ weight: 100, reps: 7 })
    expect(targetForSet(prev, 3)).toEqual({ weight: 100, reps: 7 })
    expect(targetForSet(null, 1)).toEqual({ weight: null, reps: null })
  })
})
