import type { Mesocycle } from '../types'
import { localDateKey, parseIso } from './dates'

/**
 * Per-exercise training history derived from mesocycle structures — the
 * single source for the Progress page (which lifts were trained, how often,
 * best sets, e1RM series).
 */

export interface LoggedSet {
  weight: number
  reps: number
}

export interface ExerciseSession {
  /** Local calendar date (YYYY-MM-DD) the session was logged on. */
  date: string
  sets: LoggedSet[]
}

export interface TrainedExercise {
  exerciseId: string
  name: string
  muscleGroup: string
  /** Oldest first. */
  sessions: ExerciseSession[]
  lastDate: string
}

/** Epley estimated 1RM — same formula as the backend. */
export function epley(weight: number, reps: number): number {
  return weight * (1 + reps / 30)
}

export function sessionBestE1rm(session: ExerciseSession): number {
  return Math.max(0, ...session.sets.map((s) => epley(s.weight, s.reps)))
}

/** Every exercise with at least one logged set, keyed by exercise id. */
export function buildTrainingLog(mesocycles: Mesocycle[]): Map<string, TrainedExercise> {
  const log = new Map<string, TrainedExercise>()
  for (const meso of mesocycles) {
    const fallbackDate = meso.started_at.slice(0, 10)
    for (const week of meso.structure.weeks) {
      for (const session of week.sessions) {
        const date = session.date ?? fallbackDate
        // One entry per exercise per session, even if it appears twice.
        const bySession = new Map<string, LoggedSet[]>()
        for (const ex of session.exercises) {
          if (ex.skipped) continue
          const sets: LoggedSet[] = []
          for (const s of ex.sets) {
            if (!s.logged || s.skipped || s.weight == null || s.reps == null || s.reps <= 0) continue
            sets.push({ weight: s.weight, reps: s.reps })
          }
          if (sets.length === 0) continue
          const acc = bySession.get(ex.exercise_id)
          if (acc) acc.push(...sets)
          else bySession.set(ex.exercise_id, sets)

          let entry = log.get(ex.exercise_id)
          if (!entry) {
            entry = {
              exerciseId: ex.exercise_id,
              name: ex.exercise_name,
              muscleGroup: ex.muscle_group,
              sessions: [],
              lastDate: date,
            }
            log.set(ex.exercise_id, entry)
          }
        }
        for (const [exerciseId, sets] of bySession) {
          const entry = log.get(exerciseId)!
          entry.sessions.push({ date, sets })
          if (date > entry.lastDate) entry.lastDate = date
        }
      }
    }
  }
  for (const entry of log.values()) {
    entry.sessions.sort((a, b) => a.date.localeCompare(b.date))
  }
  return log
}

/** Sessions on or after `today − weeks`; all sessions when `weeks` is null. */
export function sessionsInPeriod(
  sessions: ExerciseSession[],
  weeks: number | null,
  today: string,
): ExerciseSession[] {
  if (weeks === null) return sessions
  const cutoff = parseIso(today)
  cutoff.setDate(cutoff.getDate() - weeks * 7)
  const iso = localDateKey(cutoff)
  return sessions.filter((s) => s.date >= iso)
}

/**
 * The single best set by estimated 1RM, as it was actually lifted
 * (ties — e.g. unweighted bodyweight sets — go to the most reps).
 */
export function bestSet(sessions: ExerciseSession[]): (LoggedSet & { e1rm: number }) | null {
  let best: (LoggedSet & { e1rm: number }) | null = null
  for (const session of sessions) {
    for (const s of session.sets) {
      const e1rm = epley(s.weight, s.reps)
      if (!best || e1rm > best.e1rm || (e1rm === best.e1rm && s.reps > best.reps)) {
        best = { ...s, e1rm }
      }
    }
  }
  return best
}

function daysBetween(fromIso: string, toIso: string): number {
  return Math.round((parseIso(toIso).getTime() - parseIso(fromIso).getTime()) / 86_400_000)
}

/**
 * Sessions per week over the period. The window is the period, shortened to
 * the time since the lift was first trained so a new lift isn't penalized
 * for weeks before it existed; never less than one week.
 */
export function sessionsPerWeek(
  allSessions: ExerciseSession[],
  periodSessions: ExerciseSession[],
  weeks: number | null,
  today: string,
): number {
  const first = allSessions[0]
  if (!first || periodSessions.length === 0) return 0
  const weeksSinceFirst = (daysBetween(first.date, today) + 1) / 7
  const windowWeeks = Math.max(1, weeks === null ? weeksSinceFirst : Math.min(weeks, weeksSinceFirst))
  return periodSessions.length / windowWeeks
}
