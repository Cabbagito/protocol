import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { ChevronLeftIcon, CheckIcon } from '../components/Icons'
import { useMesocycle, useWorkoutHistory, useUpdateMesocycle } from '../api/hooks'
import type { MesoSession } from '../types'

export default function MesocycleDetail() {
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: mesocycle, isLoading } = useMesocycle(id!)
  const { data: history = [] } = useWorkoutHistory(id!)
  const updateMesocycle = useUpdateMesocycle(id!)

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
  const currentWeekIndex = mesocycle.current_week - 1

  // Find the next unlogged session for the "Continue" button
  const getNextSession = (): { weekIndex: number; sessionIndex: number; session: MesoSession } | null => {
    for (let wi = 0; wi < mesocycle.structure.weeks.length; wi++) {
      const week = mesocycle.structure.weeks[wi]!
      for (let si = 0; si < week.sessions.length; si++) {
        const session = week.sessions[si]!
        const allLogged = session.exercises.length > 0 &&
          session.exercises.every((ex) => ex.sets.every((s) => s.logged))
        if (!allLogged) {
          return { weekIndex: wi, sessionIndex: si, session }
        }
      }
    }
    return null
  }

  const nextSession = getNextSession()

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
        <div className="mt-4">
          <button
            onClick={handleToggleActive}
            className={`btn w-full ${mesocycle.is_active ? 'btn-secondary' : 'btn-primary'}`}
          >
            {mesocycle.is_active ? 'Archive' : 'Reactivate'}
          </button>
        </div>
      </div>

      {/* Continue Workout */}
      {mesocycle.is_active && nextSession && (
        <Link
          to={`/workout/${mesocycle.id}?week=${nextSession.weekIndex}&session=${nextSession.sessionIndex}`}
          className="card block hover:bg-slate-800/50 transition-colors"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">Next Workout</div>
              <div className="text-lg font-semibold text-slate-200">
                {nextSession.session.session_name}
              </div>
              <div className="text-sm text-slate-500">
                Week {mesocycle.structure.weeks[nextSession.weekIndex]!.week_number}
                {' '}&middot;{' '}
                {nextSession.session.exercises.length} exercises
              </div>
            </div>
            <div className="btn btn-primary text-sm">Start</div>
          </div>
        </Link>
      )}

      {/* Current Week Sessions */}
      {mesocycle.is_active && mesocycle.structure.weeks[currentWeekIndex] && (
        <div className="card">
          <h2 className="font-medium mb-3">Week {mesocycle.current_week} Sessions</h2>
          <div className="space-y-2">
            {mesocycle.structure.weeks[currentWeekIndex]!.sessions.map((session, si) => {
              const allLogged = session.exercises.length > 0 &&
                session.exercises.every((ex) => ex.sets.every((s) => s.logged))

              if (allLogged) {
                return (
                  <Link
                    key={si}
                    to={`/workouts/${mesocycle.id}/${currentWeekIndex}/${si}`}
                    className="flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded p-3 transition-colors"
                  >
                    <div>
                      <div className="font-medium text-slate-300">{session.session_name}</div>
                      <div className="text-sm text-slate-500">
                        {session.exercises.length} exercises
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-green-400">
                      <CheckIcon className="w-4 h-4" />
                      Done
                    </div>
                  </Link>
                )
              }

              return (
                <Link
                  key={si}
                  to={`/workout/${mesocycle.id}?week=${currentWeekIndex}&session=${si}`}
                  className="flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded p-3 transition-colors"
                >
                  <div>
                    <div className="font-medium">{session.session_name}</div>
                    <div className="text-sm text-slate-500">
                      {session.exercises.length} exercises
                    </div>
                  </div>
                  <div className="text-sm text-slate-500">Pending</div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      <div className="card">
        <h2 className="font-medium mb-3">Recent Workouts</h2>
        {history.length === 0 ? (
          <div className="text-slate-500 text-sm">No workouts logged yet.</div>
        ) : (
          <div className="space-y-2">
            {history.slice(-10).reverse().map((workout, idx) => (
              <Link
                key={idx}
                to={`/workouts/${mesocycle.id}/${workout.week_index}/${workout.session_index}`}
                className="block bg-slate-800 hover:bg-slate-700 rounded p-3 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <div className="font-medium">{workout.session_name}</div>
                    <div className="text-sm text-slate-400">
                      Week {workout.week_number} &middot; {workout.total_sets} sets
                    </div>
                  </div>
                  {workout.date && (
                    <div className="text-sm text-slate-500">
                      {new Date(workout.date).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
