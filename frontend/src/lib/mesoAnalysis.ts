import type { Mesocycle } from '../types'
export { formatVolume } from './formatters'

export interface ExerciseProgression {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  strengthData: { weekNum: number; value: number }[]
  currentE1rm: number
  e1rmDelta: number
  stimulusData: { weekNum: number; value: number }[]
  currentVolume: number
  volumeDelta: number
}

export function getExerciseProgression(mesocycle: Mesocycle): ExerciseProgression[] {
  const exerciseMap = new Map<string, {
    name: string
    muscleGroup: string
    weekE1rm: Map<number, number>
    weekVolume: Map<number, number>
  }>()

  for (const week of mesocycle.structure.weeks) {
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        if (!exerciseMap.has(exercise.exercise_id)) {
          exerciseMap.set(exercise.exercise_id, {
            name: exercise.exercise_name,
            muscleGroup: exercise.muscle_group,
            weekE1rm: new Map(),
            weekVolume: new Map(),
          })
        }
        const entry = exerciseMap.get(exercise.exercise_id)!
        for (const set of exercise.sets) {
          if (set.logged && set.weight !== null && set.weight > 0) {
            const e1rm = set.weight * (1 + (set.reps ?? 0) / 30)
            const existing = entry.weekE1rm.get(week.week_number) ?? 0
            if (e1rm > existing) {
              entry.weekE1rm.set(week.week_number, e1rm)
            }
            const vol = set.weight * (set.reps ?? 0)
            entry.weekVolume.set(week.week_number, (entry.weekVolume.get(week.week_number) ?? 0) + vol)
          }
        }
      }
    }
  }

  const results: ExerciseProgression[] = []
  for (const [id, entry] of exerciseMap) {
    if (entry.weekE1rm.size < 2) continue
    const sortedE1rm = [...entry.weekE1rm.entries()].sort((a, b) => a[0] - b[0])
    const strengthData = sortedE1rm.map(([weekNum, value]) => ({ weekNum, value: Math.round(value * 10) / 10 }))
    const sortedVol = [...entry.weekVolume.entries()].sort((a, b) => a[0] - b[0])
    const stimulusData = sortedVol.map(([weekNum, value]) => ({ weekNum, value: Math.round(value) }))

    const firstE1rm = strengthData[0]!.value
    const lastE1rm = strengthData[strengthData.length - 1]!.value
    const firstVol = stimulusData[0]!.value
    const lastVol = stimulusData[stimulusData.length - 1]!.value

    results.push({
      exerciseId: id,
      exerciseName: entry.name,
      muscleGroup: entry.muscleGroup,
      strengthData,
      currentE1rm: lastE1rm,
      e1rmDelta: lastE1rm - firstE1rm,
      stimulusData,
      currentVolume: lastVol,
      volumeDelta: lastVol - firstVol,
    })
  }

  results.sort((a, b) => b.strengthData.length - a.strengthData.length || b.e1rmDelta - a.e1rmDelta)
  return results.slice(0, 6)
}

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
