import { Link } from 'react-router-dom'
import { useActiveMesocycle, useWorkoutHistory } from '../api/hooks'
import { ArrowRightIcon, ProtocolLogo } from '../components/Icons'
import ProgressBar from '../components/ProgressBar'
import type { MesoSession } from '../types'

export default function Dashboard() {
  const { data: mesocycle, isLoading: mesoLoading } = useActiveMesocycle()
  const { data: recentWorkouts = [] } = useWorkoutHistory(mesocycle?.id ?? '')

  const isDeloadWeek = mesocycle?.current_rir === -1

  // Find next unlogged session from the structure
  const getNextSession = (): {
    weekIndex: number
    sessionIndex: number
    session: MesoSession
  } | null => {
    if (!mesocycle) return null
    for (let wi = 0; wi < mesocycle.structure.weeks.length; wi++) {
      const week = mesocycle.structure.weeks[wi]!
      for (let si = 0; si < week.sessions.length; si++) {
        const session = week.sessions[si]!
        const allLogged =
          session.exercises.length > 0 &&
          session.exercises.every((ex) => ex.sets.every((s) => s.logged))
        if (!allLogged) {
          return { weekIndex: wi, sessionIndex: si, session }
        }
      }
    }
    return null
  }

  const nextSession = getNextSession()
  const currentWeekIndex = mesocycle ? mesocycle.current_week - 1 : -1

  if (mesoLoading) {
    return <div className="text-slate-500 text-center py-8">Loading...</div>
  }

  return (
    <div className="px-4 pt-5 space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <ProtocolLogo className="w-9 h-9 flex-shrink-0" />
        <div>
          <h1 className="text-[15px] font-semibold text-slate-200">Protocol</h1>
          <p className="text-[11px] text-slate-600">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </header>

      {/* Active Mesocycle */}
      {mesocycle ? (
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <div>
              <h2 className="font-semibold text-slate-200">{mesocycle.name}</h2>
              <div className="text-sm text-slate-500 mt-0.5">
                Week {mesocycle.current_week} of {mesocycle.total_weeks}
                {' '}&middot;{' '}
                {isDeloadWeek ? (
                  <span className="text-yellow-400">Deload Week</span>
                ) : (
                  <span>RiR {mesocycle.current_rir}</span>
                )}
              </div>
            </div>
            <Link to={`/mesocycles/${mesocycle.id}`} className="text-protocol-400 text-sm">
              View
            </Link>
          </div>

          <ProgressBar percent={(mesocycle.current_week / mesocycle.total_weeks) * 100} />

          <div className="text-xs text-slate-600 mt-2 text-center">
            {mesocycle.workouts_completed} workouts completed
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 className="font-semibold mb-2 text-slate-200">Get Started</h2>
          <p className="text-slate-500 text-sm mb-4">
            Create a mesocycle to start tracking your workouts.
          </p>
          <Link to="/mesocycles" className="btn btn-primary inline-block">
            Create Mesocycle
          </Link>
        </div>
      )}

      {/* Next Workout */}
      {mesocycle && nextSession && (
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <h2 className="font-semibold text-slate-200">Next Workout</h2>
            <Link to="/progress" className="text-protocol-400 text-sm">
              Progress
            </Link>
          </div>

          <Link
            to={`/workout/${mesocycle.id}?week=${nextSession.weekIndex}&session=${nextSession.sessionIndex}`}
            className="block rounded-lg p-4 transition-colors"
            style={{ background: '#132438', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-200">{nextSession.session.session_name}</div>
                <div className="text-sm text-slate-500 mt-1">
                  {nextSession.session.exercises.length} exercises
                </div>
              </div>
              <div className="text-protocol-400">
                <ArrowRightIcon className="w-6 h-6" />
              </div>
            </div>
          </Link>

          {isDeloadWeek && (
            <div className="mt-3 text-sm text-yellow-400 bg-yellow-900/20 rounded p-2">
              Deload week: Use lighter weights, fewer sets
            </div>
          )}
        </div>
      )}

      {/* All Sessions (current week) */}
      {mesocycle && mesocycle.structure.weeks[currentWeekIndex] && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-slate-200">Week {mesocycle.current_week} Sessions</h2>
          <div className="grid grid-cols-2 gap-2">
            {mesocycle.structure.weeks[currentWeekIndex]!.sessions.map((session, si) => {
              const allLogged =
                session.exercises.length > 0 &&
                session.exercises.every((ex) => ex.sets.every((s) => s.logged))

              return (
                <Link
                  key={si}
                  to={
                    allLogged
                      ? `/workouts/${mesocycle.id}/${currentWeekIndex}/${si}`
                      : `/workout/${mesocycle.id}?week=${currentWeekIndex}&session=${si}`
                  }
                  className="rounded-lg p-3 text-sm transition-colors hover:bg-navy-input"
                  style={{ background: '#132438', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="font-medium text-slate-200">{session.session_name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {allLogged ? (
                      <span className="text-green-400">Completed</span>
                    ) : (
                      `${session.exercises.length} exercises`
                    )}
                  </div>
                </Link>
              )
            })}
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      {recentWorkouts.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-slate-200">Recent Workouts</h2>
          <div className="space-y-2">
            {recentWorkouts.slice(-5).reverse().map((workout, idx) => (
              <Link
                key={idx}
                to={`/workouts/${mesocycle!.id}/${workout.week_index}/${workout.session_index}`}
                className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-navy-input"
                style={{ background: '#132438', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div>
                  <div className="font-medium text-sm text-slate-200">
                    {workout.session_name}
                  </div>
                  <div className="text-xs text-slate-600">
                    {workout.total_sets} sets &middot; {Math.round(workout.total_volume).toLocaleString()}kg
                  </div>
                </div>
                <div className="text-xs text-slate-600">
                  {workout.date ? formatRelativeDate(workout.date) : `Week ${workout.week_number}`}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  if (date.toDateString() === today.toDateString()) {
    return 'Today'
  }
  if (date.toDateString() === yesterday.toDateString()) {
    return 'Yesterday'
  }

  const diffDays = Math.floor((today.getTime() - date.getTime()) / (1000 * 60 * 60 * 24))
  if (diffDays < 7) {
    return `${diffDays}d ago`
  }

  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
