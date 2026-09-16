import type { MesoSession, MesoStructure } from '../types'

export interface SessionPosition {
  weekIndex: number
  sessionIndex: number
}

/** The user explicitly skipped this whole session. */
export function isSessionSkipped(session: MesoSession): boolean {
  return !!session.skipped
}

/**
 * Every set of every non-skipped exercise is logged. A session whose
 * exercises are all skipped counts as done; a skipped session does not.
 */
export function isSessionDone(session: MesoSession): boolean {
  if (isSessionSkipped(session)) return false
  const nonSkipped = session.exercises.filter(ex => !ex.skipped)
  if (nonSkipped.length === 0) return true
  return nonSkipped.every(ex => ex.sets.every(s => s.logged))
}

/** Still has work to do: neither skipped nor fully logged. */
export function isSessionOpen(session: MesoSession): boolean {
  return !isSessionSkipped(session) && !isSessionDone(session)
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

/** "Where we left off": the first open session. */
export function getCurrentPosition(structure: MesoStructure): SessionPosition | null {
  return findNextOpenSession(structure)
}

/** Sessions that can be completed: not skipped, with at least one non-skipped exercise. */
export function countTotalWorkouts(structure: MesoStructure): number {
  return structure.weeks.reduce(
    (n, w) =>
      n + w.sessions.filter(s => !isSessionSkipped(s) && s.exercises.some(e => !e.skipped)).length,
    0,
  )
}
