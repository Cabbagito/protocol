/**
 * Local-first workout sync.
 *
 * Every change to a workout session is written to localStorage immediately
 * (a draft per user + session), so nothing is lost to bad signal, an app
 * kill, or a reload. A single background queue then pushes each unsynced
 * draft to the server as a full snapshot, one request at a time, retrying
 * with backoff until the server confirms. Confirmed drafts are deleted and
 * the server copy becomes the source of truth again.
 */
import { useSyncExternalStore } from 'react'
import { api, ApiError, NetworkError } from '../api/client'
import { getUserId } from './auth'
import { todayIso } from './dates'
import { queryClient } from './queryClient'
import {
  isDraftDirty, snapshotPayload, withSession,
  type SessionDraft, type SessionExercise,
} from './workoutSession'
import type { Mesocycle, MesoSession } from '../types'

const PREFIX = 'protocol_wo:'
const EDIT_DELAY_MS = 1200
const MIN_BACKOFF_MS = 2000
const MAX_BACKOFF_MS = 30_000

export type SyncState = 'idle' | 'syncing' | 'offline' | 'error'

export interface SyncStatus {
  state: SyncState
  /** Unsynced sessions for the current user. */
  pending: number
  error: string | null
  /** Bumped whenever any draft changes; lets views re-read drafts. */
  version: number
}

export class SyncUnavailableError extends Error {
  constructor(message = "You're offline — this needs a connection. Your logged sets are saved on this phone.") {
    super(message)
    this.name = 'SyncUnavailableError'
  }
}

function draftKey(userId: string, mesocycleId: string, weekIndex: number, sessionIndex: number): string {
  return `${PREFIX}${userId}:${mesocycleId}:${weekIndex}:${sessionIndex}`
}

function keyOf(d: SessionDraft): string {
  return draftKey(d.userId, d.mesocycleId, d.weekIndex, d.sessionIndex)
}

function readJson(key: string): SessionDraft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as SessionDraft
    return d?.v === 1 ? d : null
  } catch {
    return null
  }
}

