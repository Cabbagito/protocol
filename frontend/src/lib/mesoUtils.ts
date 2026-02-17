import type { MesoStructure } from '../types'

export function getCurrentPosition(structure: MesoStructure): { weekIndex: number; sessionIndex: number } | null {
  const weeks = structure.weeks
  for (let wi = 0; wi < weeks.length; wi++) {
    const week = weeks[wi]!
    for (let si = 0; si < week.sessions.length; si++) {
      const session = week.sessions[si]!
      const nonSkipped = session.exercises.filter(ex => !ex.skipped)
      if (nonSkipped.length === 0) continue // all skipped = complete
      const allLogged = nonSkipped.every(ex => ex.sets.every(s => s.logged))
      if (!allLogged) {
        return { weekIndex: wi, sessionIndex: si }
      }
    }
  }
  return null
}
