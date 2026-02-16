import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
} from 'recharts'
import { ChevronLeftIcon } from '../components/Icons'
import { useExercises, useActiveMesocycle, useWorkoutHistory, useExerciseProgress } from '../api/hooks'

export default function Progress() {
  const navigate = useNavigate()
  const { data: exercises = [], isLoading: exercisesLoading } = useExercises()
  const { data: mesocycle } = useActiveMesocycle()
  const { data: workouts = [] } = useWorkoutHistory(mesocycle?.id ?? '')
  const [selectedExercise, setSelectedExercise] = useState<string>('')

  // Auto-select first exercise
  if (exercises.length > 0 && !selectedExercise) {
    setSelectedExercise(exercises[0]!.id)
  }

  const { data: progressData = [] } = useExerciseProgress(selectedExercise)

  if (exercisesLoading) {
    return <div className="text-slate-400 text-center py-8">Loading...</div>
  }

  // Calculate mesocycle stats
  const totalVolume = workouts.reduce((sum, w) => sum + w.total_volume, 0)
  const totalSets = workouts.reduce((sum, w) => sum + w.total_sets, 0)
  const completionPercent = mesocycle
    ? Math.round((mesocycle.current_week / mesocycle.total_weeks) * 100)
    : 0

  // Group workouts by week for volume chart
  const weeklyVolume = workouts.reduce((acc, w) => {
    const key = `Week ${w.week_number}`
    if (!acc[key]) {
      acc[key] = { week: key, volume: 0, sets: 0 }
    }
    acc[key].volume += w.total_volume
    acc[key].sets += w.total_sets
    return acc
  }, {} as { [key: string]: { week: string; volume: number; sets: number } })

  const weeklyData = Object.values(weeklyVolume).sort((a, b) => {
    const weekA = parseInt(a.week.replace('Week ', ''))
    const weekB = parseInt(b.week.replace('Week ', ''))
    return weekA - weekB
  })

  return (
    <div className="px-4 pt-5 space-y-4">
      <header className="flex items-center gap-2">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-xl font-bold">Progress</h1>
      </header>

      {/* Mesocycle Summary */}
      {mesocycle && (
        <div className="card">
          <h2 className="font-medium mb-3">{mesocycle.name}</h2>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="text-2xl font-bold text-protocol-400">{completionPercent}%</div>
              <div className="text-xs text-slate-400">Complete</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-protocol-400">{totalSets}</div>
              <div className="text-xs text-slate-400">Total Sets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-protocol-400">
                {Math.round(totalVolume / 1000)}k
              </div>
              <div className="text-xs text-slate-400">Volume (kg)</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-protocol-500 transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="text-xs text-slate-400 mt-1 text-center">
            Week {mesocycle.current_week} of {mesocycle.total_weeks}
          </div>
        </div>
      )}

      {/* Weekly Volume Chart */}
      {weeklyData.length > 0 && (
        <div className="card">
          <h2 className="font-medium mb-3">Weekly Volume</h2>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis dataKey="week" stroke="#94a3b8" fontSize={12} />
                <YAxis stroke="#94a3b8" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: '#f1f5f9' }}
                  formatter={(value: number) => [`${Math.round(value).toLocaleString()} kg`, 'Volume']}
                />
                <Bar dataKey="volume" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Exercise Progress */}
      <div className="card">
        <h2 className="font-medium mb-3">Exercise Progress</h2>
        <select
          value={selectedExercise}
          onChange={(e) => setSelectedExercise(e.target.value)}
          className="input mb-4"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        {progressData.length === 0 ? (
          <div className="text-slate-500 text-sm text-center py-8">
            No data yet for this exercise.
          </div>
        ) : (
          <>
            {/* Weight Progress Chart */}
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                  <XAxis
                    dataKey="date"
                    stroke="#94a3b8"
                    fontSize={10}
                    tickFormatter={(value) => {
                      const d = new Date(value)
                      return `${d.getMonth() + 1}/${d.getDate()}`
                    }}
                  />
                  <YAxis stroke="#94a3b8" fontSize={12} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: '#f1f5f9' }}
                    formatter={(value: number) => [`${value} kg`, 'Max Weight']}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey="max_weight"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 text-center">
              <div className="bg-slate-800 rounded p-3">
                <div className="text-xl font-bold text-protocol-400">
                  {progressData.length > 0
                    ? Math.max(...progressData.map((d) => d.max_weight))
                    : 0}
                  kg
                </div>
                <div className="text-xs text-slate-400">PR Weight</div>
              </div>
              <div className="bg-slate-800 rounded p-3">
                <div className="text-xl font-bold text-protocol-400">
                  {progressData.length > 0
                    ? Math.round(
                        progressData.reduce((sum, d) => sum + d.volume, 0) / progressData.length
                      ).toLocaleString()
                    : 0}
                </div>
                <div className="text-xs text-slate-400">Avg Volume</div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
