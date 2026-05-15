import type { Mesocycle } from '../types'
export { formatVolume } from './formatters'

interface VolumeEntry {
  muscleGroup: string
  sets: number
}

export function getVolumeByMuscleGroup(mesocycle: Mesocycle): VolumeEntry[] {
  const volumeMap = new Map<string, number>()

  // Use week 1 since the template is the same each week
  const week = mesocycle.structure.weeks[0]
  if (!week) return []

  for (const session of week.sessions) {
    for (const exercise of session.exercises) {
      const mg = exercise.muscle_group
      volumeMap.set(mg, (volumeMap.get(mg) ?? 0) + exercise.sets.length)
    }
  }

  return [...volumeMap.entries()]
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 6)
}
