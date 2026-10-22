import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DayKcal, DietDay, Meal, MealItem, MealSnapshot } from '../types'

const put = vi.fn()
const del = vi.fn()

vi.mock('../api/client', async () => {
  class ApiError extends Error {
    constructor(public status: number, message: string) { super(message) }
  }
  class NetworkError extends Error {}
  return {
    api: {
      put: (...args: unknown[]) => put(...args),
      delete: (...args: unknown[]) => del(...args),
    },
    ApiError,
    NetworkError,
  }
})
vi.mock('./auth', () => ({ getUserId: () => 'user-1' }))

const { mealSync, overlayDay, overlayDays, overlayMeal } = await import('./mealSync')
const { queryClient } = await import('./queryClient')
const { ApiError, NetworkError } = await import('../api/client')

const DAY = '2026-10-18'
const targets = { kcal: 2000, protein_g: 150, carbs_g: 200, fat_g: 70 }

const item = (name: string, kcal: number): MealItem => ({
  food_item_id: null, name, unit_name: null, unit_quantity: 100, quantity_g: 100,
  kcal, protein_g: 10, carbs_g: 10, fat_g: 1,
})
const snapshot = (items: MealItem[], eaten_at = '08:00', eaten_on = DAY): MealSnapshot => ({
  eaten_on, eaten_at, name: null, items,
})
const serverMeal = (id: string, s: MealSnapshot, name: string | null = 'Breakfast'): Meal => ({
  id, eaten_on: s.eaten_on, eaten_at: s.eaten_at, name, name_source: 'auto', summary: null, naming: false,
  totals: {
    kcal: s.items.reduce((t, i) => t + i.kcal, 0),
    protein_g: s.items.reduce((t, i) => t + i.protein_g, 0),
    carbs_g: s.items.reduce((t, i) => t + i.carbs_g, 0),
    fat_g: s.items.reduce((t, i) => t + i.fat_g, 0),
  },
  items: s.items,
})
const dayOf = (meals: Meal[], date = DAY): DietDay => ({
  date, targets, meals,
  totals: {
    kcal: meals.reduce((t, m) => t + m.totals.kcal, 0),
    protein_g: meals.reduce((t, m) => t + m.totals.protein_g, 0),
    carbs_g: meals.reduce((t, m) => t + m.totals.carbs_g, 0),
    fat_g: meals.reduce((t, m) => t + m.totals.fat_g, 0),
  },
})

const oats = snapshot([item('Oats', 380)])
const drafts = () => mealSync.drafts('user-1')

