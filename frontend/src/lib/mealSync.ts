/**
 * Local-first meal sync, the diet side of `workoutSync`.
 *
 * Every change to a meal is written to localStorage first: a draft per user +
 * meal holding the meal's full snapshot, or a tombstone (no snapshot) once it
 * is deleted. A single background queue pushes drafts oldest first, one
 * request at a time — `PUT /api/meals/{id}` for a snapshot, `DELETE` for a
 * tombstone — retrying with backoff until the server confirms. A confirmed
 * snapshot is dropped and the server copy is the truth again; a confirmed
 * tombstone stays for a week so a stale response can't bring the meal back.
 * The day, meal and week views overlay the drafts on server data
 * (`overlayDay`, `overlayMeal`, `overlayDays`).
 */
import { useSyncExternalStore } from 'react'
import type { QueryKey } from '@tanstack/react-query'
import { api, ApiError, NetworkError } from '../api/client'
import { getUserId } from './auth'
import { sumMacros } from './diet'
import { queryClient } from './queryClient'
import type { SyncStatus } from './workoutSync'
import type { DailyTargets, DayKcal, DietDay, MacroTotals, Meal, MealSnapshot } from '../types'

const PREFIX = 'protocol_meal:'
const MIN_BACKOFF_MS = 2000
const MAX_BACKOFF_MS = 30_000
// As long as the persisted query cache, which may still hold a deleted meal.
const TOMBSTONE_MS = 7 * 24 * 60 * 60 * 1000

/** Where the server has a meal, as far as this phone knows. */
export interface ServerCopy {
  eaten_on: string
  kcal: number
}

export interface MealDraft {
  v: 1
  userId: string
  id: string
  /** The meal's full snapshot, or null: it was deleted. */
  snapshot: MealSnapshot | null
  /** Null when the server doesn't have the meal (yet, or any more). */
  server: ServerCopy | null
  rev: number
  /** The last rev the server confirmed. */
  syncedRev: number
  updatedAt: number
  error: string | null
}

export function isDirty(d: MealDraft): boolean {
  return d.rev > d.syncedRev
}

// ─── overlay (pure) ───

function sameItems(a: Meal['items'], b: Meal['items']): boolean {
  const key = (items: Meal['items']) =>
    JSON.stringify(items.map((i) => [i.name, i.unit_name, i.unit_quantity, i.quantity_g]))
  return key(a) === key(b)
}

/** What the server will answer for a snapshot, so the screen shows it before it does. */
export function draftMeal(id: string, snapshot: MealSnapshot, previous: Meal | undefined): Meal {
  const unchanged = !!previous && sameItems(previous.items, snapshot.items)
  return {
    id,
    eaten_on: snapshot.eaten_on,
    eaten_at: snapshot.eaten_at,
    name: snapshot.name ?? (unchanged && previous?.name_source === 'auto' ? previous.name : null),
    name_source: snapshot.name ? 'user' : 'auto',
    summary: unchanged ? (previous?.summary ?? null) : null,
    // Claude starts on new items once the server has them.
    naming: unchanged ? (previous?.naming ?? false) : false,
    totals: sumMacros(snapshot.items),
    items: snapshot.items,
  }
}

/** The meal as this phone sees it; undefined when it was deleted here or isn't known. */
export function overlayMeal(id: string, server: Meal | undefined, draft: MealDraft | null): Meal | undefined {
  if (!draft) return server
  return draft.snapshot ? draftMeal(id, draft.snapshot, server) : undefined
}

/** A day as this phone sees it. Targets are null when only drafts are known (the day never loaded). */
export interface DayView {
  date: string
  totals: MacroTotals
  targets: DailyTargets | null
  meals: Meal[]
}

function byTime(a: Meal, b: Meal): number {
  return a.eaten_at.localeCompare(b.eaten_at)
}

/** The day with `meal` in place of whatever had its id (null removes it). */
export function withMeal<T extends DayView>(day: T, meal: Meal | null, id: string): T {
  const others = day.meals.filter((m) => m.id !== id)
  const meals = meal ? [...others, meal].sort(byTime) : others
  return { ...day, meals, totals: sumMacros(meals.map((m) => m.totals)) }
}

