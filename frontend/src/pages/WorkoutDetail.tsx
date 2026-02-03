import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { api } from '../api/client'
import type { WorkoutLog } from '../types'

export default function WorkoutDetail() {
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
    } catch (error) {
      console.error('Failed to load workout:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm('Delete this workout?')) return
    try {
      await api.delete(`/workouts/${id}`)
      navigate(-1)
    } catch (error) {
      console.error('Failed to delete workout:', error)
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
    exerciseGroups[set.exercise_id].sets.push(set)
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

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}
