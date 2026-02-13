import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { ChevronLeftIcon } from '../components/Icons'
import { useMesocycle, useSplit, useWorkouts, useAdvanceWeek, useUpdateMesocycle } from '../api/hooks'

export default function MesocycleDetail() {
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: mesocycle, isLoading } = useMesocycle(id!)
  const { data: split } = useSplit(mesocycle?.split_id ?? '')
  const { data: workouts = [] } = useWorkouts({ mesocycleId: id })
  const advanceWeek = useAdvanceWeek(id!)
  const updateMesocycle = useUpdateMesocycle(id!)

  const handleAdvanceWeek = async () => {
    try {
      await advanceWeek.mutateAsync()
    } catch {
      toast.showError('Failed to advance week')
    }
  }

  const handleToggleActive = async () => {
    if (!mesocycle) return
    try {
      await updateMesocycle.mutateAsync({
        is_active: !mesocycle.is_active,
      })
    } catch {
      toast.showError('Failed to update mesocycle')
    }
  }

  if (isLoading) {
    return <div className="text-slate-400 text-center py-8">Loading...</div>
  }

  if (!mesocycle) {
    return <div className="text-slate-400 text-center py-8">Mesocycle not found</div>
  }

  const isDeloadWeek = mesocycle.current_rir === -1

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate('/mesocycles')} className="text-slate-400 hover:text-slate-200">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold">{mesocycle.name}</h1>
            {mesocycle.is_active && (
              <span className="text-xs bg-protocol-600 text-white px-2 py-0.5 rounded">
                Active
              </span>
            )}
          </div>
          <div className="text-sm text-slate-400">{mesocycle.split_name}</div>
        </div>
      </header>

      {/* Week Progress */}
      <div className="card">
        <div className="flex justify-between items-center mb-3">
          <h2 className="font-medium">Progress</h2>
          <div className="text-sm text-slate-400">
            {mesocycle.workouts_completed} workouts logged
          </div>
        </div>

        {/* Week indicators */}
        <div className="flex gap-1 mb-4">
          {mesocycle.rir_scheme.map((rir, idx) => {
            const weekNum = idx + 1
            const isCurrent = weekNum === mesocycle.current_week
            const isPast = weekNum < mesocycle.current_week
            const isDeload = rir === -1

            return (
              <div
                key={idx}
                className={`flex-1 p-2 rounded text-center text-sm ${
                  isCurrent
                    ? 'bg-protocol-600 text-white'
                    : isPast
                    ? 'bg-slate-700 text-slate-400'
                    : 'bg-slate-800 text-slate-500'
                }`}
              >
                <div className="font-medium">W{weekNum}</div>
                <div className="text-xs opacity-80">
                  {isDeload ? 'DL' : `RiR ${rir}`}
                </div>
              </div>
            )
          })}
        </div>

        {/* Current week info */}
        <div className="bg-slate-800 rounded p-3">
          <div className="text-lg font-bold">
            Week {mesocycle.current_week} of {mesocycle.total_weeks}
          </div>
          <div className="text-slate-400">
            {isDeloadWeek ? (
              <span className="text-yellow-400">Deload Week - Half volume, lighter weights</span>
            ) : (
              <span>Target RiR: {mesocycle.current_rir}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          <button
            onClick={handleToggleActive}
            className={`btn flex-1 ${mesocycle.is_active ? 'btn-secondary' : 'btn-primary'}`}
          >
            {mesocycle.is_active ? 'Archive' : 'Reactivate'}
          </button>
          {mesocycle.current_week < mesocycle.total_weeks && (
            <button
              onClick={handleAdvanceWeek}
              className="btn btn-primary flex-1"
            >
              Advance to Week {mesocycle.current_week + 1}
            </button>
          )}
        </div>
      </div>

      {/* Start Workout */}
      {mesocycle.is_active && split && (
        <div className="card">
          <h2 className="font-medium mb-3">Start Workout</h2>
          <div className="space-y-2">
            {split.sessions.filter((s) => !s.is_rest_day).map((session) => (
              <Link
                key={session.id}
                to={`/workout/${mesocycle.id}/${session.id}`}
                className="block bg-slate-800 hover:bg-slate-700 rounded p-3 transition-colors"
              >
                <div className="font-medium">{session.name}</div>
                <div className="text-sm text-slate-400">
                  {session.exercises.length} exercises
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      <div className="card">
        <h2 className="font-medium mb-3">Recent Workouts</h2>
        {workouts.length === 0 ? (
          <div className="text-slate-500 text-sm">No workouts logged yet.</div>
        ) : (
          <div className="space-y-2">
            {workouts.slice(0, 10).map((workout) => (
              <Link
                key={workout.id}
                to={`/workouts/${workout.id}`}
                className="block bg-slate-800 hover:bg-slate-700 rounded p-3 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{workout.session_name || 'Workout'}</div>
                    <div className="text-sm text-slate-400">
                      Week {workout.week_number} &middot; {workout.total_sets} sets
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">
                    {new Date(workout.date).toLocaleDateString()}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
