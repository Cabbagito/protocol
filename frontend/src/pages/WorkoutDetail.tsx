import { useParams } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import { useWorkoutDetail } from '../api/hooks'
import MuscleGroupBadge from '../components/MuscleGroupBadge'
import RirBadge from '../components/RirBadge'
import { getMuscleColor } from '../lib/muscleColors'
import type { MesoExercise, MesoSet } from '../types'

type SetState = 'met' | 'exceeded' | 'under'

function getSetState(set: MesoSet): SetState {
  if (set.set_type === 'myorep_match') return 'met'
  const reps = set.reps ?? 0
  if (reps > set.target_reps) return 'exceeded'
  if (reps >= set.target_reps) return 'met'
  return 'under'
}

const SET_COLORS: Record<SetState, { text: string; icon: string; bg: string }> = {
  met: { text: 'var(--accent-l)', icon: 'var(--accent)', bg: 'rgba(var(--accent-rgb),0.06)' },
  exceeded: { text: '#c084fc', icon: '#a855f7', bg: 'rgba(168,85,247,0.06)' },
  under: { text: '#f87171', icon: '#ef4444', bg: 'rgba(239,68,68,0.04)' },
}

const SET_TYPE_LABELS: Record<string, { label: string; color: string; bg: string; border: string; rowBg: string }> = {
  myorep: { label: 'MR', color: '#2dd4bf', bg: 'rgba(45,212,191,0.12)', border: 'rgba(45,212,191,0.3)', rowBg: 'rgba(45,212,191,0.04)' },
  myorep_match: { label: 'MM', color: '#fbbf24', bg: 'rgba(251,191,36,0.12)', border: 'rgba(251,191,36,0.3)', rowBg: 'rgba(251,191,36,0.05)' },
}

const STRAIGHT_PILL = { color: 'var(--text-2)', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.12)' }

