import { useMemo } from 'react'
import { Link, useParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import { useExerciseHistories, useMesocycle } from '../api/hooks'
import { formatVolume } from '../lib/formatters'
import { getMuscleColor, type MuscleColor } from '../lib/muscleColors'
import { useBack } from '../lib/navigation'
import { SET_TYPE_LABELS } from '../lib/setConstants'
import { formatWeight } from '../lib/weightUtils'
import {
  bestE1rm, bestSet, earlierPerformances, liftChange, loggedSets, previousInstance,
  sessionTotals, setsByMuscle, type LiftChange,
} from '../lib/workoutReview'
import type { MesoExercise, MesoSet } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'
/** Labels: --text-m alone fades into the background gradient. */
const LABEL = 'color-mix(in oklab, var(--text-2) 55%, var(--text-m))'
/** Last time's numbers, under this time's. */
const GHOST = 'color-mix(in oklab, var(--text-2) 45%, transparent)'
/** Points in each lift's trend line, this session included. */
const TREND_POINTS = 4

/**
 * Review of one session: what was lifted, and each lift next to the last
 * time it was done. Finished sessions open here (from the mesocycle grid and
 * from Finish workout); the pencil opens the session for corrections.
 */
export default function WorkoutDetail() {
  const { mesocycleId = '', weekIndex: weekStr, sessionIndex: sessionStr } = useParams<{
    mesocycleId: string
    weekIndex: string
    sessionIndex: string
  }>()
  const weekIndex = Number(weekStr ?? 0)
  const sessionIndex = Number(sessionStr ?? 0)
  const back = useBack(`/mesocycles/${mesocycleId}`)
  // Read from the mesocycle (incl. sets not yet synced from this phone).
  const { data: mesocycle, isLoading } = useMesocycle(mesocycleId)

  const session = mesocycle?.structure.weeks[weekIndex]?.sessions[sessionIndex]
  // Logged sets count even if the rest of the exercise was skipped.
  const lifts = useMemo(
    () => session?.exercises.filter(ex => loggedSets(ex.sets).length > 0) ?? [],
    [session],
  )
  const liftIds = useMemo(() => lifts.map(ex => ex.exercise_id), [lifts])
  const histories = useExerciseHistories(liftIds)

  if (isLoading) return <PageLoader className="min-h-[60vh]" />

  const week = mesocycle?.structure.weeks[weekIndex]
  if (!mesocycle || !week || !session) {
    return <div style={{ color: 'var(--text-2)', padding: 32, textAlign: 'center' }}>Workout not found.</div>
  }

  const workoutPath = `/workout/${mesocycleId}?week=${weekIndex}&session=${sessionIndex}`
  const dateLabel = session.date
    ? new Date(`${session.date}T00:00:00`)
      .toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
      .toUpperCase()
    : null
  const exerciseNotes = mesocycle.structure.exercise_notes ?? {}
  const muscles = setsByMuscle(session)
  const totals = sessionTotals(session)
  const prev = previousInstance(mesocycle, weekIndex, sessionIndex)
  const prevTotals = prev ? sessionTotals(prev.session) : null
  const notLogged = session.exercises.filter(ex => loggedSets(ex.sets).length === 0)

  return (
    <div style={{ position: 'relative', overflowX: 'clip' }}>
      <div style={{ position: 'relative', zIndex: 1, padding: '12px 22px 0' }}>
        <Chrome
          eyebrow={`WEEK ${week.week_number}${dateLabel ? ` · ${dateLabel}` : ''}`}
          title={session.session_name}
          onBack={back}
          editTo={lifts.length > 0 && !session.skipped ? `${workoutPath}&edit=1` : null}
        />

        {session.skipped && (
          <div
            style={{
              marginBottom: 18, padding: '12px 14px', borderRadius: 14,
              border: '1px dashed rgba(148,163,184,0.3)', background: 'rgba(148,163,184,0.07)',
              fontSize: 13, color: 'var(--text-2)',
            }}
          >
            This workout was skipped.
          </div>
        )}

        {lifts.length === 0 ? (
          !session.skipped && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-2)', fontSize: 14 }}>
              No sets logged in this session yet.
              <div style={{ marginTop: 16 }}>
                <Link to={workoutPath} className="btn btn-primary" style={{ display: 'inline-block' }}>
                  Open workout
                </Link>
              </div>
            </div>
          )
        ) : (
          <>
            {/* Muscles trained */}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 14px' }}>
              {muscles.map(({ muscleGroup }) => {
                const c = getMuscleColor(muscleGroup)
                return (
                  <span key={muscleGroup} style={{ ...chipText, color: c.light }}>
                    <Dot color={c.primary} glow />
                    {muscleGroup}
                  </span>
                )
              })}
            </div>

            {/* Totals */}
            <SectionHeader label="Totals" right={prev ? `vs week ${prev.weekNumber}` : undefined} />
            <div
              style={{
                display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', padding: '14px 0',
                borderRadius: 18, background: 'rgba(15,29,46,0.5)', border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <Stat label="Sets" value={String(totals.sets)} delta={prevTotals && countDelta(totals.sets, prevTotals.sets)} />
              <Stat
                label="KG lifted"
                value={formatVolume(Math.round(totals.volume))}
                delta={prevTotals && prevTotals.volume > 0 ? pctDelta(totals.volume, prevTotals.volume) : null}
                divider
              />
              <Stat label="Reps" value={String(totals.reps)} delta={prevTotals && countDelta(totals.reps, prevTotals.reps)} divider />
            </div>

            {/* Sets by muscle */}
            <SectionHeader label="Sets by muscle" />
            <div style={{ display: 'flex', gap: 3, height: 6 }}>
              {muscles.map(({ muscleGroup, sets }) => {
                const c = getMuscleColor(muscleGroup)
                return (
                  <span
                    key={muscleGroup}
                    style={{ flex: sets, borderRadius: 3, background: `linear-gradient(90deg, ${c.primary}, ${c.light})` }}
                  />
                )
              })}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px 14px', marginTop: 10 }}>
              {muscles.map(({ muscleGroup, sets }) => (
                <span key={muscleGroup} style={{ ...chipText, fontSize: 9, fontWeight: 500, letterSpacing: '0.14em', color: 'var(--text-2)' }}>
                  <Dot color={getMuscleColor(muscleGroup).primary} />
                  {muscleGroup} <b style={{ fontWeight: 600, color: 'var(--text-1)' }}>{sets}</b>
                </span>
              ))}
            </div>

            {/* Lifts */}
            <SectionHeader
              label="Lifts"
              right={
                <>
                  <span style={{ color: 'var(--text-1)' }}>NOW</span>
                  <span style={{ color: GHOST }}>LAST TIME</span>
                </>
              }
            />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {lifts.map((ex, i) => (
                <LiftCard
                  key={ex.exercise_id}
                  exercise={ex}
                  earlier={earlierPerformances(mesocycle, weekIndex, sessionIndex, ex.exercise_id, histories[i])}
                  note={exerciseNotes[ex.exercise_id] ?? null}
                />
              ))}
            </div>
          </>
        )}

        {notLogged.length > 0 && lifts.length > 0 && (
          <div
            style={{
              marginTop: 10, padding: '12px 14px', borderRadius: 14,
              border: '1px dashed rgba(255,255,255,0.10)', fontSize: 12.5, lineHeight: 1.5,
            }}
          >
            <Eyebrow>{notLogged.every(ex => ex.skipped) ? 'Skipped' : 'Not logged'}</Eyebrow>
            <div style={{ color: 'var(--text-2)', opacity: 0.7, marginTop: 3 }}>
              {notLogged.map(ex => ex.exercise_name).join(' · ')}
            </div>
          </div>
        )}

        {session.notes && (
          <div
            style={{
              marginTop: 10, padding: 14, borderRadius: 14,
              background: 'rgba(15,29,46,0.5)', border: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <Eyebrow>Notes</Eyebrow>
            <p style={{ marginTop: 6, fontSize: 13, color: 'var(--text-2)', whiteSpace: 'pre-wrap' }}>{session.notes}</p>
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function countDelta(now: number, before: number): string {
  const d = now - before
  return d === 0 ? '±0' : d > 0 ? `+${d}` : `−${-d}`
}

function pctDelta(now: number, before: number): string {
  const p = Math.round(((now - before) / before) * 100)
  return p === 0 ? '±0%' : p > 0 ? `+${p}%` : `−${-p}%`
}

function changeLabel(change: LiftChange): string {
  switch (change.dir) {
    case 'first': return 'FIRST TIME'
    case 'same': return 'MATCHED'
    default: {
      const arrow = change.dir === 'up' ? '▲' : '▼'
      return change.unit === 'kg'
        ? `${arrow} ${formatWeight(change.amount)} KG`
        : `${arrow} ${change.amount} ${change.amount === 1 ? 'REP' : 'REPS'}`
    }
  }
}

/* ─── Subcomponents ─────────────────────────────────────────────── */

function LiftCard({
  exercise, earlier, note,
}: {
  exercise: MesoExercise
  earlier: { sets: MesoSet[] }[]
  note: string | null
}) {
  const c = getMuscleColor(exercise.muscle_group)
  const sets = loggedSets(exercise.sets)
  const previous = earlier[earlier.length - 1]?.sets ?? null
  const change = liftChange(sets, previous)
  const top = bestSet(sets)
  const e1rm = bestE1rm(sets)
  const e1rmDelta = previous ? Math.round((e1rm - bestE1rm(previous)) * 10) / 10 : 0
  const trend = [...earlier.slice(-(TREND_POINTS - 1)).map(p => bestE1rm(p.sets)), e1rm]
  // Three tiles a row once a set reads like "102.5×10".
  const longest = Math.max(...sets.map(s => formatWeight(s.weight ?? 0).length + String(s.reps ?? 0).length))
  const isUp = change.dir === 'up'

  return (
    <div
      style={{
        position: 'relative', padding: '14px 14px 12px 18px', borderRadius: 16, overflow: 'hidden',
        background: 'color-mix(in oklab, var(--card) 70%, transparent)',
        border: '1px solid rgba(255,255,255,0.05)',
      }}
    >
      <div
        aria-hidden
        style={{
          position: 'absolute', left: 0, top: 14, bottom: 14, width: 3, borderRadius: '0 2px 2px 0',
          background: `linear-gradient(180deg, ${c.primary}, ${c.light})`,
          boxShadow: `0 0 10px color-mix(in oklab, ${c.primary} 50%, transparent)`,
        }}
      />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...chipText, fontSize: 9, color: c.light }}>{exercise.muscle_group}</div>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-0.01em', marginTop: 3, lineHeight: 1.25, color: 'var(--text-1)' }}>
            {exercise.exercise_name}
          </div>
        </div>
        <span
          style={{
            flex: 'none', fontFamily: MONO, fontSize: 10, fontWeight: 600, letterSpacing: '0.12em',
            padding: '5px 8px', borderRadius: 8, whiteSpace: 'nowrap',
            color: isUp ? 'var(--accent-l)' : 'var(--text-2)',
            background: isUp ? 'rgba(var(--accent-rgb),0.12)' : 'transparent',
            border: isUp ? '1px solid rgba(var(--accent-rgb),0.28)' : '1px dashed rgba(255,255,255,0.16)',
          }}
        >
          {changeLabel(change)}
        </span>
      </div>

      {note && (
        <p style={{ marginTop: 6, fontSize: 12, lineHeight: 1.45, color: 'rgba(251,191,36,0.8)' }}>{note}</p>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${longest > 6 ? 3 : 4}, 1fr)`, gap: 6, marginTop: 12 }}>
        {sets.map((s, i) => (
          <SetTile key={i} set={s} previous={previous?.[i] ?? null} isBest={s === top} color={c} />
        ))}
      </div>

      <div
        style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
          marginTop: 12, paddingTop: 10, borderTop: '1px solid rgba(255,255,255,0.05)',
          fontFamily: MONO, fontSize: 9.5, letterSpacing: '0.12em', color: LABEL,
        }}
      >
        <span>
          EST 1RM <b style={{ color: 'var(--text-2)', fontWeight: 500, letterSpacing: '0.04em' }}>{formatWeight(e1rm)}</b>
          {e1rmDelta !== 0 && (
            <span style={{ marginLeft: 6, color: e1rmDelta > 0 ? 'var(--accent-l)' : 'var(--text-2)' }}>
              {e1rmDelta > 0 ? '▲' : '▼'}{formatWeight(Math.abs(e1rmDelta))}
            </span>
          )}
        </span>
        {trend.length > 1 && <Sparkline values={trend} color={c} />}
      </div>
    </div>
  )
}

function SetTile({
  set, previous, isBest, color,
}: {
  set: MesoSet
  previous: MesoSet | null
  isBest: boolean
  color: MuscleColor
}) {
  const typeInfo = set.set_type ? SET_TYPE_LABELS[set.set_type] : undefined
  const weightUp = previous != null && (set.weight ?? 0) > (previous.weight ?? 0)
  const repsUp = previous != null && (set.reps ?? 0) > (previous.reps ?? 0)
  return (
    <div
      style={{
        position: 'relative', borderRadius: 10, padding: '8px 4px 7px', textAlign: 'center',
        background: isBest ? `color-mix(in oklab, ${color.primary} 8%, transparent)` : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isBest ? `color-mix(in oklab, ${color.primary} 40%, transparent)` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {typeInfo && (
        <span
          style={{
            position: 'absolute', top: 3, right: 5, fontFamily: MONO, fontSize: 7.5, fontWeight: 700,
            letterSpacing: '0.06em', color: typeInfo.color,
          }}
        >
          {typeInfo.label}
        </span>
      )}
      <div style={{ fontFamily: MONO, fontSize: 14, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
        <span style={weightUp ? { color: 'var(--accent-l)' } : undefined}>{formatWeight(set.weight ?? 0)}</span>
        <span style={{ color: 'var(--text-m)', fontWeight: 400, margin: '0 2px' }}>×</span>
        <span style={repsUp ? { color: 'var(--accent-l)' } : undefined}>{set.reps}</span>
      </div>
      <div style={{ fontFamily: MONO, fontSize: 10, marginTop: 3, color: GHOST }}>
        {previous ? `${formatWeight(previous.weight ?? 0)}×${previous.reps}` : '—'}
      </div>
    </div>
  )
}

/** Best set (est. 1RM) over the last few times, this session last. */
function Sparkline({ values, color }: { values: number[]; color: MuscleColor }) {
  const W = 76, H = 24, pad = 4
  const lo = Math.min(...values)
  const span = Math.max(...values) - lo
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (values.length - 1)
  const y = (v: number) => (span === 0 ? H / 2 : H - pad - ((v - lo) / span) * (H - 2 * pad))
  const path = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const last = values.length - 1
  return (
    <svg
      width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', flex: 'none' }}
      role="img" aria-label={`Est. 1RM over the last ${values.length} times`}
    >
      <path d={path} fill="none" stroke={color.light} strokeWidth={1.6} strokeLinejoin="round" opacity={0.85} />
      {values.map((v, i) =>
        i === last ? (
          <circle key={i} cx={x(i)} cy={y(v)} r={3.2} fill={color.light} stroke="white" strokeWidth={1.2}
            style={{ filter: `drop-shadow(0 0 5px ${color.primary})` }} />
        ) : (
          <circle key={i} cx={x(i)} cy={y(v)} r={1.8} fill={color.light} opacity={0.7} />
        ),
      )}
    </svg>
  )
}

const chipText: React.CSSProperties = {
  display: 'inline-flex', alignItems: 'center', gap: 6,
  fontFamily: MONO, fontSize: 9.5, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase',
}

function Dot({ color, glow }: { color: string; glow?: boolean }) {
  return (
    <span
      style={{
        width: 7, height: 7, borderRadius: '50%', flex: 'none', background: color,
        boxShadow: glow ? `0 0 10px ${color}` : undefined,
      }}
    />
  )
}

function Stat({ label, value, delta, divider }: { label: string; value: string; delta: string | null; divider?: boolean }) {
  return (
    <div style={{ textAlign: 'center', borderLeft: divider ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
      <div style={{ fontFamily: MONO, fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: 'var(--text-1)' }}>
        {value}
      </div>
      <div style={{ marginTop: 4 }}>
        <Eyebrow inline>{label}</Eyebrow>
        {delta && (
          <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.06em', color: 'var(--text-2)', marginLeft: 5 }}>
            {delta}
          </span>
        )}
      </div>
    </div>
  )
}

function SectionHeader({ label, right }: { label: string; right?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '24px 0 10px' }}>
      <Eyebrow>{label}</Eyebrow>
      {right && (
        <span
          style={{
            display: 'flex', gap: 10, fontFamily: MONO, fontSize: 9, letterSpacing: '0.16em',
            fontWeight: 500, color: LABEL, textTransform: 'uppercase',
          }}
        >
          {right}
        </span>
      )}
    </div>
  )
}

function Eyebrow({ children, inline }: { children: React.ReactNode; inline?: boolean }) {
  return (
    <span
      style={{
        display: inline ? 'inline' : 'block',
        fontSize: inline ? 9 : 10, fontWeight: 600, letterSpacing: '0.18em',
        textTransform: 'uppercase', color: LABEL, fontFamily: MONO,
      }}
    >
      {children}
    </span>
  )
}

function Chrome({
  eyebrow, title, onBack, editTo,
}: {
  eyebrow: string
  title: string
  onBack: () => void
  editTo: string | null
}) {
  return (
    <div style={{ padding: '4px 0 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <button type="button" onClick={onBack} aria-label="Back" style={chromeButton}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div style={{ textAlign: 'center', minWidth: 0, padding: '0 8px' }}>
        <div style={{ fontSize: 9, color: LABEL, letterSpacing: '0.22em', fontFamily: MONO, fontWeight: 500 }}>
          {eyebrow}
        </div>
        <div
          className="p-display"
          style={{ fontSize: 18, color: 'var(--text-1)', marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
        >
          {title}
        </div>
      </div>
      {editTo ? (
        <Link to={editTo} aria-label="Edit sets" style={chromeButton}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </Link>
      ) : (
        <div style={{ width: 36 }} />
      )}
    </div>
  )
}

const chromeButton: React.CSSProperties = {
  width: 36, height: 36, borderRadius: 12, flex: 'none',
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.05)',
  color: 'var(--text-2)', display: 'grid', placeItems: 'center', cursor: 'pointer',
}
