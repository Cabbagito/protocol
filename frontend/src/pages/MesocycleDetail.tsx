import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import MesoGrid from '../components/MesoGrid'
import ProgressBar from '../components/ProgressBar'
import MesoSparkline from '../components/MesoSparkline'
import { useMesocycle, useWorkoutHistory, useUpdateMesocycle, useDeleteMesocycle } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import { getExerciseProgression, getVolumeByMuscleGroup, formatVolume } from '../lib/mesoAnalysis'
import MetricToggle from '../components/MetricToggle'
import { getCurrentPosition } from '../lib/mesoUtils'
import type { MesoSession } from '../types'

export default function MesocycleDetail() {
  const toast = useToast()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { data: mesocycle, isLoading } = useMesocycle(id!)
  const { data: history = [] } = useWorkoutHistory(id!)
  const updateMesocycle = useUpdateMesocycle(id!)
  const deleteMesocycle = useDeleteMesocycle()
  const [progressionMetric, setProgressionMetric] = useState<'strength' | 'stimulus'>('strength')

  const handleDeleteMesocycle = async () => {
    if (!confirm('Delete this mesocycle and all its workout logs?')) return
    try {
      await deleteMesocycle.mutateAsync(id!)
      navigate('/mesocycles')
    } catch {
      toast.showError('Failed to delete mesocycle')
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
    return <PageLoader className="min-h-[60vh]" />
  }

  if (!mesocycle) {
    return <div className="text-[var(--text-2)] text-center py-8">Mesocycle not found</div>
  }

  const totalWorkouts = mesocycle.structure.weeks.reduce((count, week) =>
    count + week.sessions.filter(session =>
      session.exercises.some(ex => !ex.skipped)
    ).length, 0
  )
  const progressPercent = totalWorkouts > 0 ? Math.round((mesocycle.workouts_completed / totalWorkouts) * 100) : 0

  const currentPos = getCurrentPosition(mesocycle.structure)
  const currentWeekIndex = currentPos?.weekIndex ?? mesocycle.current_week - 1
  const currentWeek = mesocycle.structure.weeks[currentWeekIndex]
  const sessionsPerWeek = mesocycle.structure.weeks[0]?.sessions.length ?? 0

  // Find the next unlogged session for the CTA
  const getNextSession = (): { weekIndex: number; sessionIndex: number; session: MesoSession } | null => {
    for (let wi = 0; wi < mesocycle.structure.weeks.length; wi++) {
      const week = mesocycle.structure.weeks[wi]!
      for (let si = 0; si < week.sessions.length; si++) {
        const session = week.sessions[si]!
        const nonSkipped = session.exercises.filter(ex => !ex.skipped)
        if (nonSkipped.length === 0) continue
        const allLogged = nonSkipped.every((ex) => ex.sets.every((s) => s.logged))
        if (!allLogged) {
          return { weekIndex: wi, sessionIndex: si, session }
        }
      }
    }
    return null
  }

  const nextSession = getNextSession()
  const progression = getExerciseProgression(mesocycle)
  const volume = getVolumeByMuscleGroup(mesocycle)
  const maxVolume = volume[0]?.sets ?? 1
  const recentWorkouts = history.slice(-5).reverse()

  return (
    <div>
      {/* Header */}
      <AppHeader
        title={mesocycle.name}
        breadcrumb={{ label: 'Mesocycles', to: '/mesocycles' }}
        rightContent={
          mesocycle.is_active ? (
            <span
              className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
              style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}
            >
              Active
            </span>
          ) : undefined
        }
      />

      <div className="px-4 pb-6">
        {/* Split name subtitle */}
        <div className="text-[11px] mb-4" style={{ color: 'var(--text-m)' }}>
          {mesocycle.split_name} &middot; {mesocycle.total_weeks} weeks
        </div>

        {/* Dot Grid Card */}
        <div className="card" style={{ padding: 16 }}>
          <div className="flex items-center gap-3 mb-2">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <span className="font-mono text-[20px] font-bold" style={{ color: '#4ade80' }}>
                  {progressPercent}%
                </span>
                <span className="text-[10px]" style={{ color: 'var(--text-m)' }}>complete</span>
              </div>
              <ProgressBar percent={progressPercent} />
            </div>
            <div className="text-right">
              <div className="font-mono text-[12px] font-semibold" style={{ color: 'var(--text-m)' }}>
                {mesocycle.workouts_completed} / {totalWorkouts}
              </div>
              <div className="text-[9px]" style={{ color: 'var(--text-m)' }}>workouts</div>
            </div>
          </div>

          <div className="text-[10px] mb-3" style={{ color: 'var(--text-m)' }}>
            Week {mesocycle.current_week}
            {' '}&middot;{' '}
            {mesocycle.current_rir === -1 ? 'Deload' : `RiR ${mesocycle.current_rir}`}
            {currentPos && (
              <>
                {' '}&middot;{' '}
                Session {currentPos.sessionIndex + 1} of {sessionsPerWeek}
              </>
            )}
          </div>

          <div
            className="px-3 py-3 rounded-lg"
            style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.04)' }}
          >
            <MesoGrid mesocycle={mesocycle} compact />
          </div>
        </div>

        {/* Continue Workout CTA */}
        {mesocycle.is_active && nextSession && (
          <Link
            to={`/workout/${mesocycle.id}?week=${nextSession.weekIndex}&session=${nextSession.sessionIndex}`}
            className="block mt-3"
          >
            <div
              className="card active:scale-[0.98] transition-transform"
              style={{ borderColor: 'rgba(var(--accent-rgb),0.25)', padding: 16 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(var(--accent-rgb),0.1)', border: '1.5px solid rgba(var(--accent-rgb),0.25)' }}
                >
                  <svg className="w-4 h-4" style={{ color: 'var(--accent-l)' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold" style={{ color: 'var(--text-1)' }}>
                    {nextSession.session.session_name} — Week {mesocycle.structure.weeks[nextSession.weekIndex]!.week_number}
                  </div>
                  <div className="text-[11px]" style={{ color: 'var(--text-m)' }}>
                    {nextSession.session.exercises.length} exercises
                    {' '}&middot;{' '}
                    {mesocycle.rir_scheme[nextSession.weekIndex] === -1
                      ? 'Deload'
                      : `RiR ${mesocycle.rir_scheme[nextSession.weekIndex]}`}
                  </div>
                </div>
              </div>
              <div className="text-[10px] mb-3 pl-12" style={{ color: 'var(--text-m)' }}>
                {nextSession.session.exercises.slice(0, 5).map((e) => e.exercise_name).join(' \u00B7 ')}
              </div>
              <button
                className="w-full py-2.5 text-[14px] font-semibold rounded-[10px] text-white text-center"
                style={{
                  background: 'linear-gradient(110deg, var(--accent) 30%, var(--accent-l) 50%, var(--accent) 70%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer-cta 3s ease-in-out infinite',
                }}
              >
                Start Workout
              </button>
            </div>
          </Link>
        )}

        {/* Exercise Progression */}
        {progression.length > 0 && (
          <div className="mt-5">
            <div className="flex items-center justify-between mb-2">
              <span
                className="text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: 'var(--text-m)', letterSpacing: '0.08em' }}
              >
                Progression
              </span>
              <MetricToggle value={progressionMetric} onChange={setProgressionMetric} size="sm" />
            </div>
            <div
              className="-mx-4 px-4 pb-2 flex gap-2.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none', overscrollBehaviorX: 'contain' }}
            >
              <style>{`.prog-scroll::-webkit-scrollbar { display: none; }`}</style>
              {progression.map((ex) => {
                const color = getMuscleColor(ex.muscleGroup)
                const isStrength = progressionMetric === 'strength'
                const data = isStrength ? ex.strengthData : ex.stimulusData
                const current = isStrength ? ex.currentE1rm : ex.currentVolume
                const delta = isStrength ? ex.e1rmDelta : ex.volumeDelta
                return (
                  <div key={ex.exerciseId} className="card shrink-0" style={{ width: 160, padding: 12 }}>
                    <div className="flex items-center gap-1.5 mb-1">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ background: color.primary }} />
                      <span
                        className="text-[10px] font-semibold uppercase tracking-wider"
                        style={{ color: color.light }}
                      >
                        {ex.muscleGroup}
                      </span>
                    </div>
                    <div className="text-[12px] font-medium mb-2 truncate" style={{ color: 'var(--text-1)' }}>
                      {ex.exerciseName}
                    </div>
                    <MesoSparkline weights={data.map((d) => d.value)} color={color.primary} />
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="font-mono text-[16px] font-bold" style={{ color: color.light }}>
                        {isStrength ? current.toFixed(1) : formatVolume(current)}
                      </span>
                      <span className="text-[9px]" style={{ color: 'var(--text-m)' }}>
                        {isStrength ? 'kg' : 'kg'}
                      </span>
                      <span
                        className="font-mono text-[9px] ml-auto"
                        style={{ color: delta >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {delta >= 0 ? '+' : '-'}{isStrength ? Math.abs(delta).toFixed(1) : formatVolume(Math.abs(delta))}
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Volume + Week Sessions — side by side */}
        <div className="flex gap-2.5 mt-3">
          {/* Volume */}
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-m)', letterSpacing: '0.08em' }}
            >
              Volume
            </span>
            <div className="space-y-1.5 mt-2">
              {volume.map((v) => {
                const color = getMuscleColor(v.muscleGroup)
                const pct = Math.round((v.sets / maxVolume) * 100)
                return (
                  <div key={v.muscleGroup} className="flex items-center gap-1.5">
                    <span className="text-[9px] w-9 text-right truncate" style={{ color: 'var(--text-m)' }}>
                      {v.muscleGroup.charAt(0).toUpperCase() + v.muscleGroup.slice(1)}
                    </span>
                    <div className="flex-1 h-[4px] rounded-full" style={{ background: 'var(--input)' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color.primary, opacity: 0.7 }}
                      />
                    </div>
                    <span className="font-mono text-[9px]" style={{ color: 'var(--text-m)' }}>{v.sets}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Week Sessions */}
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-m)', letterSpacing: '0.08em' }}
            >
              Week {mesocycle.current_week}
            </span>
            <div className="space-y-1.5 mt-2">
              {currentWeek?.sessions.map((session, si) => {
                const nonSkipped = session.exercises.filter(ex => !ex.skipped)
                const allLogged = nonSkipped.length > 0 &&
                  nonSkipped.every((ex) => ex.sets.every((s) => s.logged))
                const isCurrent = currentPos !== null &&
                  currentWeekIndex === currentPos.weekIndex &&
                  si === currentPos.sessionIndex

                return (
                  <div key={si} className="flex items-center gap-2">
                    {allLogged ? (
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center"
                        style={{ background: 'rgba(34,197,94,0.12)' }}
                      >
                        <svg className="w-2.5 h-2.5" fill="none" stroke="#4ade80" strokeWidth={3} viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      </div>
                    ) : isCurrent ? (
                      <div
                        className="w-4 h-4 rounded flex items-center justify-center"
                        style={{ background: 'rgba(var(--accent-rgb),0.1)', border: '1px solid rgba(var(--accent-rgb),0.2)' }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-l)' }} />
                      </div>
                    ) : (
                      <div
                        className="w-4 h-4 rounded"
                        style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
                      />
                    )}
                    <span
                      className={`text-[11px] ${isCurrent ? 'font-medium' : ''}`}
                      style={{ color: allLogged ? 'var(--text-m)' : isCurrent ? 'var(--text-1)' : 'var(--text-m)' }}
                    >
                      {session.session_name}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {/* Recent Workouts */}
        <div className="mt-3">
          <span
            className="text-[10px] font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-m)', letterSpacing: '0.08em' }}
          >
            Recent
          </span>
          {recentWorkouts.length === 0 ? (
            <div className="text-[var(--text-m)] text-sm mt-2">No workouts logged yet.</div>
          ) : (
            <div className="mt-2 space-y-1">
              {recentWorkouts.map((workout, idx) => (
                <Link
                  key={idx}
                  to={`/workouts/${mesocycle.id}/${workout.week_index}/${workout.session_index}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg active:bg-sky-500/5 transition-colors"
                  style={{ background: 'var(--card)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 rounded-full" style={{ background: '#4ade80' }} />
                    <div>
                      <span className="text-[12px] font-medium" style={{ color: 'var(--text-2)' }}>
                        {workout.session_name}
                      </span>
                      <span className="text-[10px] ml-1.5" style={{ color: 'var(--text-m)' }}>
                        W{workout.week_number} &middot; {workout.total_sets} sets
                      </span>
                    </div>
                  </div>
                  {workout.date && (
                    <span className="font-mono text-[10px]" style={{ color: 'var(--text-m)' }}>
                      {new Date(workout.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-5">
          <button
            onClick={handleToggleActive}
            className="flex-1 py-2.5 text-[12px] font-medium rounded-lg text-center transition-all active:scale-[0.97]"
            style={{ color: 'var(--text-m)', border: '1px solid var(--border)', background: 'transparent' }}
          >
            {mesocycle.is_active ? 'Archive' : 'Reactivate'}
          </button>
          <button
            onClick={handleDeleteMesocycle}
            className="flex-1 py-2.5 text-[12px] font-medium rounded-lg text-center transition-all active:scale-[0.97]"
            style={{ color: 'rgba(248,113,113,0.5)', border: '1px solid rgba(248,113,113,0.1)', background: 'transparent' }}
          >
            Delete
          </button>
        </div>
      </div>

      {/* CTA shimmer animation */}
      <style>{`
        @keyframes shimmer-cta {
          0% { background-position: -200% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  )
}