export function overlayDay(date: string, server: DietDay | undefined, drafts: MealDraft[]): DayView | undefined {
  const touching = drafts.filter(
    (d) => d.snapshot?.eaten_on === date || server?.meals.some((m) => m.id === d.id),
  )
  if (touching.length === 0) return server
  let day: DayView = server ?? { date, totals: sumMacros([]), targets: null, meals: [] }
  for (const d of touching) {
    const previous = server?.meals.find((m) => m.id === d.id)
    day = withMeal(day, d.snapshot?.eaten_on === date ? draftMeal(d.id, d.snapshot, previous) : null, d.id)
  }
  return day
}

/** Kcal per day in `range`, with a meal moved from `from` (where the server had it) to `to`. */
export function shiftDays(
  days: DayKcal[],
  from: ServerCopy | null,
  to: ServerCopy | null,
  range: { from: string; to: string },
): DayKcal[] {
  const inRange = (date: string) => date >= range.from && date <= range.to
  const kcal = new Map(days.map((d) => [d.date, d.kcal]))
  if (from && inRange(from.eaten_on)) kcal.set(from.eaten_on, (kcal.get(from.eaten_on) ?? 0) - from.kcal)
  if (to && inRange(to.eaten_on)) kcal.set(to.eaten_on, (kcal.get(to.eaten_on) ?? 0) + to.kcal)
  return [...kcal]
    .filter(([, k]) => k > 1e-6)
    .map(([date, k]) => ({ date, kcal: k }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

function copyOf(snapshot: MealSnapshot | null): ServerCopy | null {
  return snapshot ? { eaten_on: snapshot.eaten_on, kcal: sumMacros(snapshot.items).kcal } : null
}

export function overlayDays(
  from: string,
  to: string,
  server: DayKcal[] | undefined,
  drafts: MealDraft[],
): DayKcal[] | undefined {
  const inRange = (c: ServerCopy | null) => !!c && c.eaten_on >= from && c.eaten_on <= to
  const touching = drafts.filter((d) => inRange(d.server) || inRange(copyOf(d.snapshot)))
  if (touching.length === 0) return server
  return touching.reduce((days, d) => shiftDays(days, d.server, copyOf(d.snapshot), { from, to }), server ?? [])
}

// ─── storage ───

function draftKey(userId: string, id: string): string {
  return `${PREFIX}${userId}:${id}`
}

function keyOf(d: MealDraft): string {
  return draftKey(d.userId, d.id)
}

function readJson(key: string): MealDraft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as MealDraft
    return d?.v === 1 ? d : null
  } catch {
    return null
  }
}

function write(d: MealDraft): void {
  window.localStorage.setItem(keyOf(d), JSON.stringify(d))
}

// ─── query cache ───

const mealKey = (id: string) => ['diet', 'meal', id] as const
const dayKey = (date: string) => ['diet', 'day', date] as const

/** The server's copy of a meal, from whatever the cache has loaded. */
function cachedServerCopy(id: string): ServerCopy | null {
  const meal =
    queryClient.getQueryData<Meal>(mealKey(id)) ??
    queryClient
      .getQueriesData<DietDay>({ queryKey: ['diet', 'day'] })
      .flatMap(([, day]) => day?.meals ?? [])
      .find((m) => m.id === id)
  return meal ? { eaten_on: meal.eaten_on, kcal: meal.totals.kcal } : null
}

/** Write server data into the cache, and refetch anything that is loading an older answer. */
function setFresh<T>(key: QueryKey, update: (old: T | undefined) => T | undefined): void {
  queryClient.setQueryData<T>(key, update)
  if (queryClient.isFetching({ queryKey: key, exact: true })) {
    void queryClient.invalidateQueries({ queryKey: key, exact: true })
  }
}

/** The server confirmed `meal` (null: deleted), which it had at `before`. */
function updateCaches(id: string, before: ServerCopy | null, meal: Meal | null): void {
  if (meal) setFresh<Meal>(mealKey(id), () => meal)
  else queryClient.removeQueries({ queryKey: mealKey(id), exact: true })

  for (const [key, day] of queryClient.getQueriesData<DietDay>({ queryKey: ['diet', 'day'] })) {
    if (!day) continue
    const here = meal?.eaten_on === day.date
    if (here || day.meals.some((m) => m.id === id)) setFresh<DietDay>(key, (d) => d && withMeal(d, here ? meal : null, id))
  }
  // A day that never loaded (offline) has only the draft to show: load it.
  if (meal && !queryClient.getQueryData(dayKey(meal.eaten_on))) {
    void queryClient.invalidateQueries({ queryKey: dayKey(meal.eaten_on), exact: true })
  }

  const after = meal ? { eaten_on: meal.eaten_on, kcal: meal.totals.kcal } : null
  for (const [key, days] of queryClient.getQueriesData<DayKcal[]>({ queryKey: ['diet', 'days'] })) {
    const [, , from, to] = key as readonly [string, string, string, string]
    if (days) queryClient.setQueryData<DayKcal[]>(key, shiftDays(days, before, after, { from, to }))
  }
  void queryClient.invalidateQueries({ queryKey: ['diet', 'days'] })
  // Search puts recently logged foods first.
  if (meal) void queryClient.invalidateQueries({ queryKey: ['foods', 'search'] })
}

// ─── queue ───

class MealSync {
  private status: SyncStatus = { state: 'idle', pending: 0, error: null, version: 0 }
  private listeners = new Set<() => void>()
  private timer: ReturnType<typeof setTimeout> | null = null
  private inflight: Promise<void> | null = null
  private rerun = false
  private backoff = 0
  private started = false

  // ─── store plumbing (useSyncExternalStore) ───
  subscribe = (fn: () => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getStatus = () => this.status

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach((fn) => fn())
  }

  private bumpVersion() {
    const userId = getUserId()
    const pending = userId ? this.drafts(userId).filter(isDirty).length : 0
    this.setStatus({ version: this.status.version + 1, pending })
  }

  // ─── drafts ───
  drafts(userId: string): MealDraft[] {
    const out: MealDraft[] = []
    try {
      const prefix = `${PREFIX}${userId}:`
      for (let i = 0; i < window.localStorage.length; i++) {
        const k = window.localStorage.key(i)
        if (!k?.startsWith(prefix)) continue
        const d = readJson(k)
        if (d) out.push(d)
      }
    } catch {
      // storage unavailable
    }
    return out
  }

  getDraft(userId: string, id: string): MealDraft | null {
    return readJson(draftKey(userId, id))
  }

  /** Persist a meal's new snapshot (null deletes it) and schedule a sync. */
  save(userId: string, id: string, snapshot: MealSnapshot | null): void {
    const prev = this.getDraft(userId, id)
    const draft: MealDraft = {
      v: 1,
      userId,
      id,
      snapshot,
      server: prev ? prev.server : cachedServerCopy(id),
      rev: (prev?.rev ?? 0) + 1,
      syncedRev: prev?.syncedRev ?? 0,
      updatedAt: Date.now(),
      error: null,
    }
    try {
      write(draft)
    } catch {
      this.setStatus({ state: 'error', error: 'Phone storage is full — changes may not be saved' })
    }
    this.bumpVersion()
    this.schedule(0)
  }

  remove(userId: string, id: string): void {
    this.save(userId, id, null)
  }

  /** Forget every local draft of a user (e.g. on logout). */
  discardAll(userId: string): void {
    for (const d of this.drafts(userId)) {
      try {
        window.localStorage.removeItem(keyOf(d))
      } catch {
        /* ignore */
      }
    }
    this.bumpVersion()
  }

  hasUnsynced(userId: string): boolean {
    return this.drafts(userId).some(isDirty)
  }

  // ─── queue ───
  start(): void {
    if (this.started) return
    this.started = true
    window.addEventListener('online', () => {
      this.backoff = 0
      this.schedule(0)
    })
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') this.schedule(0)
    })
    const userId = getUserId()
    if (userId) this.prune(userId)
    this.bumpVersion()
    this.schedule(0)
  }

  /** Drop tombstones the server confirmed long enough ago. */
  private prune(userId: string): void {
    const cutoff = Date.now() - TOMBSTONE_MS
    for (const d of this.drafts(userId)) {
      if (isDirty(d) || d.updatedAt > cutoff) continue
      try {
        window.localStorage.removeItem(keyOf(d))
      } catch {
        /* ignore */
      }
    }
  }

  schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => {
      this.timer = null
      void this.flush()
    }, delayMs)
  }

  /** Push every unsynced draft of the current user, oldest first. */
  flush(): Promise<void> {
    if (this.inflight) {
      this.rerun = true
      return this.inflight
    }
    this.inflight = this.run().finally(() => {
      this.inflight = null
      if (this.rerun) {
        this.rerun = false
        this.schedule(0)
      }
    })
    return this.inflight
  }

  private async run(): Promise<void> {
    const userId = getUserId()
    if (!userId) return
    try {
      let failed = false
      const queue = this.drafts(userId)
        .filter((d) => isDirty(d) && !d.error)
        .sort((a, b) => a.updatedAt - b.updatedAt)
      if (queue.length > 0) this.setStatus({ state: 'syncing' })

      for (const d of queue) {
        const result = await this.push(d)
        if (result === 'retry') {
          failed = true
          break
        }
      }

      if (failed) {
        this.backoff = Math.min(MAX_BACKOFF_MS, this.backoff ? this.backoff * 2 : MIN_BACKOFF_MS)
        this.schedule(this.backoff)
      } else {
        this.backoff = 0
        const rejected = this.drafts(userId).find((d) => isDirty(d) && d.error)
        this.setStatus(rejected ? { state: 'error', error: rejected.error } : { state: 'idle', error: null })
      }
    } finally {
      this.bumpVersion()
    }
  }

  private async push(d: MealDraft): Promise<'ok' | 'retry' | 'rejected'> {
    const sentRev = d.rev
    try {
      if (d.snapshot) {
        const meal = await api.put<Meal>(`/meals/${d.id}`, d.snapshot, { timeoutMs: 15_000 })
        this.confirm(d, sentRev, meal)
      } else {
        try {
          await api.delete(`/meals/${d.id}`)
        } catch (e) {
          // Never reached the server, or already deleted.
          if (!(e instanceof ApiError && e.status === 404)) throw e
        }
        this.confirm(d, sentRev, null)
      }
      return 'ok'
    } catch (e) {
      if (e instanceof NetworkError || (e instanceof ApiError && (e.status >= 500 || e.status === 429))) {
        this.setStatus({
          state: 'offline',
          error: e instanceof NetworkError ? null : `Server error (${(e as ApiError).status})`,
        })
        return 'retry'
      }
      if (e instanceof ApiError && e.status === 401) {
        // The client is redirecting to login; drafts stay for after sign-in.
        return 'retry'
      }
      // The server rejected this snapshot (e.g. one of its foods is gone).
      // Keep it locally, flag it, and move on to the others.
      const message = e instanceof Error ? e.message : 'Rejected by server'
      const current = readJson(keyOf(d))
      if (current && current.rev === sentRev) {
        try {
          write({ ...current, error: message })
        } catch {
          /* ignore */
        }
      }
      return 'rejected'
    }
  }

  /** Server accepted rev `sentRev` (`meal` null: deleted): settle the draft and update caches. */
  private confirm(d: MealDraft, sentRev: number, meal: Meal | null): void {
    const current = readJson(keyOf(d))
    const server = meal ? { eaten_on: meal.eaten_on, kcal: meal.totals.kcal } : null
    try {
      if (current && current.rev !== sentRev) write({ ...current, server, syncedRev: sentRev })
      else if (current && meal) window.localStorage.removeItem(keyOf(d))
      else if (current) write({ ...current, server: null, syncedRev: sentRev })
    } catch {
      /* ignore */
    }
    // A meal Claude is naming keeps its day and page refetching (api/hooks).
    updateCaches(d.id, d.server, meal)
  }

  /** Clear rejected drafts' errors so the queue tries them again. */
  retryRejected(userId: string): void {
    for (const d of this.drafts(userId)) {
      if (!d.error) continue
      try {
        write({ ...d, error: null })
      } catch {
        /* ignore */
      }
    }
    this.backoff = 0
    this.schedule(0)
  }
}

export const mealSync = new MealSync()

export function useMealSyncStatus(): SyncStatus {
  return useSyncExternalStore(mealSync.subscribe, mealSync.getStatus)
}
