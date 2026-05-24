import { useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import { useWorkoutDetail } from '../api/hooks'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import { getMuscleColor } from '../lib/muscleColors'
import { formatWeight } from '../lib/weightUtils'
import { SET_TYPE_LABELS, STRAIGHT_PILL } from '../lib/setConstants'
import { formatVolume } from '../lib/formatters'
import type { MesoExercise } from '../types'

function computeExerciseSummary(exercise: MesoExercise) {
  const logged = exercise.sets.filter((s) => s.logged)
  if (logged.length === 0) return null

  let bestSet = logged[0]!
  let bestVolume = (bestSet.weight ?? 0) * (bestSet.reps ?? 0)
  let totalVolume = 0

  for (const s of logged) {
    const vol = (s.weight ?? 0) * (s.reps ?? 0)
    totalVolume += vol
    if (vol > bestVolume) {
      bestVolume = vol
      bestSet = s
    }
  }

  // Weight gain: compare actual weight used vs suggested_weight on first set
  const actualWeight = bestSet.weight ?? 0
  const suggested = logged[0]!.suggested_weight
  const weightGain = suggested != null && actualWeight > suggested ? actualWeight - suggested : null

  return {
    bestWeight: bestSet.weight ?? 0,
    bestReps: bestSet.reps ?? 0,
    totalVolume,
    weightGain,
  }
}

export default function WorkoutDetail() {
  const { mesocycleId, weekIndex: weekStr, sessionIndex: sessionStr } = useParams<{
    mesocycleId: string
    weekIndex: string
    sessionIndex: string
  }>()
  const weekIndex = parseInt(weekStr ?? '0')
  const sessionIndex = parseInt(sessionStr ?? '0')
  const { data: workout, isLoading } = useWorkoutDetail(mesocycleId!, weekIndex, sessionIndex)

  if (isLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  if (!workout) {
    return <div className="text-[var(--text-2)] text-center py-8">Workout not found</div>
  }

  const exerciseNotes = workout.exercise_notes ?? {}

  // Collect all logged sets across non-skipped exercises
  const activeExercises = workout.exercises.filter(ex => !ex.skipped)
  const allLoggedSets = activeExercises.flatMap((ex) =>
    ex.sets.filter((s) => s.logged)
  )
  const totalSets = allLoggedSets.length
  const totalVolume = allLoggedSets.reduce((sum, s) => sum + (s.weight ?? 0) * (s.reps ?? 0), 0)
  const exerciseCount = activeExercises.filter((ex) => ex.sets.some((s) => s.logged)).length

  // Volume by muscle group
  const muscleVolume: Record<string, number> = {}
  for (const ex of activeExercises) {
    const loggedCount = ex.sets.filter((s) => s.logged).length
    if (loggedCount > 0) {
      const group = ex.muscle_group || 'other'
      muscleVolume[group] = (muscleVolume[group] ?? 0) + loggedCount
    }
  }
  const muscleEntries = Object.entries(muscleVolume).sort(([, a], [, b]) => b - a)
  const maxMuscleSets = muscleEntries.length > 0 ? muscleEntries[0]![1] : 1

  const skippedExercises = workout.exercises.filter(ex => ex.skipped)

  return (
    <div>
      <AppHeader
        title={workout.session_name}
        subtitle={`Week ${workout.week_number}${workout.date ? ` · ${new Date(workout.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}` : ''}`}
        breadcrumb={{ label: 'Mesocycle', to: `/mesocycles/${mesocycleId}` }}
      />

      <div className="px-4 space-y-3 pb-10">
        {/* Session Summary Scoreboard */}
        <div className="card stagger">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="mono text-[22px] font-bold" style={{ color: 'var(--accent-l)' }}>
                {totalSets}
              </div>
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-m)]">Sets</div>
            </div>
            <div>
              <div className="mono text-[22px] font-bold text-[var(--text-1)]">
                {formatVolume(Math.round(totalVolume))}
              </div>
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-m)]">Volume</div>
            </div>
            <div>
              <div className="mono text-[22px] font-bold text-[var(--text-2)]">
                {exerciseCount}
              </div>
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-m)]">Exercises</div>
            </div>
          </div>
        </div>

        {/* Section label */}
        <div className="stagger pt-1">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-m)]">Exercises</span>
        </div>

        {/* Exercise Cards */}
        {workout.exercises.map((exercise) => {
          // Skipped exercise — compact row
          if (exercise.skipped) {
            return (
              <div
                key={exercise.exercise_id}
                className="exercise-card stagger flex items-center justify-between"
                style={{ borderColor: 'rgba(255,255,255,0.04)', opacity: 0.5 }}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
                  <span className="text-sm font-medium text-[var(--text-2)] truncate">{exercise.exercise_name}</span>
                </div>
                <span
                  className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded flex-shrink-0"
                  style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-2)' }}
                >
                  Skipped
                </span>
              </div>
            )
          }

          const loggedSets = exercise.sets.filter((s) => s.logged)
          if (loggedSets.length === 0) return null

          const color = getMuscleColor(exercise.muscle_group)
          const summary = computeExerciseSummary(exercise)
          const exerciseNote = exerciseNotes[exercise.exercise_id]

          return (
            <div
              key={exercise.exercise_id}
              className="exercise-card stagger"
              style={{ borderColor: color.cardBorder }}
            >
              {/* Exercise header */}
              <div className="flex items-center gap-2 mb-1">
                <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
                <span className="text-[10px] text-[var(--text-m)] capitalize">{exercise.equipment_type}</span>
              </div>
              <h2 className="text-base font-semibold text-[var(--text-1)] mb-1">{exercise.exercise_name}</h2>

              {/* Exercise note */}
              {exerciseNote && (
                <div className="mb-2 px-2 py-1.5 rounded-md" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
                  <p className="text-[11px] text-amber-400/80 leading-relaxed">{exerciseNote}</p>
                </div>
              )}

              {/* Sets grid */}
              <div className="panel-frosted">
                {/* Column headers */}
                <div
                  className="grid items-center gap-1"
                  style={{ gridTemplateColumns: '36px 1fr 1fr', padding: '4px 8px 2px' }}
                >
                  <div className="text-[9px] font-medium uppercase tracking-wider text-center text-[var(--text-m)]">#</div>
                  <div className="text-[9px] font-medium uppercase tracking-wider text-center text-[var(--text-m)]">Weight</div>
                  <div className="text-[9px] font-medium uppercase tracking-wider text-center text-[var(--text-m)]">Reps</div>
                </div>

                {/* Set rows */}
                {loggedSets.map((set) => {
                  const setType = set.set_type ?? 'straight'
                  const typeInfo = SET_TYPE_LABELS[setType]
                  const textColor = typeInfo ? typeInfo.color : 'var(--text-1)'

                  return (
                    <div
                      key={set.set_num}
                      className="grid items-center gap-1 rounded-md"
                      style={{
                        gridTemplateColumns: '36px 1fr 1fr',
                        padding: '6px 8px',
                        background: typeInfo ? typeInfo.rowBg : undefined,
                      }}
                    >
                      <div className="flex justify-center">
                        {typeInfo ? (
                          <span
                            className="inline-flex items-center justify-center min-w-[28px] h-7 rounded-md text-[10px] font-semibold"
                            style={{ background: typeInfo.bg, color: typeInfo.color, border: `1px solid ${typeInfo.border}` }}
                          >
                            {typeInfo.label}
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center justify-center min-w-[28px] h-7 rounded-md mono text-[11px]"
                            style={{ color: STRAIGHT_PILL.color, background: STRAIGHT_PILL.bg, border: `1px solid ${STRAIGHT_PILL.border}` }}
                          >
                            {set.set_num}
                          </span>
                        )}
                      </div>
                      <div className="mono text-[13px] font-medium text-center" style={{ color: textColor }}>
                        {formatWeight(set.weight ?? 0)}
                      </div>
                      <div className="mono text-[13px] font-medium text-center" style={{ color: textColor }}>
                        {set.reps ?? 0}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Exercise summary footer */}
              {summary && (
                <div
                  className="mt-2 px-3 py-2 flex items-center justify-between rounded-md"
                  style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-[var(--text-m)]">Best Set</div>
                      <div className="mono text-[12px] font-semibold text-[var(--text-2)]">
                        {formatWeight(summary.bestWeight)} &times; {summary.bestReps}
                      </div>
                    </div>
                    <div style={{ width: 1, height: 20, background: 'var(--border)' }} />
                    <div>
                      <div className="text-[9px] uppercase tracking-wider text-[var(--text-m)]">Volume</div>
                      <div className="mono text-[12px] font-semibold text-[var(--text-2)]">
                        {summary.totalVolume.toLocaleString()}
                      </div>
                    </div>
                  </div>
                  {summary.weightGain != null && (
                    <div className="flex items-center gap-1">
                      <svg className="w-3 h-3" style={{ color: '#22c55e' }} fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
                      </svg>
                      <span className="mono text-[11px] font-semibold" style={{ color: '#22c55e' }}>
                        +{formatWeight(summary.weightGain)}
                      </span>
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}

        {/* Volume by Muscle */}
        {muscleEntries.length > 0 && (
          <>
            <div className="stagger pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-m)]">
                Volume by Muscle
              </span>
            </div>
            <div className="card stagger" style={{ padding: 12 }}>
              <div className="space-y-2">
                {muscleEntries.map(([group, count]) => {
                  const color = getMuscleColor(group)
                  const widthPct = (count / maxMuscleSets) * 100
                  return (
                    <div key={group} className="flex items-center gap-2">
                      <div
                        className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{ background: color.primary }}
                      />
                      <span className="text-[10px] w-16 text-[var(--text-2)] capitalize">{group}</span>
                      <div className="flex-1 h-[4px] rounded-full" style={{ background: 'var(--input)' }}>
                        <div
                          className="h-full rounded-full vol-bar"
                          style={{ width: `${widthPct}%`, background: color.primary, opacity: 0.7 }}
                        />
                      </div>
                      <span className="mono text-[10px] w-8 text-right text-[var(--text-m)]">{count}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          </>
        )}

        {/* Skipped exercises summary */}
        {skippedExercises.length > 0 && (
          <>
            <div className="stagger pt-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--text-m)]">
                Skipped ({skippedExercises.length})
              </span>
            </div>
          </>
        )}

        {/* Notes */}
        {workout.notes && (
          <div className="card stagger">
            <h3 className="font-medium mb-2">Notes</h3>
            <p className="text-[var(--text-2)] text-sm whitespace-pre-wrap">{workout.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}
