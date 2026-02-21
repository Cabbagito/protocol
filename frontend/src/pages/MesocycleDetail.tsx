import { useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import MesoGrid from '../components/MesoGrid'
import ProgressBar from '../components/ProgressBar'
import { useMesocycle, useWorkoutHistory, useUpdateMesocycle, useDeleteMesocycle } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import { getCurrentPosition } from '../lib/mesoUtils'
import type { Mesocycle, MesoSession } from '../types'

// --- Helper functions ---

interface ExerciseProgression {
  exerciseId: string
  exerciseName: string
  muscleGroup: string
  strengthData: { weekNum: number; value: number }[]
  currentE1rm: number
  e1rmDelta: number
  stimulusData: { weekNum: number; value: number }[]
  currentVolume: number
  volumeDelta: number
}

function formatVolume(v: number): string {
  if (v >= 10000) return `${(v / 1000).toFixed(0)}k`
  if (v >= 1000) return `${(v / 1000).toFixed(1)}k`
  return v.toFixed(0)
}

function getExerciseProgression(mesocycle: Mesocycle): ExerciseProgression[] {
  const exerciseMap = new Map<string, {
    name: string
    muscleGroup: string
    weekE1rm: Map<number, number>
    weekVolume: Map<number, number>
  }>()

  for (const week of mesocycle.structure.weeks) {
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        if (!exerciseMap.has(exercise.exercise_id)) {
          exerciseMap.set(exercise.exercise_id, {
            name: exercise.exercise_name,
            muscleGroup: exercise.muscle_group,
            weekE1rm: new Map(),
            weekVolume: new Map(),
          })
        }
        const entry = exerciseMap.get(exercise.exercise_id)!
        for (const set of exercise.sets) {
          if (set.logged && set.weight !== null && set.weight > 0) {
            const e1rm = set.weight * (1 + (set.reps ?? 0) / 30)
            const existing = entry.weekE1rm.get(week.week_number) ?? 0
            if (e1rm > existing) {
              entry.weekE1rm.set(week.week_number, e1rm)
            }
            const vol = set.weight * (set.reps ?? 0)
            entry.weekVolume.set(week.week_number, (entry.weekVolume.get(week.week_number) ?? 0) + vol)
          }
        }
      }
    }
  }

  const results: ExerciseProgression[] = []
  for (const [id, entry] of exerciseMap) {
    if (entry.weekE1rm.size < 2) continue
    const sortedE1rm = [...entry.weekE1rm.entries()].sort((a, b) => a[0] - b[0])
    const strengthData = sortedE1rm.map(([weekNum, value]) => ({ weekNum, value: Math.round(value * 10) / 10 }))
    const sortedVol = [...entry.weekVolume.entries()].sort((a, b) => a[0] - b[0])
    const stimulusData = sortedVol.map(([weekNum, value]) => ({ weekNum, value: Math.round(value) }))

    const firstE1rm = strengthData[0]!.value
    const lastE1rm = strengthData[strengthData.length - 1]!.value
    const firstVol = stimulusData[0]!.value
    const lastVol = stimulusData[stimulusData.length - 1]!.value

    results.push({
      exerciseId: id,
      exerciseName: entry.name,
      muscleGroup: entry.muscleGroup,
      strengthData,
      currentE1rm: lastE1rm,
      e1rmDelta: lastE1rm - firstE1rm,
      stimulusData,
      currentVolume: lastVol,
      volumeDelta: lastVol - firstVol,
    })
  }

  results.sort((a, b) => b.strengthData.length - a.strengthData.length || b.e1rmDelta - a.e1rmDelta)
  return results.slice(0, 6)
}

interface VolumeEntry {
  muscleGroup: string
  sets: number
}

function getVolumeByMuscleGroup(mesocycle: Mesocycle): VolumeEntry[] {
  const volumeMap = new Map<string, number>()

  // Use week 1 since the template is the same each week
  const week = mesocycle.structure.weeks[0]
  if (!week) return []

  for (const session of week.sessions) {
    for (const exercise of session.exercises) {
      const mg = exercise.muscle_group
      volumeMap.set(mg, (volumeMap.get(mg) ?? 0) + exercise.sets.length)
    }
  }

  return [...volumeMap.entries()]
    .map(([muscleGroup, sets]) => ({ muscleGroup, sets }))
    .sort((a, b) => b.sets - a.sets)
    .slice(0, 6)
}

// --- Sparkline component ---

function MesoSparkline({ weights, color }: { weights: number[]; color: string }) {
  if (weights.length < 2) return null

  const W = 136
  const H = 40
  const padX = 4
  const padTop = 6
  const padBot = 4
  const plotW = W - padX * 2
  const plotH = H - padTop - padBot

  const min = Math.min(...weights)
  const max = Math.max(...weights)
  const range = max - min || 1

  const points = weights.map((w, i) => {
    const x = padX + (i / (weights.length - 1)) * plotW
    const y = padTop + plotH - ((w - min) / range) * plotH
    return { x, y }
  })

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')
  const last = points[points.length - 1]!

  // Gradient fill path: line path + close along bottom
  const fillPath =
    `M${points[0]!.x},${points[0]!.y} ` +
    points.slice(1).map((p) => `L${p.x},${p.y}`).join(' ') +
    ` L${last.x},${H - padBot} L${points[0]!.x},${H - padBot} Z`

  const gradId = `grad-${Math.random().toString(36).slice(2, 8)}`

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.15} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${gradId})`} />
      <polyline
        fill="none"
        stroke={color}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={polyline}
      />
      <circle cx={last.x} cy={last.y} r={3} fill={color} />
    </svg>
  )
}

// --- Main component ---

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
              <div className="flex rounded-md overflow-hidden" style={{ border: '1px solid var(--border)' }}>
                {(['strength', 'stimulus'] as const).map((m) => (
                  <button
                    key={m}
                    onClick={() => setProgressionMetric(m)}
                    className="px-2.5 py-0.5 text-[9px] font-medium transition-colors"
                    style={{
                      background: progressionMetric === m ? 'rgba(139,92,246,0.15)' : 'transparent',
                      color: progressionMetric === m ? '#a78bfa' : 'var(--text-m)',
                    }}
                  >
                    {m === 'strength' ? 'Strength' : 'Stimulus'}
                  </button>
                ))}
              </div>
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