describe('mealSync queue', () => {
  beforeEach(() => {
    localStorage.clear()
    queryClient.clear()
    put.mockReset()
    del.mockReset()
    vi.useFakeTimers()
  })

  it('saves locally first, then sends the snapshot and drops the draft', async () => {
    put.mockImplementation((_path: string, s: MealSnapshot) => Promise.resolve(serverMeal('m1', s)))
    queryClient.setQueryData(['diet', 'day', DAY], dayOf([]))
    mealSync.save('user-1', 'm1', oats)
    expect(mealSync.getDraft('user-1', 'm1')).toMatchObject({ rev: 1, server: null })
    expect(mealSync.getStatus().pending).toBe(1)

    await mealSync.flush()

    expect(put).toHaveBeenCalledWith('/meals/m1', oats, { timeoutMs: 15_000 })
    expect(mealSync.getDraft('user-1', 'm1')).toBeNull()
    expect(mealSync.getStatus()).toMatchObject({ state: 'idle', pending: 0 })
    // The server's answer is in the caches, so nothing jumps back.
    expect(queryClient.getQueryData<Meal>(['diet', 'meal', 'm1'])?.name).toBe('Breakfast')
    expect(queryClient.getQueryData<DietDay>(['diet', 'day', DAY])?.meals.map((m) => m.id)).toEqual(['m1'])
  })

  it('keeps the draft and reports offline when the network fails', async () => {
    put.mockRejectedValue(new NetworkError('offline'))
    mealSync.save('user-1', 'm1', oats)
    await mealSync.flush()

    expect(mealSync.getDraft('user-1', 'm1')).not.toBeNull()
    expect(mealSync.getStatus()).toMatchObject({ state: 'offline', pending: 1 })

    // Back online: the retry goes through.
    put.mockImplementation((_path: string, s: MealSnapshot) => Promise.resolve(serverMeal('m1', s)))
    await mealSync.flush()
    expect(mealSync.getDraft('user-1', 'm1')).toBeNull()
  })

  it('sends only the latest snapshot after several offline changes', async () => {
    put.mockRejectedValue(new NetworkError('offline'))
    mealSync.save('user-1', 'm1', oats)
    await mealSync.flush()
    const more = snapshot([item('Oats', 380), item('Banana', 105)])
    mealSync.save('user-1', 'm1', more)

    put.mockReset()
    put.mockImplementation((_path: string, s: MealSnapshot) => Promise.resolve(serverMeal('m1', s)))
    await mealSync.flush()
    expect(put).toHaveBeenCalledTimes(1)
    expect(put.mock.calls[0]![1]).toEqual(more)
  })

  it('keeps a draft that changed while its save was in flight', async () => {
    let release!: (v: Meal) => void
    put.mockImplementation(() => new Promise((r) => { release = r }))
    mealSync.save('user-1', 'm1', oats)
    const flushing = mealSync.flush()
    await Promise.resolve()
    mealSync.save('user-1', 'm1', snapshot([item('Oats', 380), item('Banana', 105)]))
    release(serverMeal('m1', oats))
    await flushing

    // Rev 1 is on the server now; rev 2 is still to send.
    expect(mealSync.getDraft('user-1', 'm1')).toMatchObject({
      rev: 2, syncedRev: 1, server: { eaten_on: DAY, kcal: 380 },
    })
  })

  it('remembers where the server had a meal before the first local change', () => {
    queryClient.setQueryData(['diet', 'day', DAY], dayOf([serverMeal('m1', oats)]))
    mealSync.save('user-1', 'm1', snapshot([item('Oats', 380), item('Banana', 105)]))
    expect(mealSync.getDraft('user-1', 'm1')?.server).toEqual({ eaten_on: DAY, kcal: 380 })
  })

  it('flags a snapshot the server rejects and stops retrying it until asked', async () => {
    put.mockRejectedValue(new ApiError(404, 'Food item not found'))
    mealSync.save('user-1', 'm1', oats)
    await mealSync.flush()

    expect(mealSync.getDraft('user-1', 'm1')?.error).toBe('Food item not found')
    expect(mealSync.getStatus().state).toBe('error')
    put.mockClear()
    await mealSync.flush()
    expect(put).not.toHaveBeenCalled()

    put.mockImplementation((_path: string, s: MealSnapshot) => Promise.resolve(serverMeal('m1', s)))
    mealSync.retryRejected('user-1')
    await vi.runOnlyPendingTimersAsync()
    expect(put).toHaveBeenCalledTimes(1)
    expect(mealSync.getDraft('user-1', 'm1')).toBeNull()
  })

  it('queues a delete made offline and keeps the meal hidden once it went through', async () => {
    const server = dayOf([serverMeal('m1', oats)])
    queryClient.setQueryData(['diet', 'day', DAY], server)
    del.mockRejectedValue(new NetworkError('offline'))
    mealSync.remove('user-1', 'm1')
    await mealSync.flush()
    expect(mealSync.getStatus()).toMatchObject({ state: 'offline', pending: 1 })
    expect(overlayDay(DAY, server, drafts())?.meals).toEqual([])

    del.mockResolvedValue(undefined)
    await mealSync.flush()
    expect(del).toHaveBeenLastCalledWith('/meals/m1')
    expect(put).not.toHaveBeenCalled()
    expect(mealSync.getStatus().pending).toBe(0)
    expect(queryClient.getQueryData<DietDay>(['diet', 'day', DAY])?.meals).toEqual([])
    // A response loaded before the delete can't bring it back.
    expect(overlayDay(DAY, server, drafts())?.meals).toEqual([])
    expect(overlayMeal('m1', serverMeal('m1', oats), mealSync.getDraft('user-1', 'm1'))).toBeUndefined()
  })

  it('treats deleting a meal the server never had as done', async () => {
    put.mockRejectedValue(new NetworkError('offline'))
    mealSync.save('user-1', 'm1', oats)
    await mealSync.flush()
    mealSync.remove('user-1', 'm1')
    del.mockRejectedValue(new ApiError(404, 'Meal not found'))
    put.mockReset()
    await mealSync.flush()

    expect(put).not.toHaveBeenCalled()
    expect(mealSync.getStatus()).toMatchObject({ state: 'idle', pending: 0 })
    expect(mealSync.getDraft('user-1', 'm1')?.error).toBeNull()
  })

  it('forgets confirmed deletes after a week', async () => {
    vi.setSystemTime(new Date(2026, 9, 1))
    del.mockResolvedValue(undefined)
    mealSync.remove('user-1', 'old')
    await mealSync.flush()
    vi.setSystemTime(new Date(2026, 9, 18))
    mealSync.remove('user-1', 'recent')
    await mealSync.flush()

    mealSync.start()
    expect(mealSync.getDraft('user-1', 'old')).toBeNull()
    expect(mealSync.getDraft('user-1', 'recent')).not.toBeNull()
  })
})

