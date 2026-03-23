import { useState } from 'react'
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
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import { formatWeight } from '../lib/weightUtils'
import { useExercises, useActiveMesocycle, useWorkoutHistory, useExerciseProgress } from '../api/hooks'

export default function Progress() {
  const { data: exercises = [], isLoading: exercisesLoading } = useExercises()
  const { data: mesocycle } = useActiveMesocycle()
  const { data: workouts = [] } = useWorkoutHistory(mesocycle?.id ?? '')
  const [selectedExercise, setSelectedExercise] = useState<string>('')
  const [metric, setMetric] = useState<'strength' | 'stimulus'>('strength')

  // Auto-select first exercise
  if (exercises.length > 0 && !selectedExercise) {
    setSelectedExercise(exercises[0]!.id)
  }

  const { data: progressData = [] } = useExerciseProgress(selectedExercise)

  if (exercisesLoading) {
    return <PageLoader className="min-h-[60vh]" />
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
    <div>
      <AppHeader title="Progress" />

      <div className="px-4 space-y-4">
      {/* Mesocycle Summary */}
      {mesocycle && (
        <div className="card">
          <h2 className="font-medium mb-3">{mesocycle.name}</h2>
          <div className="grid grid-cols-3 gap-4 text-center mb-4">
            <div>
              <div className="text-2xl font-bold text-protocol-400">{completionPercent}%</div>
              <div className="text-xs text-[var(--text-2)]">Complete</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-protocol-400">{totalSets}</div>
              <div className="text-xs text-[var(--text-2)]">Total Sets</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-protocol-400">
                {Math.round(totalVolume / 1000)}k
              </div>
              <div className="text-xs text-[var(--text-2)]">Volume (kg)</div>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2 bg-[var(--input)] rounded-full overflow-hidden">
            <div
              className="h-full bg-protocol-500 transition-all"
              style={{ width: `${completionPercent}%` }}
            />
          </div>
          <div className="text-xs text-[var(--text-2)] mt-1 text-center">
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
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="week" stroke="var(--text-m)" fontSize={12} />
                <YAxis stroke="var(--text-m)" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'var(--panel)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                  }}
                  labelStyle={{ color: 'var(--text-1)' }}
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
          className="input mb-3"
        >
          {exercises.map((ex) => (
            <option key={ex.id} value={ex.id}>
              {ex.name}
            </option>
          ))}
        </select>

        {/* Strength / Stimulus toggle */}
        <div className="flex rounded-lg overflow-hidden mb-4" style={{ border: '1px solid var(--border)' }}>
          {(['strength', 'stimulus'] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className="flex-1 py-1.5 text-[12px] font-medium transition-colors"
              style={{
                background: metric === m ? 'rgba(139,92,246,0.15)' : 'transparent',
                color: metric === m ? '#a78bfa' : 'var(--text-m)',
              }}
            >
              {m === 'strength' ? 'Strength' : 'Stimulus'}
            </button>
          ))}
        </div>

        {progressData.length === 0 ? (
          <div className="text-[var(--text-m)] text-sm text-center py-8">
            No data yet for this exercise.
          </div>
        ) : (
          <>
            {/* Progress Chart */}
            <div className="h-48 mb-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={progressData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis
                    dataKey="date"
                    stroke="var(--text-m)"
                    fontSize={10}
                    tickFormatter={(value) => {
                      const d = new Date(value)
                      return `${d.getMonth() + 1}/${d.getDate()}`
                    }}
                  />
                  <YAxis
                    stroke="var(--text-m)"
                    fontSize={12}
                    domain={['auto', 'auto']}
                    tickFormatter={metric === 'stimulus' ? (v: number) => {
                      if (v >= 10000) return `${(v / 1000).toFixed(0)}k`
                      if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
                      return v.toFixed(0)
                    } : undefined}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#1e293b',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                    }}
                    labelStyle={{ color: 'var(--text-1)' }}
                    formatter={(value: number) => [
                      metric === 'strength' ? `${value} kg` : `${Math.round(value).toLocaleString()} kg`,
                      metric === 'strength' ? 'Est. 1RM' : 'Volume',
                    ]}
                    labelFormatter={(value) => new Date(value).toLocaleDateString()}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric === 'strength' ? 'best_e1rm' : 'volume'}
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={{ fill: '#8b5cf6', strokeWidth: 0 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-4 text-center">
              {metric === 'strength' ? (
                <>
                  <div className="bg-[var(--card)] rounded p-3">
                    <div className="text-xl font-bold text-protocol-400">
                      {Math.max(...progressData.map((d) => d.best_e1rm)).toFixed(1)}
                      <span className="text-sm ml-0.5">kg</span>
                    </div>
                    <div className="text-xs text-[var(--text-2)]">PR Est. 1RM</div>
                  </div>
                  <div className="bg-[var(--card)] rounded p-3">
                    <div className="text-xl font-bold text-protocol-400">
                      {formatWeight(Math.max(...progressData.map((d) => d.max_weight)))}
                      <span className="text-sm ml-0.5">kg</span>
                    </div>
                    <div className="text-xs text-[var(--text-2)]">PR Weight</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-[var(--card)] rounded p-3">
                    <div className="text-xl font-bold text-protocol-400">
                      {(() => {
                        const peak = Math.max(...progressData.map((d) => d.volume))
                        if (peak >= 10000) return `${(peak / 1000).toFixed(0)}k`
                        if (peak >= 1000) return `${(peak / 1000).toFixed(1)}k`
                        return peak.toFixed(0)
                      })()}
                    </div>
                    <div className="text-xs text-[var(--text-2)]">Peak Volume</div>
                  </div>
                  <div className="bg-[var(--card)] rounded p-3">
                    <div className="text-xl font-bold text-protocol-400">
                      {(() => {
                        const avg = Math.round(progressData.reduce((sum, d) => sum + d.volume, 0) / progressData.length)
                        if (avg >= 10000) return `${(avg / 1000).toFixed(0)}k`
                        if (avg >= 1000) return `${(avg / 1000).toFixed(1)}k`
                        return avg.toFixed(0)
                      })()}
                    </div>
                    <div className="text-xs text-[var(--text-2)]">Avg Volume</div>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      </div>
    </div>
  )
}