function SetStatusIcon({ state }: { state: SetState }) {
  if (state === 'met') {
    return (
      <svg className="w-3.5 h-3.5" style={{ color: SET_COLORS.met.icon }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
      </svg>
    )
  }
  if (state === 'exceeded') {
    return (
      <svg className="w-3.5 h-3.5" style={{ color: SET_COLORS.exceeded.icon }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
      </svg>
    )
  }
  return (
    <svg className="w-3.5 h-3.5" style={{ color: SET_COLORS.under.icon }} fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  )
}

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

  // Performance breakdown using getSetState so MM sets are always 'met'
  const metCount = allLoggedSets.filter((s) => getSetState(s) === 'met').length
  const exceededCount = allLoggedSets.filter((s) => getSetState(s) === 'exceeded').length
  const underCount = allLoggedSets.filter((s) => getSetState(s) === 'under').length

  // On-target percentage (met + exceeded)
  const onTargetCount = metCount + exceededCount
  const onTargetPct = totalSets > 0 ? Math.round((onTargetCount / totalSets) * 100) : 0
  const perfTotal = metCount + exceededCount + underCount
  const metPct = perfTotal > 0 ? (metCount / perfTotal) * 100 : 0
  const exceededPct = perfTotal > 0 ? (exceededCount / perfTotal) * 100 : 0
  const underPct = perfTotal > 0 ? (underCount / perfTotal) * 100 : 0

  // Derive RiR from first logged set
  const firstLoggedSet = allLoggedSets[0]
  const rir = firstLoggedSet?.rir ?? null

  // Format volume for display
  const formatVolume = (v: number) => {
    if (v >= 1000) return `${(v / 1000).toFixed(1).replace(/\.0$/, '')}k`
    return v.toLocaleString()
  }

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
        breadcrumb={{ label: 'Mesocycle', to: `/mesocycles/${mesocycleId}` }}
        rightContent={rir !== null ? <RirBadge rir={rir} /> : undefined}
      />

      <div className="px-4 space-y-3 pb-10">
        {/* Session Summary Scoreboard */}
        <div className="card stagger">
          <div className="grid grid-cols-4 gap-2 text-center">
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
            <div>
              <div className="mono text-[22px] font-bold" style={{ color: '#4ade80' }}>
                {onTargetPct}<span className="text-[14px]">%</span>
              </div>
              <div className="text-[9px] font-medium uppercase tracking-wider text-[var(--text-m)]">On Target</div>
            </div>
          </div>
        </div>

        {/* Performance Breakdown */}
        {perfTotal > 0 && (
          <div className="card stagger" style={{ padding: '12px 16px' }}>
            {/* Proportional bar */}
            <div
              className="flex mb-3 overflow-hidden"
              style={{ height: 6, borderRadius: 3, background: 'var(--input)' }}
            >
              {metPct > 0 && (
                <div
                  style={{
                    width: `${metPct}%`,
                    background: 'var(--accent)',
                    borderRadius: exceededPct === 0 && underPct === 0 ? 3 : undefined,
                    borderTopLeftRadius: 3,
                    borderBottomLeftRadius: 3,
                  }}
                />
              )}
              {exceededPct > 0 && (
                <div style={{ width: `${exceededPct}%`, background: '#a855f7' }} />
              )}
              {underPct > 0 && (
                <div
                  style={{
                    width: `${underPct}%`,
                    background: '#ef4444',
                    borderTopRightRadius: 3,
                    borderBottomRightRadius: 3,
                  }}
                />
              )}
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                <span className="text-[10px] text-[var(--text-2)]">Hit target</span>
                <span className="mono text-[11px] font-semibold" style={{ color: 'var(--accent-l)' }}>{metCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#a855f7' }} />
                <span className="text-[10px] text-[var(--text-2)]">Exceeded</span>
                <span className="mono text-[11px] font-semibold" style={{ color: '#c084fc' }}>{exceededCount}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full" style={{ background: '#ef4444' }} />
                <span className="text-[10px] text-[var(--text-2)]">Under</span>
                <span className="mono text-[11px] font-semibold" style={{ color: '#f87171' }}>{underCount}</span>
              </div>
            </div>
          </div>
        )}

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
                  style={{ gridTemplateColumns: '36px 1fr 1fr 1fr 28px', padding: '4px 8px 2px' }}
                >
                  <div className="text-[9px] font-medium uppercase tracking-wider text-center text-[var(--text-m)]">#</div>
                  <div className="text-[9px] font-medium uppercase tracking-wider text-center text-[var(--text-m)]">Weight</div>
                  <div className="text-[9px] font-medium uppercase tracking-wider text-center text-[var(--text-m)]">Reps</div>
                  <div className="text-[9px] font-medium uppercase tracking-wider text-center text-[var(--text-m)]">Target</div>
                  <div />
                </div>

                {/* Set rows */}
                {loggedSets.map((set, i) => {
                  const state = getSetState(set)
                  const colors = SET_COLORS[state]
                  const setType = set.set_type ?? 'straight'
                  const typeInfo = SET_TYPE_LABELS[setType]

                  return (
                    <div
                      key={set.set_num}
                      className="grid items-center gap-1 rounded-md"
                      style={{
                        gridTemplateColumns: '36px 1fr 1fr 1fr 28px',
                        padding: '6px 8px',
                        background: typeInfo ? typeInfo.rowBg : (i % 2 === 0 ? colors.bg : undefined),
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
                      <div className="mono text-[13px] font-medium text-center" style={{ color: colors.text }}>
                        {set.weight ?? 0}
                      </div>
                      <div className="mono text-[13px] font-medium text-center" style={{ color: colors.text }}>
                        {set.reps ?? 0}
                      </div>
                      <div className="mono text-[11px] text-center text-[var(--text-m)]">{set.target_reps}</div>
                      <div className="flex justify-center">
                        <SetStatusIcon state={state} />
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
                        {summary.bestWeight} &times; {summary.bestReps}
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
                        +{summary.weightGain % 1 === 0 ? summary.weightGain.toFixed(1) : summary.weightGain}
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
