import { useParams, useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from '../components/Icons'
import { useWorkoutDetail } from '../api/hooks'
import MuscleGroupBadge from '../components/MuscleGroupBadge'

export default function WorkoutDetail() {
  const { mesocycleId, weekIndex: weekStr, sessionIndex: sessionStr } = useParams<{
    mesocycleId: string
    weekIndex: string
    sessionIndex: string
  }>()
  const navigate = useNavigate()
  const weekIndex = parseInt(weekStr ?? '0')
  const sessionIndex = parseInt(sessionStr ?? '0')
  const { data: workout, isLoading } = useWorkoutDetail(mesocycleId!, weekIndex, sessionIndex)

  if (isLoading) {
    return <div className="text-slate-400 text-center py-8">Loading...</div>
  }

  if (!workout) {
    return <div className="text-slate-400 text-center py-8">Workout not found</div>
  }

  const loggedSets = workout.exercises.flatMap((ex) =>
    ex.sets.filter((s) => s.logged).map((s) => ({ ...s, weight: s.weight ?? 0, reps: s.reps ?? 0 }))
  )
  const totalVolume = loggedSets.reduce((sum, s) => sum + s.weight * s.reps, 0)

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{workout.session_name}</h1>
          <div className="text-sm text-slate-400">
            Week {workout.week_number}
            {workout.date && <> &middot; {new Date(workout.date).toLocaleDateString()}</>}
          </div>
        </div>
      </header>

      {/* Summary */}
      <div className="card bg-slate-800">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-protocol-400">
              {loggedSets.length}
            </div>
            <div className="text-sm text-slate-400">Sets</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-protocol-400">
              {Math.round(totalVolume).toLocaleString()}
            </div>
            <div className="text-sm text-slate-400">Volume (kg)</div>
          </div>
        </div>
      </div>

      {/* Exercises */}
      {workout.exercises.map((exercise) => {
        const exerciseLoggedSets = exercise.sets.filter((s) => s.logged)
        if (exerciseLoggedSets.length === 0) return null

        return (
          <div key={exercise.exercise_id} className="card">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="font-medium flex-1">{exercise.exercise_name}</h3>
              <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
            </div>
            <div className="space-y-1">
              {exerciseLoggedSets.map((set) => (
                <div
                  key={set.set_num}
                  className="flex items-center gap-3 text-sm"
                >
                  <span className="text-slate-500 w-6">#{set.set_num}</span>
                  <span className="flex-1">{set.weight}kg x {set.reps}</span>
                  {set.rir !== null && set.rir !== undefined && (
                    <span className="text-slate-400">RiR {set.rir}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {/* Notes */}
      {workout.notes && (
        <div className="card">
          <h3 className="font-medium mb-2">Notes</h3>
          <p className="text-slate-400 text-sm whitespace-pre-wrap">{workout.notes}</p>
        </div>
      )}
    </div>
  )
}
