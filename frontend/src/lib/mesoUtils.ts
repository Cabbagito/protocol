import type { MesoSession, MesoSet, MesoStructure } from '../types'

/**
 * Session semantics — mirrors backend/app/domain/mesocycle_structure.py:
 * - a set is done when it is logged or skipped
 * - a session is done when it isn't skipped and every set of every
 *   non-skipped exercise is done
 * - a skipped session is neither done nor open; it's passed over
 * - "where we left off" is the first open session in structure order
 */

export interface SessionPosition {
  weekIndex: number
  sessionIndex: number
}

export function isSetDone(set: MesoSet): boolean {
  return set.logged || !!set.skipped
}

/** The user explicitly skipped this whole session. */
export function isSessionSkipped(session: MesoSession): boolean {
  return !!session.skipped
}

export function isSessionDone(session: MesoSession): boolean {
  if (isSessionSkipped(session)) return false
  return session.exercises.every(ex => ex.skipped || ex.sets.every(isSetDone))
}

/** Still has work to do: neither skipped nor done. */
export function isSessionOpen(session: MesoSession): boolean {
  return !isSessionSkipped(session) && !isSessionDone(session)
}

/** Not skipped, with at least one non-skipped exercise. */
function hasCountableWork(session: MesoSession): boolean {
  return !isSessionSkipped(session) && session.exercises.some(e => !e.skipped)
}

/**
 * First open session in structure order, optionally ignoring one position
 * (e.g. the session being finished right now). Null when nothing is left.
 */
export function findNextOpenSession(
  structure: MesoStructure,
  exclude?: SessionPosition,
): SessionPosition | null {
  const weeks = structure.weeks
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi]!
    for (let si = 0; si < week.sessions.length; si++) {
      if (exclude && exclude.weekIndex === wi && exclude.sessionIndex === si) continue
      if (isSessionOpen(week.sessions[si]!)) return { weekIndex: wi, sessionIndex: si }
    }
  }
  return null
}

/** "Where we left off": the first open session. Null when the meso is complete. */
export function getCurrentPosition(structure: MesoStructure): SessionPosition | null {
  return findNextOpenSession(structure)
}

/** Sessions that can be completed: not skipped, with at least one non-skipped exercise. */
export function countTotalWorkouts(structure: MesoStructure): number {
  return structure.weeks.reduce(
    (n, w) => n + w.sessions.filter(hasCountableWork).length,
    0,
  )
}

/** Done sessions that had work in them. */
export function countCompletedWorkouts(structure: MesoStructure): number {
  return structure.weeks.reduce(
    (n, w) => n + w.sessions.filter(s => hasCountableWork(s) && isSessionDone(s)).length,
    0,
  )
}
