import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import { ChevronLeftIcon, TrashIcon } from '../components/Icons'
import type { WorkoutLog } from '../types'

export default function WorkoutDetail() {
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [workout, setWorkout] = useState<WorkoutLog | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadWorkout()
  }, [id])

  const loadWorkout = async () => {
    try {
      const data = await api.get<WorkoutLog>(`/workouts/${id}`)
      setWorkout(data)
    } catch {
      toast.showError('Failed to load workout')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this workout?')) return
    try {
      await api.delete(`/workouts/${id}`)
      navigate(-1)
    } catch {
      toast.showError('Failed to delete workout')
    }
  }

  if (loading) {
    return <div className="text-slate-400 text-center py-8">Loading...</div>
  }

  if (!workout) {
    return <div className="text-slate-400 text-center py-8">Workout not found</div>
  }

  // Group sets by exercise
  const exerciseGroups: { [key: string]: { name: string; sets: typeof workout.sets } } = {}
  for (const set of workout.sets) {
    if (!exerciseGroups[set.exercise_id]) {
      exerciseGroups[set.exercise_id] = { name: set.exercise_name || 'Unknown', sets: [] }
    }
    exerciseGroups[set.exercise_id]!.sets.push(set)
  }

  const totalVolume = workout.sets.reduce(
    (sum, s) => sum + (s.completed ? s.weight * s.reps : 0),
    0
  )

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">{workout.session_name || 'Workout'}</h1>
          <div className="text-sm text-slate-400">
            Week {workout.week_number} &middot; {new Date(workout.date).toLocaleDateString()}
          </div>
        </div>
        <button onClick={handleDelete} className="text-slate-400 hover:text-red-400 p-2">
          <TrashIcon className="w-5 h-5" />
        </button>
      </header>

      {/* Summary */}
      <div className="card bg-slate-800">
        <div className="grid grid-cols-2 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold text-protocol-400">
              {workout.sets.filter((s) => s.completed).length}
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
      {Object.entries(exerciseGroups).map(([exerciseId, group]) => (
        <div key={exerciseId} className="card">
          <h3 className="font-medium mb-2">{group.name}</h3>
          <div className="space-y-1">
            {group.sets.map((set, idx) => (
              <div
                key={idx}
                className={`flex items-center gap-3 text-sm ${
                  set.completed ? '' : 'text-slate-500 line-through'
                }`}
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
      ))}

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

