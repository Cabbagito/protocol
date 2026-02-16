import { useParams, useNavigate, Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import AppHeader from '../components/AppHeader'
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
  weights: { weekNum: number; weight: number }[]
  currentWeight: number
  delta: number
}

function getExerciseProgression(mesocycle: Mesocycle): ExerciseProgression[] {
  const exerciseMap = new Map<string, { name: string; muscleGroup: string; weekWeights: Map<number, number> }>()

  for (const week of mesocycle.structure.weeks) {
    for (const session of week.sessions) {
      for (const exercise of session.exercises) {
        if (!exerciseMap.has(exercise.exercise_id)) {
          exerciseMap.set(exercise.exercise_id, {
            name: exercise.exercise_name,
            muscleGroup: exercise.muscle_group,
            weekWeights: new Map(),
          })
        }
        const entry = exerciseMap.get(exercise.exercise_id)!
        for (const set of exercise.sets) {
          if (set.logged && set.weight !== null && set.weight > 0) {
            const existing = entry.weekWeights.get(week.week_number) ?? 0
            if (set.weight > existing) {
              entry.weekWeights.set(week.week_number, set.weight)
            }
          }
        }
      }
    }
  }

  const results: ExerciseProgression[] = []
  for (const [id, entry] of exerciseMap) {
    if (entry.weekWeights.size < 2) continue
    const sorted = [...entry.weekWeights.entries()].sort((a, b) => a[0] - b[0])
    const weights = sorted.map(([weekNum, weight]) => ({ weekNum, weight }))
    const first = weights[0]!.weight
    const last = weights[weights.length - 1]!.weight
    results.push({
      exerciseId: id,
      exerciseName: entry.name,
      muscleGroup: entry.muscleGroup,
      weights,
      currentWeight: last,
      delta: last - first,
    })
  }

  // Sort by total volume (most data points first), then by delta
  results.sort((a, b) => b.weights.length - a.weights.length || b.delta - a.delta)
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
    return <div className="text-slate-400 text-center py-8">Loading...</div>
  }

  if (!mesocycle) {
    return <div className="text-slate-400 text-center py-8">Mesocycle not found</div>
  }

  const totalWorkouts = mesocycle.structure.weeks.length * (mesocycle.structure.weeks[0]?.sessions.length ?? 0)
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
        <div className="text-[11px] mb-4" style={{ color: '#475569' }}>
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
                <span className="text-[10px]" style={{ color: '#475569' }}>complete</span>
              </div>
              <ProgressBar percent={progressPercent} />
            </div>
            <div className="text-right">
              <div className="font-mono text-[12px] font-semibold" style={{ color: '#94a3b8' }}>
                {mesocycle.workouts_completed} / {totalWorkouts}
              </div>
              <div className="text-[9px]" style={{ color: '#475569' }}>workouts</div>
            </div>
          </div>

          <div className="text-[10px] mb-3" style={{ color: '#475569' }}>
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
            style={{ background: '#132438', border: '1px solid rgba(255,255,255,0.04)' }}
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
              style={{ borderColor: 'rgba(14,165,233,0.25)', padding: 16 }}
            >
              <div className="flex items-center gap-3 mb-3">
                <div
                  className="w-9 h-9 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(14,165,233,0.1)', border: '1.5px solid rgba(14,165,233,0.25)' }}
                >
                  <svg className="w-4 h-4" style={{ color: '#38bdf8' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="text-[15px] font-semibold" style={{ color: '#e2e8f0' }}>
                    {nextSession.session.session_name} — Week {mesocycle.structure.weeks[nextSession.weekIndex]!.week_number}
                  </div>
                  <div className="text-[11px]" style={{ color: '#475569' }}>
                    {nextSession.session.exercises.length} exercises
                    {' '}&middot;{' '}
                    {mesocycle.rir_scheme[nextSession.weekIndex] === -1
                      ? 'Deload'
                      : `RiR ${mesocycle.rir_scheme[nextSession.weekIndex]}`}
                  </div>
                </div>
              </div>
              <div className="text-[10px] mb-3 pl-12" style={{ color: '#334155' }}>
                {nextSession.session.exercises.slice(0, 5).map((e) => e.exercise_name).join(' \u00B7 ')}
              </div>
              <button
                className="w-full py-2.5 text-[14px] font-semibold rounded-[10px] text-white text-center"
                style={{
                  background: 'linear-gradient(110deg, #0ea5e9 30%, #38bdf8 50%, #0ea5e9 70%)',
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
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: '#475569', letterSpacing: '0.08em' }}
            >
              Progression
            </span>
            <div
              className="-mx-4 px-4 mt-2 pb-2 flex gap-2.5 overflow-x-auto"
              style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
            >
              <style>{`.prog-scroll::-webkit-scrollbar { display: none; }`}</style>
              {progression.map((ex) => {
                const color = getMuscleColor(ex.muscleGroup)
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
                    <div className="text-[12px] font-medium mb-2 truncate" style={{ color: '#e2e8f0' }}>
                      {ex.exerciseName}
                    </div>
                    <MesoSparkline weights={ex.weights.map((w) => w.weight)} color={color.primary} />
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="font-mono text-[16px] font-bold" style={{ color: color.light }}>
                        {ex.currentWeight}
                      </span>
                      <span className="text-[9px]" style={{ color: '#475569' }}>kg</span>
                      <span
                        className="font-mono text-[9px] ml-auto"
                        style={{ color: ex.delta >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {ex.delta >= 0 ? '+' : ''}{ex.delta.toFixed(1)}
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
              style={{ color: '#475569', letterSpacing: '0.08em' }}
            >
              Volume
            </span>
            <div className="space-y-1.5 mt-2">
              {volume.map((v) => {
                const color = getMuscleColor(v.muscleGroup)
                const pct = Math.round((v.sets / maxVolume) * 100)
                return (
                  <div key={v.muscleGroup} className="flex items-center gap-1.5">
                    <span className="text-[9px] w-9 text-right truncate" style={{ color: '#475569' }}>
                      {v.muscleGroup.charAt(0).toUpperCase() + v.muscleGroup.slice(1)}
                    </span>
                    <div className="flex-1 h-[4px] rounded-full" style={{ background: '#162a3e' }}>
                      <div
                        className="h-full rounded-full transition-all duration-500"
                        style={{ width: `${pct}%`, background: color.primary, opacity: 0.7 }}
                      />
                    </div>
                    <span className="font-mono text-[9px]" style={{ color: '#64748b' }}>{v.sets}</span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Week Sessions */}
          <div className="card flex-1" style={{ padding: '10px 12px' }}>
            <span
              className="text-[10px] font-semibold uppercase tracking-wider"
              style={{ color: '#475569', letterSpacing: '0.08em' }}
            >
              Week {mesocycle.current_week}
            </span>
            <div className="space-y-1.5 mt-2">
              {currentWeek?.sessions.map((session, si) => {
                const allLogged = session.exercises.length > 0 &&
                  session.exercises.every((ex) => ex.sets.every((s) => s.logged))
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
                        style={{ background: 'rgba(14,165,233,0.1)', border: '1px solid rgba(14,165,233,0.2)' }}
                      >
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: '#38bdf8' }} />
                      </div>
                    ) : (
                      <div
                        className="w-4 h-4 rounded"
                        style={{ background: '#162a3e', border: '1px solid #1e3a52' }}
                      />
                    )}
                    <span
                      className={`text-[11px] ${isCurrent ? 'font-medium' : ''}`}
                      style={{ color: allLogged ? '#94a3b8' : isCurrent ? '#e2e8f0' : '#475569' }}
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
            style={{ color: '#475569', letterSpacing: '0.08em' }}
          >
            Recent
          </span>
          {recentWorkouts.length === 0 ? (
            <div className="text-slate-500 text-sm mt-2">No workouts logged yet.</div>
          ) : (
            <div className="mt-2 space-y-1">
              {recentWorkouts.map((workout, idx) => (
                <Link
                  key={idx}
                  to={`/workouts/${mesocycle.id}/${workout.week_index}/${workout.session_index}`}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg active:bg-sky-500/5 transition-colors"
                  style={{ background: 'rgba(15,29,46,0.5)' }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-1 h-6 rounded-full" style={{ background: '#4ade80' }} />
                    <div>
                      <span className="text-[12px] font-medium" style={{ color: '#cbd5e1' }}>
                        {workout.session_name}
                      </span>
                      <span className="text-[10px] ml-1.5" style={{ color: '#334155' }}>
                        W{workout.week_number} &middot; {workout.total_sets} sets
                      </span>
                    </div>
                  </div>
                  {workout.date && (
                    <span className="font-mono text-[10px]" style={{ color: '#475569' }}>
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
            style={{ color: '#94a3b8', border: '1px solid #1e3a52', background: 'transparent' }}
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