describe('meal overlay', () => {
  const draft = (id: string, s: MealSnapshot | null, server: { eaten_on: string; kcal: number } | null = null) => ({
    v: 1 as const, userId: 'user-1', id, snapshot: s, server, rev: 1, syncedRev: 0, updatedAt: 0, error: null,
  })

  it('adds unsynced meals to their day, by time, with totals', () => {
    const lunch = serverMeal('m2', snapshot([item('Rice', 500)], '13:00'), 'Lunch')
    const view = overlayDay(DAY, dayOf([lunch]), [draft('m1', oats)])
    expect(view?.meals.map((m) => m.id)).toEqual(['m1', 'm2'])
    expect(view?.totals.kcal).toBe(880)
    expect(view?.targets).toEqual(targets)
  })

  it('shows a day that never loaded from its drafts alone', () => {
    const view = overlayDay(DAY, undefined, [draft('m1', oats)])
    expect(view).toMatchObject({ date: DAY, targets: null, totals: { kcal: 380 } })
    expect(overlayDay(DAY, undefined, [])).toBeUndefined()
  })

  it("keeps Claude's name while the foods are the same", () => {
    const server = serverMeal('m1', oats, 'Porridge')
    expect(overlayMeal('m1', server, draft('m1', { ...oats, eaten_at: '09:00' }))).toMatchObject({
      name: 'Porridge', eaten_at: '09:00',
    })
    expect(overlayMeal('m1', server, draft('m1', snapshot([item('Eggs', 150)])))).toMatchObject({
      name: null, totals: { kcal: 150 },
    })
  })

  it('leaves data alone where no draft touches it', () => {
    const server = dayOf([serverMeal('m2', oats)])
    expect(overlayDay(DAY, server, [draft('m1', snapshot([item('Oats', 1)], '08:00', '2026-10-17'))])).toBe(server)
  })

  it('moves kcal on the week strip for new, changed and deleted meals', () => {
    const week: DayKcal[] = [
      { date: '2026-10-17', kcal: 1500 },
      { date: DAY, kcal: 380 },
    ]
    const from = '2026-10-12'
    const to = DAY
    expect(overlayDays(from, to, week, [draft('m1', snapshot([item('Banana', 105)]))])).toEqual([
      { date: '2026-10-17', kcal: 1500 },
      { date: DAY, kcal: 485 },
    ])
    expect(overlayDays(from, to, week, [draft('m1', snapshot([item('Oats', 500)]), { eaten_on: DAY, kcal: 380 })]))
      .toEqual([{ date: '2026-10-17', kcal: 1500 }, { date: DAY, kcal: 500 }])
    // The day's only meal deleted: the day is empty again.
    expect(overlayDays(from, to, week, [draft('m1', null, { eaten_on: DAY, kcal: 380 })])).toEqual([
      { date: '2026-10-17', kcal: 1500 },
    ])
    // Another week's meal changes nothing here.
    expect(overlayDays(from, to, week, [draft('m9', snapshot([item('Oats', 1)], '08:00', '2026-10-01'))])).toBe(week)
  })
})
