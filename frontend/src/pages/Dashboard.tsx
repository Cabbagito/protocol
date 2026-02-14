import { Link } from 'react-router-dom'
import { useActiveMesocycle, useSplit, useWorkouts } from '../api/hooks'
import { ArrowRightIcon, ProtocolLogo } from '../components/Icons'
import ProgressBar from '../components/ProgressBar'

export default function Dashboard() {
  const { data: mesocycle, isLoading: mesoLoading } = useActiveMesocycle()
  const { data: split } = useSplit(mesocycle?.split_id ?? '')
  const { data: recentWorkouts = [] } = useWorkouts(
    mesocycle ? { mesocycleId: mesocycle.id, limit: 5 } : { limit: 5 }
  )

  const isDeloadWeek = mesocycle?.current_rir === -1

  const getTodaysSuggestion = () => {
    if (!split || !mesocycle) return null
    const trainingSessions = split.sessions.filter((s) => !s.is_rest_day)
    if (trainingSessions.length === 0) return null
    const dayOfWeek = new Date().getDay()
    const sessionIndex = dayOfWeek % trainingSessions.length
    return trainingSessions[sessionIndex]
  }

  const suggestedSession = getTodaysSuggestion()

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

      {/* Today's Workout */}
      {mesocycle && suggestedSession && (
        <div className="card">
          <div className="flex items-start justify-between mb-3">
            <h2 className="font-semibold text-slate-200">Today's Workout</h2>
            <Link to="/progress" className="text-protocol-400 text-sm">
              Progress
            </Link>
          </div>

          <Link
            to={`/workout/${mesocycle.id}/${suggestedSession.id}`}
            className="block rounded-lg p-4 transition-colors"
            style={{ background: '#132438', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-semibold text-slate-200">{suggestedSession.name}</div>
                <div className="text-sm text-slate-500 mt-1">
                  {suggestedSession.exercises.length} exercises
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

      {/* All Sessions */}
      {mesocycle && split && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-slate-200">Start Any Workout</h2>
          <div className="grid grid-cols-2 gap-2">
            {split.sessions
              .filter((s) => !s.is_rest_day)
              .map((session) => (
                <Link
                  key={session.id}
                  to={`/workout/${mesocycle.id}/${session.id}`}
                  className="rounded-lg p-3 text-sm transition-colors hover:bg-navy-input"
                  style={{ background: '#132438', border: '1px solid rgba(255,255,255,0.04)' }}
                >
                  <div className="font-medium text-slate-200">{session.name}</div>
                  <div className="text-xs text-slate-600 mt-0.5">
                    {session.exercises.length} exercises
                  </div>
                </Link>
              ))}
          </div>
        </div>
      )}

      {/* Recent Workouts */}
      {recentWorkouts.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-slate-200">Recent Workouts</h2>
          <div className="space-y-2">
            {recentWorkouts.map((workout) => (
              <Link
                key={workout.id}
                to={`/workouts/${workout.id}`}
                className="flex items-center justify-between rounded-lg p-3 transition-colors hover:bg-navy-input"
                style={{ background: '#132438', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                <div>
                  <div className="font-medium text-sm text-slate-200">
                    {workout.session_name || 'Workout'}
                  </div>
                  <div className="text-xs text-slate-600">
                    {workout.total_sets} sets &middot; {Math.round(workout.total_volume).toLocaleString()}kg
                  </div>
                </div>
                <div className="text-xs text-slate-600">
                  {formatRelativeDate(workout.date)}
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
