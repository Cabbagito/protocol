import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useActiveMesocycle } from '../api/hooks'
import { getCurrentPosition } from '../lib/mesoUtils'
import {
  ChartIcon,
  CalendarIcon,
  DumbbellIcon,
  TrendingUpIcon,
  GearIcon,
  ChevronRightIcon,
  AppleIcon,
} from '../components/Icons'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import MesoGrid from '../components/MesoGrid'

function ArrowIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7" />
    </svg>
  )
}

const quickAccessItems = [
  { path: '/mesocycles', label: 'Mesocycles', icon: ChartIcon, color: 'var(--accent-l)', bgColor: 'rgba(var(--accent-rgb), 0.1)' },
  { path: '/splits', label: 'Splits', icon: CalendarIcon, color: '#a855f7', bgColor: 'rgba(168,85,247,0.1)' },
  { path: '/exercises', label: 'Exercises', icon: DumbbellIcon, color: '#22c55e', bgColor: 'rgba(34,197,94,0.1)' },
  { path: '/diet', label: 'Diet', icon: AppleIcon, color: '#ef4444', bgColor: 'rgba(239,68,68,0.1)' },
  { path: '/progress', label: 'Progress', icon: TrendingUpIcon, color: '#f97316', bgColor: 'rgba(249,115,22,0.1)' },
]

