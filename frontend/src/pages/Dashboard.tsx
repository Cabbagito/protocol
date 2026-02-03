import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { Mesocycle, Split, WorkoutListItem } from '../types'

export default function Dashboard() {
  const [mesocycle, setMesocycle] = useState<Mesocycle | null>(null)
  const [split, setSplit] = useState<Split | null>(null)
  const [recentWorkouts, setRecentWorkouts] = useState<WorkoutListItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    try {
      const mesoData = await api.get<Mesocycle | null>('/mesocycles/active')
      setMesocycle(mesoData)

      if (mesoData) {
        const [splitData, workoutsData] = await Promise.all([
          api.get<Split>(`/splits/${mesoData.split_id}`),
          api.get<WorkoutListItem[]>(`/workouts?mesocycle_id=${mesoData.id}&limit=5`),
        ])
        setSplit(splitData)
        setRecentWorkouts(workoutsData)
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const isDeloadWeek = mesocycle?.current_rir === -1

  // Determine today's suggested workout based on day of week and split sessions
  const getTodaysSuggestion = () => {
    if (!split || !mesocycle) return null

    const trainingSessions = split.sessions.filter((s) => !s.is_rest_day)
    if (trainingSessions.length === 0) return null

    // Simple rotation: day of week mod number of training sessions
    const dayOfWeek = new Date().getDay()
    const sessionIndex = dayOfWeek % trainingSessions.length
    return trainingSessions[sessionIndex]
  }

  const suggestedSession = getTodaysSuggestion()

  if (loading) {
    return <div className="text-slate-400 text-center py-8">Loading...</div>
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-2xl font-bold">Protocol</h1>
        <p className="text-slate-400 text-sm">
          {new Date().toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </p>
      </header>

      {/* Active Mesocycle */}
      {mesocycle ? (
        <div className="card bg-gradient-to-br from-protocol-900 to-slate-800 border border-protocol-600/30">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="font-semibold text-lg">{mesocycle.name}</h2>
              <div className="text-sm text-slate-400 mt-1">
                Week {mesocycle.current_week} of {mesocycle.total_weeks}
                {' '}&middot;{' '}
                {isDeloadWeek ? (
                  <span className="text-yellow-400">Deload Week</span>
                ) : (
                  <span>Target RiR {mesocycle.current_rir}</span>
                )}
              </div>
            </div>
            <Link to={`/mesocycles/${mesocycle.id}`} className="text-protocol-400 text-sm">
              View
            </Link>
          </div>

          {/* Progress bar */}
          <div className="mt-4">
            <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-protocol-500 transition-all"
                style={{
                  width: `${(mesocycle.current_week / mesocycle.total_weeks) * 100}%`,
                }}
              />
            </div>
            <div className="text-xs text-slate-500 mt-1 text-center">
              {mesocycle.workouts_completed} workouts completed
            </div>
          </div>
        </div>
      ) : (
        <div className="card">
          <h2 className="font-semibold mb-2">Get Started</h2>
          <p className="text-slate-400 text-sm mb-4">
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
            <h2 className="font-semibold">Today's Workout</h2>
            <Link to="/progress" className="text-protocol-400 text-sm">
              Progress
            </Link>
          </div>

          <Link
            to={`/workout/${mesocycle.id}/${suggestedSession.id}`}
            className="block bg-slate-800 hover:bg-slate-700 rounded-lg p-4 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-medium">{suggestedSession.name}</div>
                <div className="text-sm text-slate-400">
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

      {/* All Sessions (if mesocycle active) */}
      {mesocycle && split && (
        <div className="card">
          <h2 className="font-semibold mb-3">Start Any Workout</h2>
          <div className="grid grid-cols-2 gap-2">
            {split.sessions
              .filter((s) => !s.is_rest_day)
              .map((session) => (
                <Link
                  key={session.id}
                  to={`/workout/${mesocycle.id}/${session.id}`}
                  className="bg-slate-800 hover:bg-slate-700 rounded p-3 text-sm transition-colors"
                >
                  <div className="font-medium">{session.name}</div>
                  <div className="text-xs text-slate-500">
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
          <h2 className="font-semibold mb-3">Recent Workouts</h2>
          <div className="space-y-2">
            {recentWorkouts.map((workout) => (
              <Link
                key={workout.id}
                to={`/workouts/${workout.id}`}
                className="flex items-center justify-between bg-slate-800 hover:bg-slate-700 rounded p-3 transition-colors"
              >
                <div>
                  <div className="font-medium text-sm">{workout.session_name || 'Workout'}</div>
                  <div className="text-xs text-slate-500">
                    {workout.total_sets} sets &middot; {Math.round(workout.total_volume).toLocaleString()}kg
                  </div>
                </div>
                <div className="text-xs text-slate-500">
                  {formatRelativeDate(workout.date)}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/exercises" className="card text-center hover:border-protocol-500/50 transition-colors">
          <DumbbellIcon className="w-8 h-8 mx-auto mb-2 text-protocol-400" />
          <div className="text-sm">Exercises</div>
        </Link>
        <Link to="/splits" className="card text-center hover:border-protocol-500/50 transition-colors">
          <CalendarIcon className="w-8 h-8 mx-auto mb-2 text-protocol-400" />
          <div className="text-sm">Splits</div>
        </Link>
      </div>
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

function ArrowRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5 21 12m0 0-7.5 7.5M21 12H3" />
    </svg>
  )
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h2.25M3 12h2.25m0 0V7.5m0 4.5v4.5M3 16.5h2.25M21 7.5h-2.25m0 0V12m0-4.5v4.5m0 0h2.25m-2.25 0v4.5m0 0h2.25M6.75 7.5h10.5v9H6.75v-9Z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}
