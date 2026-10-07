import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SessionExercise } from './workoutSession'

const put = vi.fn()

vi.mock('../api/client', async () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  }
  class NetworkError extends Error {}
  return { api: { put: (...args: unknown[]) => put(...args) }, ApiError, NetworkError }
})
vi.mock('./auth', () => ({ getUserId: () => 'user-1' }))

const { workoutSync } = await import('./workoutSync')
const { ApiError, NetworkError } = await import('../api/client')

const base = { userId: 'user-1', mesocycleId: 'm1', weekIndex: 0, sessionIndex: 0 }
const exercises = (reps: number): SessionExercise[] => [{
  exercise_id: 'bench', exercise_name: 'Bench', muscle_group: 'chest', equipment_type: 'barbell',
  skipped: false,
  sets: [{ weight: 100, reps, set_type: null, logged: true, skipped: false }],
}]
const serverSession = { session_name: 'Push', day_order: 0, date: null, notes: null, exercises: [] }

describe('workoutSync', () => {
  beforeEach(() => {
    localStorage.clear()
    put.mockReset()
    vi.useFakeTimers()
  })

  it('saves locally first, then syncs and drops the draft', async () => {
    put.mockResolvedValue({ session: serverSession })
    workoutSync.save(base, exercises(5), { urgent: true, editOnly: false })
    expect(workoutSync.getDraft('user-1', 'm1', 0, 0)?.rev).toBe(1)

    await workoutSync.flush()

    expect(put).toHaveBeenCalledTimes(1)
    const [path, body] = put.mock.calls[0]!
    expect(path).toBe('/workouts/session')
    expect(body).toMatchObject({ mesocycle_id: 'm1', week_index: 0, session_index: 0 })
    expect(workoutSync.getDraft('user-1', 'm1', 0, 0)).toBeNull()
    expect(workoutSync.getStatus().pending).toBe(0)
  })

  it('keeps the draft and reports offline when the network fails', async () => {
    put.mockRejectedValue(new NetworkError('offline'))
    workoutSync.save(base, exercises(5), { urgent: true, editOnly: false })
    await workoutSync.flush()

    expect(workoutSync.getDraft('user-1', 'm1', 0, 0)).not.toBeNull()
    expect(workoutSync.getStatus()).toMatchObject({ state: 'offline', pending: 1 })

    // Back online: the retry goes through.
    put.mockResolvedValue({ session: serverSession })
    await workoutSync.flush()
    expect(workoutSync.getDraft('user-1', 'm1', 0, 0)).toBeNull()
  })

  it('keeps a draft that changed while its save was in flight', async () => {
    let release!: (v: unknown) => void
    put.mockImplementation(() => new Promise(r => { release = r }))
    workoutSync.save(base, exercises(5), { urgent: true, editOnly: false })
    const flushing = workoutSync.flush()
    await Promise.resolve()
    workoutSync.save(base, exercises(6), { urgent: true, editOnly: false })
    release({ session: serverSession })
    await flushing

    const d = workoutSync.getDraft('user-1', 'm1', 0, 0)
    expect(d).toMatchObject({ rev: 2, syncedRev: 1 })
  })

  it('flags a snapshot the server rejects and stops retrying it', async () => {
    put.mockRejectedValue(new ApiError(400, 'Invalid session index'))
    workoutSync.save(base, exercises(5), { urgent: true, editOnly: false })
    await workoutSync.flush()

    expect(workoutSync.getDraft('user-1', 'm1', 0, 0)?.error).toBe('Invalid session index')
    expect(workoutSync.getStatus().state).toBe('error')
    put.mockClear()
    await workoutSync.flush()
    expect(put).not.toHaveBeenCalled()
  })

  it('keeps edits to a past session out of later sessions', async () => {
    put.mockResolvedValue({ session: serverSession })
    workoutSync.save(base, exercises(5), { urgent: true, editOnly: true })
    await workoutSync.flush()
    expect(put.mock.calls[0]![1]).toMatchObject({ apply_to_future: false })
  })

  it('carries set counts forward if any unsynced change came from a live workout', async () => {
    put.mockRejectedValue(new NetworkError('offline'))
    workoutSync.save(base, exercises(5), { urgent: true, editOnly: false })
    await workoutSync.flush()
    workoutSync.save(base, exercises(6), { urgent: true, editOnly: true })
    put.mockResolvedValue({ session: serverSession })
    await workoutSync.flush()
    expect(put.mock.lastCall![1]).toMatchObject({ apply_to_future: true })
  })

  it('remembers the day the first set was logged', () => {
    vi.setSystemTime(new Date(2026, 9, 6, 23, 50))
    workoutSync.save(base, exercises(5), { urgent: false, editOnly: false })
    vi.setSystemTime(new Date(2026, 9, 7, 0, 10))
    workoutSync.save(base, exercises(6), { urgent: false, editOnly: false })
    expect(workoutSync.getDraft('user-1', 'm1', 0, 0)?.loggedOn).toBe('2026-10-06')
  })
})
