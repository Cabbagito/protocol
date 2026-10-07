/**
 * Pure helpers for the workout review page: what a finished session did,
 * and how each lift compares with the last time it was done.
 */
import type { ExerciseSessionHistory } from './exerciseHistory'
import { epley } from './trainingLog'
import type { Mesocycle, MesoSession, MesoSet } from '../types'

export interface Performance {
  /** Logged sets, in order. */
  sets: MesoSet[]
  date: string | null
}

export function loggedSets(sets: MesoSet[]): MesoSet[] {
  return sets.filter(s => s.logged && !s.skipped)
}

export function setE1rm(s: MesoSet): number {
  return epley(s.weight ?? 0, s.reps ?? 0)
}

/** The set with the highest estimated 1RM (first one on ties). */
export function bestSet(sets: MesoSet[]): MesoSet | null {
  let best: MesoSet | null = null
  for (const s of sets) if (!best || setE1rm(s) > setE1rm(best)) best = s
  return best
}

export function bestE1rm(sets: MesoSet[]): number {
  const best = bestSet(sets)
  return best ? setE1rm(best) : 0
}

/**
 * Every earlier time this exercise was logged, oldest first: other sessions
 * of this mesocycle (from the local structure, so unsynced sets count) and
 * other mesocycles (server history). Ordered like the server's history: by
 * date, then mesocycle start, week and session.
 */
export function earlierPerformances(
  mesocycle: Mesocycle,
  weekIndex: number,
  sessionIndex: number,
  exerciseId: string,
  history: ExerciseSessionHistory[] | undefined,
): Performance[] {
  type Entry = Performance & { key: [string, string, number, number] }
  const start = mesocycle.started_at
  const startDay = start.slice(0, 10)
  const self = mesocycle.structure.weeks[weekIndex]?.sessions[sessionIndex]
  const selfKey: Entry['key'] = [self?.date ?? startDay, start, weekIndex, sessionIndex]

  const entries: Entry[] = []
  mesocycle.structure.weeks.forEach((week, wi) => {
    week.sessions.forEach((session, si) => {
      const ex = session.exercises.find(e => e.exercise_id === exerciseId)
      const sets = loggedSets(ex?.sets ?? [])
      if (sets.length === 0) return
      entries.push({ sets, date: session.date, key: [session.date ?? startDay, start, wi, si] })
    })
  })
  for (const h of history ?? []) {
    if (h.meso_id === mesocycle.id || h.sets.length === 0) continue
    entries.push({
      sets: h.sets,
      date: h.date,
      key: [h.date ?? h.meso_started_at.slice(0, 10), h.meso_started_at, h.week_index, h.session_index],
    })
  }
  return entries
    .filter(e => compareKeys(e.key, selfKey) < 0)
    .sort((a, b) => compareKeys(a.key, b.key))
    .map(({ sets, date }) => ({ sets, date }))
}

function compareKeys(a: [string, string, number, number], b: [string, string, number, number]): number {
  for (let i = 0; i < a.length; i++) {
    if (a[i]! < b[i]!) return -1
    if (a[i]! > b[i]!) return 1
  }
  return 0
}

export type LiftChange =
  | { dir: 'up' | 'down'; amount: number; unit: 'kg' | 'reps' }
  | { dir: 'same' | 'first' }

/**
 * Headline change against last time: a heavier or lighter top weight wins;
 * at the same top weight, total reps.
 */
export function liftChange(sets: MesoSet[], previous: MesoSet[] | null): LiftChange {
  if (!previous || previous.length === 0) return { dir: 'first' }
  const maxWeight = (xs: MesoSet[]) => Math.max(...xs.map(s => s.weight ?? 0))
  const totalReps = (xs: MesoSet[]) => xs.reduce((n, s) => n + (s.reps ?? 0), 0)
  const dw = Math.round((maxWeight(sets) - maxWeight(previous)) * 100) / 100
  if (dw !== 0) return { dir: dw > 0 ? 'up' : 'down', amount: Math.abs(dw), unit: 'kg' }
  const dr = totalReps(sets) - totalReps(previous)
  if (dr !== 0) return { dir: dr > 0 ? 'up' : 'down', amount: Math.abs(dr), unit: 'reps' }
  return { dir: 'same' }
}

export interface SessionTotals {
  sets: number
  volume: number
  reps: number
}

export function sessionTotals(session: MesoSession): SessionTotals {
  const sets = session.exercises.flatMap(e => loggedSets(e.sets))
  return {
    sets: sets.length,
    volume: sets.reduce((n, s) => n + (s.weight ?? 0) * (s.reps ?? 0), 0),
    reps: sets.reduce((n, s) => n + (s.reps ?? 0), 0),
  }
}

/** The same session in the latest earlier week that has logged sets. */
export function previousInstance(
  mesocycle: Mesocycle,
  weekIndex: number,
  sessionIndex: number,
): { weekNumber: number; session: MesoSession } | null {
  for (let wi = weekIndex - 1; wi >= 0; wi--) {
    const week = mesocycle.structure.weeks[wi]!
    const session = week.sessions[sessionIndex]
    if (session && sessionTotals(session).sets > 0) return { weekNumber: week.week_number, session }
  }
  return null
}

/** Logged sets per muscle group, most first. */
export function setsByMuscle(session: MesoSession): { muscleGroup: string; sets: number }[] {
  const counts = new Map<string, number>()
  for (const ex of session.exercises) {
    const n = loggedSets(ex.sets).length
    if (n > 0) counts.set(ex.muscle_group, (counts.get(ex.muscle_group) ?? 0) + n)
  }
  return [...counts]
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
    .sort((a, b) => b.sets - a.sets)
}
