import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useActiveMesocycle } from '../api/hooks'
import { getCurrentPosition } from '../lib/mesoUtils'
import { GearIcon } from '../components/Icons'
import PageLoader from '../components/PageLoader'
import ProtocolMark from '../components/ProtocolMark'
import AuroraBackground from '../components/AuroraBackground'

function ArrowIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

const DAY_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']
const ORDINAL_WORDS = [
  'one', 'two', 'three', 'four', 'five', 'six', 'seven',
  'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
] as const

/** Monday-start day-of-week index (0..6) for a given Date. */
function mondayIndex(d: Date): number {
  // JS getDay: 0=Sun..6=Sat → shift so Monday is 0.
  return (d.getDay() + 6) % 7
}

/** Local YYYY-MM-DD (no tz drift from toISOString). */
function localDateKey(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export default function Dashboard() {
  const { data: mesocycle, isLoading } = useActiveMesocycle()

  const currentPos = useMemo(
    () => (mesocycle ? getCurrentPosition(mesocycle.structure) : null),
    [mesocycle],
  )

  const trainedKeys = useMemo(() => {
    const out = new Set<string>()
    if (!mesocycle) return out
    for (const w of mesocycle.structure.weeks) {
      for (const s of w.sessions) {
        if (!s.date) continue
        const nonSkipped = s.exercises.filter(e => !e.skipped)
        const allLogged =
          nonSkipped.length > 0 &&
          nonSkipped.every(e => e.sets.every(st => st.logged))
        if (allLogged) out.add(s.date)
      }
    }
    return out
  }, [mesocycle])

  if (isLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  // ── Compose this Monday→Sunday strip from the user's local week.
  const today = new Date()
  const todayMon = mondayIndex(today)
  const weekStart = new Date(today)
  weekStart.setDate(today.getDate() - todayMon)
  const weekCells = DAY_LETTERS.map((letter, i) => {
    const d = new Date(weekStart)
    d.setDate(weekStart.getDate() + i)
    const key = localDateKey(d)
    return {
      letter,
      key,
      trained: trainedKeys.has(key),
      isToday: i === todayMon,
      isPast: i < todayMon,
    }
  })

  const dateLabel = today
    .toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    .toUpperCase()
    .replace(',', ' ·')

  // ── Active session details (when a mesocycle exists)
  const wi = currentPos?.weekIndex ?? 0
  const si = currentPos?.sessionIndex ?? 0
  const week = mesocycle?.structure.weeks[wi]
  const session = week?.sessions[si]
  const sessionExercises = (session?.exercises ?? []).filter(e => !e.skipped)
  const uniqueGroups = Array.from(
    new Set(sessionExercises.map(e => e.muscle_group)),
  )
  const heroGroups = uniqueGroups.slice(0, 3)

  const dayTitle = session?.session_name ?? 'Workout'
  const dayOrdinal = ORDINAL_WORDS[si] ?? String(si + 1)

  // Continue CTA destination
  const continueHref = mesocycle && currentPos
    ? `/workout/${mesocycle.id}?week=${wi}&session=${si}`
    : null

  // Meso hairline
  const totalWorkouts = mesocycle
    ? mesocycle.structure.weeks.reduce(
        (n, w) =>
          n + w.sessions.filter(s => s.exercises.some(e => !e.skipped)).length,
        0,
      )
    : 0
  const progressPct =
    mesocycle && totalWorkouts > 0
      ? Math.round((mesocycle.workouts_completed / totalWorkouts) * 100)
      : 0

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100dvh',
        background: 'var(--deep)',
        overflow: 'hidden',
      }}
    >
      <AuroraBackground />

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '12px 22px calc(env(safe-area-inset-bottom) + 130px)',
          minHeight: '100dvh',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Top bar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ position: 'relative' }}>
            <div
              aria-hidden="true"
              style={{
                position: 'absolute',
                inset: '-40%',
                background: 'radial-gradient(circle, rgba(var(--accent-rgb),0.35), transparent 65%)',
                filter: 'blur(14px)',
                pointerEvents: 'none',
              }}
            />
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: 12,
                background: 'var(--logo-bg)',
                border: '1px solid var(--border)',
                position: 'relative',
                overflow: 'hidden',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <ProtocolMark className="w-9 h-9" />
            </div>
          </div>
          <Link
            to="/settings"
            aria-label="Settings"
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              color: 'var(--text-2)',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <GearIcon className="w-4 h-4" />
          </Link>
        </div>

        {/* Date + week strip */}
        <div style={{ marginTop: 28, textAlign: 'center' }}>
          <div
            style={{
              fontSize: 11,
              color: 'var(--text-2)',
              letterSpacing: '0.22em',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontWeight: 500,
            }}
          >
            {dateLabel}
          </div>
          <div style={{ marginTop: 14, display: 'flex', gap: 6, justifyContent: 'center' }}>
            {weekCells.map((cell, i) => {
              const { letter, trained, isToday, isPast } = cell
              const bg = isToday
                ? 'var(--p-grad)'
                : trained
                ? 'rgba(var(--accent-rgb),0.18)'
                : 'rgba(255,255,255,0.04)'
              const border = isToday
                ? 'none'
                : trained
                ? '1px solid rgba(var(--accent-rgb),0.35)'
                : `1px ${isPast ? 'solid' : 'dashed'} rgba(255,255,255,0.08)`
              const color = isToday
                ? 'var(--btn-text)'
                : trained
                ? 'var(--accent-l)'
                : 'var(--text-2)'
              return (
                <div
                  key={i}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: bg,
                    border,
                    display: 'grid',
                    placeItems: 'center',
                    fontSize: 11,
                    fontWeight: 600,
                    color,
                    fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    boxShadow: isToday
                      ? '0 0 18px rgba(var(--accent-rgb),0.55)'
                      : 'none',
                  }}
                >
                  {letter}
                </div>
              )
            })}
          </div>
        </div>

        {/* Hero — vertically centered */}
        <div
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px 0',
            minHeight: 180,
          }}
        >
          {mesocycle && heroGroups.length > 0 && (
            <div style={{ display: 'flex', gap: 16, marginBottom: 22 }}>
              {heroGroups.map((g, i) => (
                <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                  <span
                    style={{
                      width: 10,
                      height: 10,
                      borderRadius: '50%',
                      background: `var(--m-${g.replace(/\s+/g, '-')}, var(--accent))`,
                      boxShadow: `0 0 22px var(--m-${g.replace(/\s+/g, '-')}, var(--accent)), 0 0 8px var(--m-${g.replace(/\s+/g, '-')}, var(--accent)), 0 0 2px white`,
                      animation: `p-pulse-dot 2.6s ease-in-out infinite ${i * 0.4}s`,
                    }}
                  />
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.18em',
                      color: `var(--m-${g.replace(/\s+/g, '-')}-l, var(--text-2))`,
                      textTransform: 'uppercase',
                      fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                    }}
                  >
                    {g}
                  </span>
                </div>
              ))}
            </div>
          )}

          {mesocycle ? (
            <>
              <div
                className="p-grad-text"
                style={{
                  fontSize: 130,
                  fontWeight: 700,
                  letterSpacing: '-0.06em',
                  lineHeight: 1.05,
                  paddingBottom: '0.08em',
                  textAlign: 'center',
                  filter: 'drop-shadow(0 0 40px rgba(var(--accent-rgb),0.35))',
                }}
              >
                {dayTitle}
              </div>
              <div
                style={{
                  fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
                  fontStyle: 'italic',
                  fontSize: 17,
                  color: 'var(--text-2)',
                  marginTop: 12,
                  letterSpacing: '0.01em',
                }}
              >
                day {dayOrdinal}
              </div>
            </>
          ) : (
            <>
              <div
                className="p-grad-text"
                style={{
                  fontSize: 90,
                  fontWeight: 700,
                  letterSpacing: '-0.05em',
                  lineHeight: 0.9,
                  textAlign: 'center',
                  filter: 'drop-shadow(0 0 40px rgba(var(--accent-rgb),0.35))',
                }}
              >
                Begin.
              </div>
              <div
                style={{
                  fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
                  fontStyle: 'italic',
                  fontSize: 17,
                  color: 'var(--text-2)',
                  marginTop: 12,
                }}
              >
                no active mesocycle
              </div>
            </>
          )}
        </div>

        {/* Meso hairline */}
        {mesocycle && (
          <Link
            to={`/mesocycles/${mesocycle.id}`}
            style={{ display: 'block', marginBottom: 14, textDecoration: 'none' }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 8,
              }}
            >
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: 'var(--text-m)',
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontWeight: 500,
                  textTransform: 'uppercase',
                }}
              >
                {mesocycle.name}
              </span>
              <span
                style={{
                  fontSize: 10,
                  letterSpacing: '0.18em',
                  color: 'var(--text-2)',
                  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
                  fontWeight: 500,
                }}
              >
                WK {mesocycle.current_week} / {mesocycle.total_weeks} · {progressPct}%
              </span>
            </div>
            <div
              style={{
                height: 2,
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 1,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${progressPct}%`,
                  height: '100%',
                  background: 'var(--p-grad)',
                  boxShadow: '0 0 8px rgba(var(--accent-rgb),0.6)',
                }}
              />
            </div>
          </Link>
        )}

        {/* CTA */}
        {continueHref ? (
          <Link
            to={continueHref}
            style={{
              position: 'relative',
              width: '100%',
              height: 58,
              borderRadius: 16,
              background: 'var(--p-grad)',
              color: 'var(--btn-text)',
              fontWeight: 700,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 14px 40px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
              textDecoration: 'none',
              overflow: 'hidden',
            }}
          >
            <span
              aria-hidden
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '40%',
                height: '100%',
                background:
                  'linear-gradient(110deg, transparent, rgba(255,255,255,0.25), transparent)',
                animation: 'p-shimmer 3s ease-in-out infinite',
                pointerEvents: 'none',
              }}
            />
            Continue workout
            <ArrowIcon />
          </Link>
        ) : (
          <Link
            to="/mesocycles"
            style={{
              width: '100%',
              height: 58,
              borderRadius: 16,
              background: 'var(--p-grad)',
              color: 'var(--btn-text)',
              fontWeight: 700,
              fontSize: 16,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              boxShadow: '0 14px 40px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
              textDecoration: 'none',
            }}
          >
            Create mesocycle
            <ArrowIcon />
          </Link>
        )}
      </div>
    </div>
  )
}