class WorkoutSync {
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
    return () => { this.listeners.delete(fn) }
  }

  getStatus = () => this.status

  private setStatus(patch: Partial<SyncStatus>) {
    this.status = { ...this.status, ...patch }
    this.listeners.forEach(fn => fn())
  }

  private bumpVersion() {
    const userId = getUserId()
    const pending = userId ? this.drafts(userId).filter(isDraftDirty).length : 0
    this.setStatus({ version: this.status.version + 1, pending })
  }

  // ─── drafts ───
  drafts(userId: string): SessionDraft[] {
    const out: SessionDraft[] = []
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

  getDraft(userId: string, mesocycleId: string, weekIndex: number, sessionIndex: number): SessionDraft | null {
    return readJson(draftKey(userId, mesocycleId, weekIndex, sessionIndex))
  }

  /**
   * Persist a local change and schedule a sync. `editOnly` marks a
   * correction to a past session; it sticks only while every unsynced
   * change is one.
   */
  save(
    base: Pick<SessionDraft, 'userId' | 'mesocycleId' | 'weekIndex' | 'sessionIndex'>,
    exercises: SessionExercise[],
    { urgent, editOnly }: { urgent: boolean; editOnly: boolean },
  ): void {
    const prev = this.getDraft(base.userId, base.mesocycleId, base.weekIndex, base.sessionIndex)
    const prevPending = prev && isDraftDirty(prev)
    const hasLogged = exercises.some(e => e.sets.some(s => s.logged))
    const draft: SessionDraft = {
      v: 1,
      ...base,
      exercises,
      loggedOn: prev?.loggedOn ?? (hasLogged ? todayIso() : null),
      rev: (prev?.rev ?? 0) + 1,
      syncedRev: prev?.syncedRev ?? 0,
      updatedAt: Date.now(),
      error: null,
      editOnly: editOnly && (!prevPending || !!prev.editOnly),
    }
    try {
      window.localStorage.setItem(keyOf(draft), JSON.stringify(draft))
    } catch {
      this.setStatus({ state: 'error', error: 'Phone storage is full — changes may not be saved' })
    }
    this.bumpVersion()
    this.schedule(urgent ? 0 : EDIT_DELAY_MS)
  }

  /** Forget every local draft of a user (e.g. on logout). */
  discardAll(userId: string): void {
    for (const d of this.drafts(userId)) {
      try { window.localStorage.removeItem(keyOf(d)) } catch { /* ignore */ }
    }
    this.bumpVersion()
  }

  hasUnsynced(userId: string): boolean {
    return this.drafts(userId).some(isDraftDirty)
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
    this.bumpVersion()
    this.schedule(0)
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
        .filter(d => isDraftDirty(d) && !d.error)
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
        const rejected = this.drafts(userId).find(d => isDraftDirty(d) && d.error)
        this.setStatus(rejected
          ? { state: 'error', error: rejected.error }
          : { state: 'idle', error: null })
      }
    } finally {
      this.bumpVersion()
    }
  }

  private async push(d: SessionDraft): Promise<'ok' | 'retry' | 'rejected'> {
    const sentRev = d.rev
    try {
      const res = await api.put<{ session: MesoSession }>(
        '/workouts/session', snapshotPayload(d, todayIso()), { timeoutMs: 15_000 },
      )
      this.confirm(d, sentRev, res.session)
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
      // The server rejected this snapshot (e.g. the session no longer exists).
      // Keep it locally, flag it, and move on to the others.
      const message = e instanceof Error ? e.message : 'Rejected by server'
      const current = readJson(keyOf(d))
      if (current && current.rev === sentRev) {
        try {
          window.localStorage.setItem(keyOf(d), JSON.stringify({ ...current, error: message }))
        } catch { /* ignore */ }
      }
      return 'rejected'
    }
  }

  /** Server accepted rev `sentRev`: drop the draft if nothing changed since, and update caches. */
  private confirm(d: SessionDraft, sentRev: number, serverSession: MesoSession): void {
    const key = keyOf(d)
    const current = readJson(key)
    try {
      if (!current || current.rev === sentRev) window.localStorage.removeItem(key)
      else window.localStorage.setItem(key, JSON.stringify({ ...current, syncedRev: sentRev }))
    } catch { /* ignore */ }

    function patch<T extends Mesocycle | null | undefined>(m: T): T {
      if (!m || m.id !== d.mesocycleId || !m.structure.weeks[d.weekIndex]?.sessions[d.sessionIndex]) return m
      return { ...m, structure: withSession(m.structure, d.weekIndex, d.sessionIndex, serverSession) }
    }
    queryClient.setQueryData<Mesocycle>(['mesocycles', d.mesocycleId], patch)
    queryClient.setQueryData<Mesocycle | null>(['mesocycles', 'active'], patch)
    // Set-count changes also reshape future weeks server-side; refetch lazily.
    void queryClient.invalidateQueries({ queryKey: ['mesocycles'], refetchType: 'none' })
    for (const e of d.exercises) {
      void queryClient.invalidateQueries({ queryKey: ['exercises', 'history', e.exercise_id], refetchType: 'none' })
    }
  }

  /**
   * Make sure one session is fully on the server — e.g. before changing the
   * session's exercises, which only the server can do. Rejects if that can't
   * happen soon (offline).
   */
  async ensureSynced(
    userId: string, mesocycleId: string, weekIndex: number, sessionIndex: number, timeoutMs = 12_000,
  ): Promise<void> {
    const deadline = Date.now() + timeoutMs
    for (;;) {
      const d = this.getDraft(userId, mesocycleId, weekIndex, sessionIndex)
      if (!d || !isDraftDirty(d)) return
      if (d.error) throw new SyncUnavailableError(`Couldn't save this workout: ${d.error}`)
      if (Date.now() > deadline || !navigator.onLine) throw new SyncUnavailableError()
      if (this.timer) {
        clearTimeout(this.timer)
        this.timer = null
      }
      await this.flush()
      const after = this.getDraft(userId, mesocycleId, weekIndex, sessionIndex)
      if (!after || !isDraftDirty(after)) return
      if (this.status.state === 'offline') throw new SyncUnavailableError()
      await new Promise(r => setTimeout(r, 100))
    }
  }

  /** Clear a rejected draft's error so the queue tries it again. */
  retryRejected(userId: string): void {
    for (const d of this.drafts(userId)) {
      if (!d.error) continue
      try {
        window.localStorage.setItem(keyOf(d), JSON.stringify({ ...d, error: null }))
      } catch { /* ignore */ }
    }
    this.backoff = 0
    this.schedule(0)
  }
}

export const workoutSync = new WorkoutSync()

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(workoutSync.subscribe, workoutSync.getStatus)
}