export default function Dashboard() {
  const { data: mesocycle, isLoading: mesoLoading } = useActiveMesocycle()

  const currentPos = useMemo(
    () => (mesocycle ? getCurrentPosition(mesocycle.structure) : null),
    [mesocycle],
  )

  if (mesoLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // Compute stats when mesocycle exists
  const currentWi = currentPos?.weekIndex ?? 0
  const currentSi = currentPos?.sessionIndex ?? 0

  const nextSessionName = mesocycle
    ? (mesocycle.structure.weeks[currentWi]?.sessions[currentSi]?.session_name ?? 'Workout')
    : ''

  const currentWeek = mesocycle?.structure.weeks[currentWi]
  const totalSessionsThisWeek = currentWeek?.sessions.length ?? 0
  const completedThisWeek = currentWeek?.sessions.filter(s => {
    const nonSkipped = s.exercises.filter(ex => !ex.skipped)
    return nonSkipped.length > 0 && nonSkipped.every(ex => ex.sets.every(set => set.logged))
  }).length ?? 0

  const totalWorkouts = mesocycle
    ? mesocycle.structure.weeks.reduce(
        (count, week) => count + week.sessions.filter(s => s.exercises.some(ex => !ex.skipped)).length,
        0,
      )
    : 0
  const progressPercent = totalWorkouts > 0
    ? Math.round((mesocycle!.workouts_completed / totalWorkouts) * 100)
    : 0

  const weekPercent = totalSessionsThisWeek > 0
    ? Math.round((completedThisWeek / totalSessionsThisWeek) * 100)
    : 0

  return (
    <div>
      <AppHeader title="Protocol" subtitle={formattedDate} />

      <div className="px-4 space-y-3">
        {mesocycle ? (
          <>
            {/* HERO MESO CARD */}
            <div className="relative stagger" style={{ animationDelay: '0.10s' }}>
              <div className="dash-hero-glow" />

              <div
                className="card relative z-[1]"
                style={{ animation: 'dash-breathe-border 4s ease-in-out infinite' }}
              >
                {/* Header */}
                <div className="flex items-start justify-between mb-3.5">
                  <div>
                    <div className="text-[15px] font-semibold text-[var(--text-1)]">
                      {mesocycle.name}
                    </div>
                    <div className="mono text-[11px] text-[var(--text-m)] mt-0.5">
                      Week {currentWi + 1} of {mesocycle.total_weeks}
                    </div>
                  </div>
                  <Link
                    to={`/mesocycles/${mesocycle.id}`}
                    className="text-[12px] text-[var(--accent-l)] font-medium"
                  >
                    View
                  </Link>
                </div>

                {/* Meso Grid */}
                <div className="mb-4">
                  <MesoGrid mesocycle={mesocycle} compact />
                </div>

                {/* Up next + Continue CTA */}
                <div className="flex items-center gap-2.5">
                  <div className="flex-1">
                    <div className="text-[11px] text-[var(--text-m)] mb-0.5">Up next</div>
                    <div className="text-[13px] font-semibold text-[var(--text-1)]">
                      {nextSessionName}
                    </div>
                  </div>
                  <Link
                    to={`/workout/${mesocycle.id}?week=${currentWi}&session=${currentSi}`}
                    className="dash-cta-btn inline-flex items-center gap-1 text-white text-[13px] font-semibold rounded-[10px] px-5 py-[11px]"
                    style={{
                      background: 'var(--accent)',
                      animation: 'dash-cta-pulse 2.5s ease-in-out infinite',
                    }}
                  >
                    <span className="dash-shimmer" />
                    Continue
                    <ArrowIcon className="inline-block ml-0.5 -mb-px" />
                  </Link>
                </div>
              </div>
            </div>

            {/* STAT CARDS */}
            <div className="flex gap-2 stagger" style={{ animationDelay: '0.18s' }}>
              {/* This Week */}
              <div className="card dash-stat-card flex-1" style={{ padding: 14 }}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-m)] mb-1.5">
                  This Week
                </div>
                <div className="flex items-baseline gap-[3px]">
                  <span className="mono text-2xl font-bold text-[var(--text-1)]">
                    {completedThisWeek}
                  </span>
                  <span className="mono text-[13px] text-[var(--text-m)]">
                    /{totalSessionsThisWeek}
                  </span>
                </div>
                <div
                  className="h-[3px] rounded-sm mt-2 overflow-hidden"
                  style={{ background: 'var(--input)' }}
                >
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${weekPercent}%`,
                      background: '#4ade80',
                      animation: weekPercent > 0 ? 'dash-bar-glow-green 2.5s ease-in-out infinite' : undefined,
                    }}
                  />
                </div>
              </div>

              {/* Meso Progress */}
              <div className="card dash-stat-card flex-1" style={{ padding: 14 }}>
                <div className="text-[10px] font-semibold uppercase tracking-wide text-[var(--text-m)] mb-1.5">
                  Meso Progress
                </div>
                <div className="flex items-baseline gap-[3px]">
                  <span className="mono text-2xl font-bold text-[var(--text-1)]">
                    {progressPercent}
                  </span>
                  <span className="mono text-[13px] text-[var(--text-m)]">%</span>
                </div>
                <div
                  className="h-[3px] rounded-sm mt-2 overflow-hidden"
                  style={{ background: 'var(--input)' }}
                >
                  <div
                    className="h-full rounded-sm"
                    style={{
                      width: `${progressPercent}%`,
                      background: 'var(--accent)',
                      animation: progressPercent > 0 ? 'dash-bar-glow-blue 2.5s ease-in-out infinite 0.5s' : undefined,
                    }}
                  />
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="card stagger" style={{ animationDelay: '0.10s' }}>
            <h2 className="font-semibold mb-2 text-[var(--text-1)]">Get Started</h2>
            <p className="text-[var(--text-m)] text-sm mb-4">
              Create a mesocycle to start tracking your workouts.
            </p>
            <Link to="/mesocycles" className="btn btn-primary inline-block">
              Create Mesocycle
            </Link>
          </div>
        )}

        {/* QUICK ACCESS */}
        <div className="stagger" style={{ animationDelay: '0.26s' }}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-m)] mb-2.5">
            Quick Access
          </div>
          <div className="grid grid-cols-2 gap-2">
            {quickAccessItems.map((item, i) => (
              <Link
                key={item.path}
                to={item.path}
                className="dash-qa-card card flex flex-col gap-2.5"
                style={{
                  padding: '16px 14px',
                  animation: `dash-card-glow 4s ease-in-out infinite ${i}s`,
                }}
              >
                <div
                  className="flex items-center justify-center rounded-lg"
                  style={{
                    width: 32,
                    height: 32,
                    background: item.bgColor,
                    color: item.color,
                  }}
                >
                  <item.icon className="w-[18px] h-[18px]" />
                </div>
                <span className="text-[13px] font-medium text-[var(--text-1)]">
                  {item.label}
                </span>
              </Link>
            ))}

            {/* Settings — full width row */}
            <Link
              to="/settings"
              className="dash-qa-card card flex items-center gap-3 col-span-2"
              style={{ padding: 14 }}
            >
              <div
                className="flex items-center justify-center rounded-lg"
                style={{
                  width: 32,
                  height: 32,
                  background: 'rgba(100,116,139,0.1)',
                  color: '#64748b',
                }}
              >
                <GearIcon className="w-[18px] h-[18px]" />
              </div>
              <span className="text-[13px] font-medium text-[var(--text-1)]">Settings</span>
              <ChevronRightIcon className="w-4 h-4 text-[var(--text-m)] ml-auto" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
