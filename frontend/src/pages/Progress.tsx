import { useId, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import PageLoader from '../components/PageLoader'
import {
  useExercises,
  useActiveMesocycle,
  useWorkoutHistory,
  useExerciseProgress,
} from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import type { Exercise, ProgressEntry } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

type PeriodId = '4w' | '8w' | '12w' | 'all'
const PERIODS: { id: PeriodId; label: string; weeks: number | null }[] = [
  { id: '4w', label: '4 WEEKS', weeks: 4 },
  { id: '8w', label: '8 WEEKS', weeks: 8 },
  { id: '12w', label: '12 WEEKS', weeks: 12 },
  { id: 'all', label: 'ALL', weeks: null },
]

export default function Progress() {
  const navigate = useNavigate()
  const { data: exercises = [], isLoading } = useExercises()
  const { data: meso } = useActiveMesocycle()
  const { data: history = [] } = useWorkoutHistory(meso?.id ?? '')

  const [period, setPeriod] = useState<PeriodId>('8w')
  const [selectedId, setSelectedId] = useState<string>('')

  const selected = useMemo(() => {
    if (selectedId) return exercises.find((e) => e.id === selectedId) ?? null
    return exercises[0] ?? null
  }, [exercises, selectedId])

  const subText = period === 'all' ? 'ALL TIME' : `LAST ${PERIODS.find((p) => p.id === period)?.weeks} WEEKS`

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--deep)' }}>
        <PageLoader className="min-h-[60vh]" />
      </div>
    )
  }

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--deep)',
        overflow: 'hidden',
      }}
    >
      <AuroraBackground />

      <div style={{ position: 'relative', zIndex: 1, padding: '12px 22px 130px' }}>
        <Chrome title="Progress" sub={subText} onBack={() => navigate(-1)} />

        {selected ? (
          <SelectedHero exercise={selected} period={period} />
        ) : (
          <div
            style={{
              padding: '40px 22px',
              textAlign: 'center',
              color: 'var(--text-m)',
              fontSize: 13,
            }}
          >
            No exercises yet.
          </div>
        )}

        {/* Period toggle */}
        <div
          style={{
            marginTop: 18,
            display: 'flex',
            gap: 4,
            padding: 4,
            borderRadius: 12,
            background: 'rgba(15,29,46,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {PERIODS.map((p) => {
            const isActive = period === p.id
            return (
              <button
                key={p.id}
                type="button"
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

        {/* Weekly volume */}
        {meso && history.length > 0 && (
          <WeeklyVolume history={history} />
        )}

        {/* Other lifts */}
        {selected && exercises.length > 1 && (
          <OtherLifts
            exercises={exercises.filter((e) => e.id !== selected.id).slice(0, 4)}
            period={period}
            onSelect={setSelectedId}
          />
        )}
      </div>
    </div>
  )
}

/* ─── Selected hero card ───────────────────────────────────────── */

function SelectedHero({ exercise, period }: { exercise: Exercise; period: PeriodId }) {
  const { data: entries = [] } = useExerciseProgress(exercise.id)
  const color = getMuscleColor(exercise.muscle_group)
  const periodWeeks = PERIODS.find((p) => p.id === period)?.weeks ?? null
  const sliced = sliceByPeriod(entries, periodWeeks)
  const series = sliced.map((e) => e.best_e1rm).filter((n) => n > 0)

  const latest = sliced.length > 0 ? sliced[sliced.length - 1] : undefined
  const first = sliced[0]
  const best1RM = sliced.length > 0 ? Math.max(...sliced.map((e) => e.best_e1rm)) : 0
  const bestEntry = sliced.find((e) => e.best_e1rm === best1RM) ?? null
  const trendPct =
    first && latest && first.best_e1rm > 0
      ? Math.round(((latest.best_e1rm - first.best_e1rm) / first.best_e1rm) * 100)
      : 0
  const consistencyPct = computeConsistency(sliced, periodWeeks)
  const firstDate = first?.date
  const lastDate = latest?.date

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
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
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
                {exercise.muscle_group}
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
              {exercise.name}
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
              {best1RM > 0 ? Math.round(best1RM) : '—'}
              <span style={{ fontSize: 11, color: 'var(--text-m)', fontWeight: 500 }}>kg</span>
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
              Not enough data yet
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
            {lastDate && isToday(lastDate) ? 'NOW' : lastDate ? formatShortDate(lastDate) : '—'}
          </span>
        </div>
      </div>

      {/* Stats trio */}
      <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
        <StatCard
          label="BEST SET"
          value={bestEntry ? `${Math.round(bestEntry.max_weight)}×${Math.round(bestEntry.total_reps / Math.max(1, bestEntry.total_sets))}` : '—'}
          sub={bestEntry ? `${Math.round(bestEntry.best_e1rm)}kg 1RM` : ''}
          subColor={color.light}
        />
        <StatCard
          label="TREND"
          value={trendPct >= 0 ? `+${trendPct}%` : `${trendPct}%`}
          sub={period === 'all' ? 'ALL TIME' : `${PERIODS.find((p) => p.id === period)?.weeks} WK`}
          subColor={color.light}
        />
        <StatCard
          label="CONSISTENCY"
          value={`${consistencyPct}%`}
          sub={`${sliced.length} SESS`}
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
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
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
        }}
      >
        {value}
      </div>
      <div
        style={{
          fontSize: 9,
          color: subColor,
          marginTop: 2,
          letterSpacing: '0.15em',
          fontFamily: MONO,
          fontWeight: 600,
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
  fill = true,
}: {
  pts: number[]
  color: string
  colorLight: string
  height?: number
  fill?: boolean
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

  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={`sp-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.35" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      {fill && <path d={dFill} fill={`url(#sp-${id})`} />}
      <path
        d={d}
        fill="none"
        stroke={colorLight}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
      {pts.map((_, i) => {
        const isLast = i === pts.length - 1
        return (
          <circle
            key={i}
            cx={xs[i]!}
            cy={ys[i]!}
            r={isLast ? 3.5 : 0}
            fill={colorLight}
            stroke={isLast ? 'white' : 'none'}
            strokeWidth={isLast ? 1.5 : 0}
            style={isLast ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined}
          />
        )
      })}
    </svg>
  )
}

/* ─── Weekly volume ────────────────────────────────────────────── */

function WeeklyVolume({
  history,
}: {
  history: { week_number: number; total_volume: number }[]
}) {
  const weekly = useMemo(() => {
    const map = new Map<number, number>()
    for (const h of history) {
      map.set(h.week_number, (map.get(h.week_number) ?? 0) + h.total_volume)
    }
    return [...map.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([week, v]) => ({ week, v }))
  }, [history])

  if (weekly.length === 0) return null

  const maxV = Math.max(...weekly.map((w) => w.v))
  const first = weekly[0]?.v ?? 0
  const last = weekly.length > 0 ? weekly[weekly.length - 1]!.v : 0
  const trend = first > 0 ? Math.round(((last - first) / first) * 100) : 0

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
          {trend >= 0 ? `+${trend}%` : `${trend}%`} · {weekly.length}WK
        </span>
      </div>
      <div
        style={{
          padding: '18px 14px 12px',
          borderRadius: 14,
          background: 'rgba(15,29,46,0.4)',
          border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
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
          {weekly.map((d, i) => {
            const h = maxV > 0 ? (d.v / maxV) * 92 : 0
            const isLast = i === weekly.length - 1
            return (
              <div
                key={d.week}
                style={{
                  width: '100%',
                  height: h,
                  borderRadius: '3px 3px 0 0',
                  background: isLast
                    ? 'linear-gradient(180deg, var(--accent-l), var(--accent))'
                    : 'linear-gradient(180deg, color-mix(in oklab, var(--accent) 30%, rgba(255,255,255,0.08)), rgba(255,255,255,0.03))',
                  boxShadow: isLast ? '0 0 10px rgba(var(--accent-rgb),0.5)' : 'none',
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
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ─── Other lifts ──────────────────────────────────────────────── */

function OtherLifts({
  exercises,
  period,
  onSelect,
}: {
  exercises: Exercise[]
  period: PeriodId
  onSelect: (id: string) => void
}) {
  return (
    <div style={{ marginTop: 22 }}>
      <Eyebrow>Other lifts</Eyebrow>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 10 }}>
        {exercises.map((ex) => (
          <OtherRow key={ex.id} exercise={ex} period={period} onClick={() => onSelect(ex.id)} />
        ))}
      </div>
    </div>
  )
}

function OtherRow({
  exercise,
  period,
  onClick,
}: {
  exercise: Exercise
  period: PeriodId
  onClick: () => void
}) {
  const { data: entries = [] } = useExerciseProgress(exercise.id)
  const color = getMuscleColor(exercise.muscle_group)
  const periodWeeks = PERIODS.find((p) => p.id === period)?.weeks ?? null
  const sliced = sliceByPeriod(entries, periodWeeks)
  const series = sliced.map((e) => e.best_e1rm).filter((n) => n > 0)
  const first = series[0]
  const last = series.length > 0 ? series[series.length - 1] : undefined
  const delta =
    first && last && first > 0 ? Math.round(((last - first) / first) * 100) : 0

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
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
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
            {exercise.muscle_group}
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
          {exercise.name}
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
        {series.length >= 2 ? (delta >= 0 ? `+${delta}%` : `${delta}%`) : '—'}
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
    <svg width="100%" height="100%" viewBox="0 0 110 28" preserveAspectRatio="none">
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

function sliceByPeriod(entries: ProgressEntry[], weeks: number | null): ProgressEntry[] {
  if (!weeks) return entries
  if (entries.length === 0) return entries
  const sorted = [...entries].sort((a, b) => a.date.localeCompare(b.date))
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - weeks * 7)
  const iso = cutoff.toISOString().slice(0, 10)
  return sorted.filter((e) => e.date >= iso)
}

function computeConsistency(entries: ProgressEntry[], weeks: number | null): number {
  if (entries.length === 0) return 0
  const weekSet = new Set(entries.map((e) => e.week_number))
  const expected = weeks ?? Math.max(weekSet.size, 1)
  return Math.min(100, Math.round((weekSet.size / expected) * 100))
}

function formatShortDate(iso: string): string {
  const d = new Date(iso + 'T00:00:00')
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
}

function isToday(iso: string): boolean {
  const today = new Date().toISOString().slice(0, 10)
  return iso === today
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
          backdropFilter: 'blur(20px)',
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
