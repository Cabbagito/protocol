import { useId, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import PageLoader from '../components/PageLoader'
import { useExercises, useMesocycles, useMesocycleDetails } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import { formatWeight } from '../lib/weightUtils'
import { isSessionDone, isSessionSkipped } from '../lib/mesoUtils'
import {
  bestSet,
  buildTrainingLog,
  sessionBestE1rm,
  sessionsInPeriod,
  sessionsPerWeek,
  type TrainedExercise,
} from '../lib/trainingLog'
import { useToday } from '../hooks/useToday'
import { useBack } from '../lib/navigation'
import type { Mesocycle } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'
const OTHER_LIFTS_PREVIEW = 6

type PeriodId = '4w' | '8w' | '12w' | 'all'
const PERIODS: { id: PeriodId; label: string; weeks: number | null }[] = [
  { id: '4w', label: '4 WEEKS', weeks: 4 },
  { id: '8w', label: '8 WEEKS', weeks: 8 },
  { id: '12w', label: '12 WEEKS', weeks: 12 },
  { id: 'all', label: 'ALL', weeks: null },
]

/** What the hero shows: an exercise, with its history if it was ever trained. */
interface Selected {
  id: string
  name: string
  muscleGroup: string
  trained: TrainedExercise | null
}

export default function Progress() {
  const back = useBack('/settings')
  const [searchParams, setSearchParams] = useSearchParams()
  const today = useToday()
  const { data: exercises = [], isLoading: exercisesLoading } = useExercises()
  const { data: mesoList = [], isLoading: listLoading } = useMesocycles()
  const mesoIds = useMemo(() => mesoList.map((m) => m.id), [mesoList])
  const { data: mesos, isLoading: detailsLoading } = useMesocycleDetails(mesoIds)

  const [period, setPeriod] = useState<PeriodId>('8w')
  const [showAllLifts, setShowAllLifts] = useState(false)

  const log = useMemo(() => buildTrainingLog(mesos), [mesos])

  // Trained lifts, most frequently trained first.
  const trained = useMemo(
    () =>
      [...log.values()].sort(
        (a, b) => b.sessions.length - a.sessions.length || b.lastDate.localeCompare(a.lastDate),
      ),
    [log],
  )

  const requestedId = searchParams.get('exercise')
  const selected = useMemo<Selected | null>(() => {
    const requested = requestedId ? exercises.find((e) => e.id === requestedId) : undefined
    if (requested) {
      return {
        id: requested.id,
        name: requested.name,
        muscleGroup: requested.muscle_group,
        trained: log.get(requested.id) ?? null,
      }
    }
    // Default: the most recently trained lift.
    const recent = trained.reduce<TrainedExercise | null>(
      (best, t) => (!best || t.lastDate > best.lastDate ? t : best),
      null,
    )
    if (!recent) return null
    const ex = exercises.find((e) => e.id === recent.exerciseId)
    return {
      id: recent.exerciseId,
      name: ex?.name ?? recent.name,
      muscleGroup: ex?.muscle_group ?? recent.muscleGroup,
      trained: recent,
    }
  }, [requestedId, exercises, log, trained])

  const activeMeso = mesos.find((m) => m.is_active) ?? null
  const periodWeeks = PERIODS.find((p) => p.id === period)?.weeks ?? null
  const subText = periodWeeks === null ? 'ALL TIME' : `LAST ${periodWeeks} WEEKS`

  function selectExercise(id: string) {
    setSearchParams({ exercise: id }, { replace: true })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  if (exercisesLoading || listLoading || detailsLoading) {
    return (
      <div>
        <PageLoader className="min-h-[60vh]" />
      </div>
    )
  }

  const otherLifts = trained.filter((t) => t.exerciseId !== selected?.id)
  const visibleOther = showAllLifts ? otherLifts : otherLifts.slice(0, OTHER_LIFTS_PREVIEW)

  return (
    <div
      style={{
        position: 'relative',
        overflowX: 'clip',
      }}
    >
      <div style={{ position: 'relative', zIndex: 1, padding: '12px 22px 0' }}>
        <Chrome title="Progress" sub={selected ? subText : 'NO DATA YET'} onBack={back} />

        {!selected ? (
          <EmptyState />
        ) : (
          <>
            <SelectedHero selected={selected} periodWeeks={periodWeeks} today={today} />

            {/* Period toggle */}
            <div
              role="group"
              aria-label="Period"
              style={{
                marginTop: 18,
                display: 'flex',
                gap: 4,
                padding: 4,
                borderRadius: 12,
                background: 'rgba(15,29,46,0.5)',
                border: '1px solid rgba(255,255,255,0.05)',
              }}
            >
              {PERIODS.map((p) => {
                const isActive = period === p.id
                return (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => setPeriod(p.id)}
                    style={{
                      flex: 1,
                      height: 32,
                      borderRadius: 8,
                      background: isActive ? 'rgba(var(--accent-rgb),0.18)' : 'transparent',
                      border: isActive
                        ? '1px solid rgba(var(--accent-rgb),0.35)'
                        : '1px solid transparent',
                      color: isActive ? 'var(--accent-l)' : 'var(--text-m)',
                      cursor: 'pointer',
                      fontSize: 10,
                      fontFamily: MONO,
                      fontWeight: 600,
                      letterSpacing: '0.15em',
                    }}
                  >
                    {p.label}
                  </button>
                )
              })}
            </div>

            {activeMeso && <WeeklyVolume meso={activeMeso} />}

            {otherLifts.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                  <Eyebrow>{selected.trained ? 'Other lifts' : 'Your lifts'}</Eyebrow>
                  <span
                    style={{
                      fontSize: 9,
                      color: 'var(--text-m)',
                      letterSpacing: '0.18em',
                      fontFamily: MONO,
                      fontWeight: 600,
                    }}
                  >
                    BY FREQUENCY
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
                  {visibleOther.map((t) => (
                    <OtherRow
                      key={t.exerciseId}
                      lift={t}
                      name={exercises.find((e) => e.id === t.exerciseId)?.name ?? t.name}
                      periodWeeks={periodWeeks}
                      today={today}
                      onClick={() => selectExercise(t.exerciseId)}
                    />
                  ))}
                </div>
                {otherLifts.length > OTHER_LIFTS_PREVIEW && (
                  <button
                    type="button"
                    onClick={() => setShowAllLifts((v) => !v)}
                    style={{
                      width: '100%',
                      marginTop: 8,
                      padding: '10px 12px',
                      borderRadius: 12,
                      background: 'transparent',
                      border: '1px dashed rgba(255,255,255,0.08)',
                      color: 'var(--text-2)',
                      fontSize: 12,
                      cursor: 'pointer',
                    }}
                  >
                    {showAllLifts ? 'Show fewer' : `Show all ${otherLifts.length}`}
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Empty state ──────────────────────────────────────────────── */

function EmptyState() {
  return (
    <div
      style={{
        marginTop: 24,
        padding: '40px 22px',
        borderRadius: 18,
        textAlign: 'center',
        background: 'rgba(15,29,46,0.4)',
        border: '1px dashed rgba(255,255,255,0.08)',
      }}
    >
      <div className="p-display" style={{ fontSize: 22, color: 'var(--text-1)' }}>
        Nothing to chart yet
      </div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 8, lineHeight: 1.5 }}>
        Log a workout to see progress — estimated 1RM, best sets and training frequency for every lift
        you train.
      </div>
      <Link
        to="/workout"
        style={{
          display: 'inline-block',
          marginTop: 18,
          padding: '10px 20px',
          borderRadius: 12,
          background: 'var(--p-grad-cta)',
          color: 'var(--btn-text)',
          fontFamily: MONO,
          fontWeight: 500,
          fontSize: 13,
          textDecoration: 'none',
        }}
      >
        Go to workout
      </Link>
    </div>
  )
}

/* ─── Selected hero card ───────────────────────────────────────── */

function SelectedHero({
  selected,
  periodWeeks,
  today,
}: {
  selected: Selected
  periodWeeks: number | null
  today: string
}) {
  const color = getMuscleColor(selected.muscleGroup)
  const all = selected.trained?.sessions ?? []
  const sessions = sessionsInPeriod(all, periodWeeks, today)
  const series = sessions.map(sessionBestE1rm).filter((n) => n > 0)

  const best = bestSet(sessions)
  const firstE1rm = series[0]
  const lastE1rm = series[series.length - 1]
  const trendPct =
    series.length >= 2 && firstE1rm && lastE1rm
      ? Math.round(((lastE1rm - firstE1rm) / firstE1rm) * 100)
      : null
  const perWeek = sessionsPerWeek(all, sessions, periodWeeks, today)
  const firstDate = sessions[0]?.date
  const lastDate = sessions[sessions.length - 1]?.date

  const emptyMessage = !selected.trained
    ? 'No sets logged for this lift yet'
    : sessions.length === 0
      ? 'Not trained in this period'
      : 'Not enough data yet'

  return (
    <>
      <div
        style={{
          padding: 20,
          borderRadius: 20,
          position: 'relative',
          overflow: 'hidden',
          background: `linear-gradient(180deg, color-mix(in oklab, ${color.primary} 12%, rgba(15,29,46,0.6)), rgba(15,29,46,0.6))`,
          border: `1px solid color-mix(in oklab, ${color.primary} 28%, rgba(255,255,255,0.05))`,
        }}
      >
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, color-mix(in oklab, ${color.primary} 22%, transparent), transparent 70%)`,
          }}
        />
        <div
          style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'baseline',
            justifyContent: 'space-between',
            gap: 12,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: color.primary,
                  boxShadow: `0 0 10px ${color.primary}`,
                }}
              />
              <span
                style={{
                  fontSize: 9,
                  color: color.light,
                  letterSpacing: '0.22em',
                  fontFamily: MONO,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {selected.muscleGroup}
              </span>
            </div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: 'var(--text-1)',
                marginTop: 4,
                letterSpacing: '-0.015em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {selected.name}
            </div>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-m)',
                letterSpacing: '0.2em',
                fontFamily: MONO,
                fontWeight: 600,
              }}
            >
              EST 1RM
            </div>
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: 'var(--text-1)',
                lineHeight: 1,
                marginTop: 2,
                letterSpacing: '-0.02em',
                fontFamily: MONO,
              }}
            >
              {best && best.e1rm > 0 ? (
                <>
                  {Math.round(best.e1rm)}
                  <span style={{ fontSize: 11, color: 'var(--text-m)', fontWeight: 500 }}>kg</span>
                </>
              ) : (
                '—'
              )}
            </div>
          </div>
        </div>

        <div style={{ position: 'relative', marginTop: 14 }}>
          {series.length >= 2 ? (
            <Sparkline pts={series} color={color.primary} colorLight={color.light} height={82} />
          ) : (
            <div
              style={{
                height: 82,
                display: 'grid',
                placeItems: 'center',
                color: 'var(--text-m)',
                fontSize: 12,
              }}
            >
              {emptyMessage}
            </div>
          )}
        </div>

        <div
          style={{
            position: 'relative',
            display: 'flex',
            justifyContent: 'space-between',
            marginTop: 6,
          }}
        >
          <span style={{ fontSize: 9, color: 'var(--text-m)', letterSpacing: '0.18em', fontFamily: MONO, fontWeight: 600 }}>
            {firstDate ? formatShortDate(firstDate) : '—'}
          </span>
          <span style={{ fontSize: 9, color: 'var(--text-m)', letterSpacing: '0.18em', fontFamily: MONO, fontWeight: 600 }}>
            {lastDate === today ? 'TODAY' : lastDate ? formatShortDate(lastDate) : '—'}
          </span>
        </div>
      </div>

      {/* Stats trio */}
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatCard
          label="BEST SET"
          value={best ? `${formatWeight(best.weight)}×${best.reps}` : '—'}
          sub={best && best.e1rm > 0 ? `≈${Math.round(best.e1rm)}KG 1RM` : ''}
          subColor={color.light}
        />
        <StatCard
          label="TREND"
          value={trendPct === null ? '—' : trendPct >= 0 ? `+${trendPct}%` : `${trendPct}%`}
          sub={trendPct === null ? '' : 'EST 1RM'}
          subColor={color.light}
        />
        <StatCard
          label="FREQUENCY"
          value={sessions.length > 0 ? `${perWeek.toFixed(1)}/wk` : '—'}
          sub={`${sessions.length} ${sessions.length === 1 ? 'SESSION' : 'SESSIONS'}`}
          subColor={color.light}
        />
      </div>
    </>
  )
}

function StatCard({
  label,
  value,
  sub,
  subColor,
}: {
  label: string
  value: string
  sub: string
  subColor: string
}) {
  return (
    <div
      style={{
        padding: '12px 12px',
        borderRadius: 13,
        background: 'rgba(15,29,46,0.45)',
        border: '1px solid rgba(255,255,255,0.05)',
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 8,
          color: 'var(--text-m)',
          letterSpacing: '0.18em',
          fontFamily: MONO,
          fontWeight: 600,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--text-1)',
          marginTop: 4,
          letterSpacing: '-0.01em',
          fontFamily: MONO,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          color: subColor,
          marginTop: 2,
          minHeight: 11,
          letterSpacing: '0.12em',
          fontFamily: MONO,
          fontWeight: 600,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {sub}
      </div>
    </div>
  )
}

/* ─── Sparkline ────────────────────────────────────────────────── */

function Sparkline({
  pts,
  color,
  colorLight,
  height = 70,
}: {
  pts: number[]
  color: string
  colorLight: string
  height?: number
}) {
  const id = useId().replace(/:/g, '')
  const w = 312
  const h = height
  const max = Math.max(...pts)
  const min = Math.min(...pts)
  const range = max - min || 1
  const stepX = w / (pts.length - 1)
  const ys = pts.map((v) => h - ((v - min) / range) * (h - 10) - 5)
  const xs = pts.map((_, i) => i * stepX)
  const d = pts.map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i]!.toFixed(1)},${ys[i]!.toFixed(1)}`).join(' ')
  const dFill =
    `M${xs[0]!.toFixed(1)},${h} L${xs[0]!.toFixed(1)},${ys[0]!.toFixed(1)} ` +
    xs.slice(1).map((x, i) => `L${x.toFixed(1)},${ys[i + 1]!.toFixed(1)}`).join(' ') +
    ` L${xs[xs.length - 1]!.toFixed(1)},${h} Z`
  const lastX = xs[xs.length - 1]!
  const lastY = ys[ys.length - 1]!

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }} aria-hidden="true">
      <defs>
        <linearGradient id={`sp-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={dFill} fill={`url(#sp-${id})`} />
      <path
        d={d}
        fill="none"
        stroke={colorLight}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      <circle
        cx={lastX}
        cy={lastY}
        r={3.5}
        fill={colorLight}
        stroke="white"
        strokeWidth={1.5}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  )
}

/* ─── Weekly volume (active mesocycle) ─────────────────────────── */

interface WeekVolume {
  week: number
  volume: number
  /** All sessions done/skipped, or the user has already trained a later week. */
  complete: boolean
}

function weeklyVolumes(meso: Mesocycle): WeekVolume[] {
  const weeks = meso.structure.weeks
  const hasLogged = (wi: number) =>
    weeks[wi]!.sessions.some((s) => s.exercises.some((e) => e.sets.some((st) => st.logged)))
  let lastTrained = -1
  for (let wi = 0; wi < weeks.length; wi++) if (hasLogged(wi)) lastTrained = wi

  return weeks.slice(0, lastTrained + 1).map((w, wi) => {
    let volume = 0
    for (const s of w.sessions) {
      for (const ex of s.exercises) {
        if (ex.skipped) continue
        for (const st of ex.sets) {
          if (st.logged && !st.skipped) volume += (st.weight ?? 0) * (st.reps ?? 0)
        }
      }
    }
    const finished = w.sessions.every((s) => isSessionSkipped(s) || isSessionDone(s))
    return { week: w.week_number, volume, complete: finished || wi < lastTrained }
  })
}

function WeeklyVolume({ meso }: { meso: Mesocycle }) {
  const weekly = useMemo(() => weeklyVolumes(meso), [meso])
  if (weekly.length === 0 || weekly.every((w) => w.volume === 0)) return null

  // Trend over complete weeks only — a half-done current week would read as a drop.
  const complete = weekly.filter((w) => w.complete && w.volume > 0)
  const first = complete[0]
  const last = complete[complete.length - 1]
  const trend =
    complete.length >= 2 && first && last
      ? Math.round(((last.volume - first.volume) / first.volume) * 100)
      : null
  const lastCompleteWeek = last?.week
  const maxV = Math.max(...weekly.map((w) => w.volume))

  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 12,
        }}
      >
        <Eyebrow>Weekly volume</Eyebrow>
        <span
          style={{
            fontSize: 9,
            color: 'var(--accent-l)',
            letterSpacing: '0.18em',
            fontFamily: MONO,
            fontWeight: 600,
          }}
        >
          {trend !== null
            ? `${trend >= 0 ? '+' : ''}${trend}% · W${first!.week}→W${last!.week}`
            : complete.length === 0
              ? 'WEEK IN PROGRESS'
              : '1 FULL WEEK'}
        </span>
      </div>
      <div
        style={{
          padding: '18px 14px 12px',
          borderRadius: 14,
          background: 'rgba(15,29,46,0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${weekly.length}, 1fr)`,
            gap: 6,
            alignItems: 'end',
            height: 96,
          }}
        >
          {weekly.map((d) => {
            const h = maxV > 0 ? (d.volume / maxV) * 92 : 0
            const highlight = d.week === lastCompleteWeek
            return (
              <div
                key={d.week}
                title={d.complete ? undefined : 'In progress'}
                style={{
                  width: '100%',
                  height: Math.max(h, d.volume > 0 ? 2 : 0),
                  borderRadius: '3px 3px 0 0',
                  background: highlight
                    ? 'linear-gradient(180deg, var(--accent-l), var(--accent))'
                    : 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 30%, rgba(255,255,255,0.08)), rgba(255,255,255,0.03))',
                  boxShadow: highlight ? '0 0 10px rgba(var(--accent-rgb),0.5)' : 'none',
                  opacity: d.complete ? 1 : 0.45,
                }}
              />
            )
          })}
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${weekly.length}, 1fr)`,
            gap: 6,
            marginTop: 8,
          }}
        >
          {weekly.map((d) => (
            <div
              key={d.week}
              style={{
                fontSize: 8,
                color: 'var(--text-m)',
                textAlign: 'center',
                letterSpacing: '0.1em',
                fontFamily: MONO,
                fontWeight: 600,
              }}
            >
              W{d.week}
              {d.complete ? '' : '…'}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Other lifts ──────────────────────────────────────────────── */

function OtherRow({
  lift,
  name,
  periodWeeks,
  today,
  onClick,
}: {
  lift: TrainedExercise
  name: string
  periodWeeks: number | null
  today: string
  onClick: () => void
}) {
  const color = getMuscleColor(lift.muscleGroup)
  const series = sessionsInPeriod(lift.sessions, periodWeeks, today)
    .map(sessionBestE1rm)
    .filter((n) => n > 0)
  const first = series[0]
  const last = series[series.length - 1]
  const delta = series.length >= 2 && first && last ? Math.round(((last - first) / first) * 100) : null

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '12px 14px',
        borderRadius: 13,
        display: 'grid',
        gridTemplateColumns: '1fr 110px 56px',
        gap: 12,
        alignItems: 'center',
        background: 'rgba(15,29,46,0.45)',
        border: '1px solid rgba(255,255,255,0.05)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'inherit',
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <span
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: color.primary,
              boxShadow: `0 0 6px ${color.primary}`,
            }}
          />
          <span
            style={{
              fontSize: 8,
              color: color.light,
              letterSpacing: '0.18em',
              fontFamily: MONO,
              fontWeight: 600,
              textTransform: 'uppercase',
            }}
          >
            {lift.muscleGroup} · {lift.sessions.length}×
          </span>
        </div>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-1)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {name}
        </div>
      </div>
      <div style={{ width: 110, height: 28 }}>
        {series.length >= 2 && <MiniSparkline pts={series} color={color.primary} colorLight={color.light} />}
      </div>
      <div
        style={{
          fontSize: 11,
          color: color.light,
          textAlign: 'right',
          fontWeight: 600,
          letterSpacing: '0.05em',
          fontFamily: MONO,
        }}
      >
        {delta === null ? '—' : delta >= 0 ? `+${delta}%` : `${delta}%`}
      </div>
    </button>
  )
}

function MiniSparkline({
  pts,
  color,
  colorLight,
}: {
  pts: number[]
  color: string
  colorLight: string
}) {
  const min = Math.min(...pts)
  const max = Math.max(...pts)
  const r = max - min || 1
  const d = pts
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * 110 / (pts.length - 1)).toFixed(1)},${(24 - ((v - min) / r) * 22).toFixed(1)}`)
    .join(' ')
  return (
    <svg width="100%" height="100%" viewBox="0 0 110 28" preserveAspectRatio="none" aria-hidden="true">
      <path
        d={d}
        fill="none"
        stroke={colorLight}
        strokeWidth="1.5"
        strokeLinecap="round"
        style={{ filter: `drop-shadow(0 0 4px ${color})` }}
      />
    </svg>
  )
}

/* ─── Helpers ──────────────────────────────────────────────────── */

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

/* ─── Chrome ───────────────────────────────────────────────────── */

function Chrome({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div
      style={{
        padding: '4px 0 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.05)',
          color: 'var(--text-2)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-m)',
            letterSpacing: '0.22em',
            fontFamily: MONO,
            fontWeight: 500,
          }}
        >
          {sub}
        </div>
        <div
          className="p-display"
          style={{ fontSize: 18, color: 'var(--text-1)', marginTop: 1 }}
        >
          {title}
        </div>
      </div>
      <div style={{ width: 36 }} />
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--text-m)',
        fontFamily: MONO,
      }}
    >
      {children}
    </div>
  )
}
