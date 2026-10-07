import { Link, useLocation } from 'react-router-dom'
import { useLayoutEffect, useMemo } from 'react'
import { HomeIcon, DumbbellIcon, AppleIcon } from './Icons'
import { useActiveMesocycle } from '../api/hooks'
import { getCurrentPosition } from '../lib/mesoUtils'
import { recordLocation } from '../lib/navigation'
import { useKeyboardVisible } from '../lib/useKeyboardVisible'

type Section = 'home' | 'workout' | 'diet'

const navItems: { section: Section; label: string; icon: typeof HomeIcon }[] = [
  { section: 'home', label: 'Home', icon: HomeIcon },
  { section: 'workout', label: 'Workout', icon: DumbbellIcon },
  { section: 'diet', label: 'Diet', icon: AppleIcon },
]

/**
 * The app shell: owns the screen (height, safe-area insets, background,
 * status-bar scrim, nav clearance) so pages only lay out their content.
 * See the layout contract at the top of src/index.css.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname, key } = useLocation()
  const keyboardOpen = useKeyboardVisible()
  const { activeMesoPath, workoutHref } = useWorkoutTab()
  const section = sectionOf(pathname, activeMesoPath)

  // The document is the scroll container: open every route at the top
  // instead of at the previous page's offset.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

  // Lets back buttons tell whether their parent page is right below in history.
  useLayoutEffect(() => {
    recordLocation(pathname)
  }, [pathname, key])

  const hrefs: Record<Section, string> = {
    home: '/',
    workout: workoutTabTarget(pathname, workoutHref),
    diet: '/diet',
  }

  return (
    <div className="app-shell">
      <div className="app-bg" aria-hidden="true" />
      <main className="app-main">
        {children}
      </main>
      <div className="status-scrim" aria-hidden="true">
        <div className="app-bg" />
      </div>

      {/* BottomNavV3 — floating glass capsule with gradient pill on active item. */}
      {!keyboardOpen && (
        <nav
          aria-label="Main"
          className="fixed z-[101]"
          style={{
            left: 18,
            right: 18,
            bottom: 'calc(env(safe-area-inset-bottom) + var(--nav-gap))',
            height: 'var(--nav-h)',
            borderRadius: 22,
            background: 'color-mix(in oklab, var(--card) 80%, transparent)',
            backdropFilter: 'blur(28px) saturate(180%)',
            WebkitBackdropFilter: 'blur(28px) saturate(180%)',
            border: '1px solid rgba(255,255,255,0.05)',
            boxShadow:
              '0 12px 40px -12px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.04)',
            display: 'flex',
            alignItems: 'center',
            padding: 6,
            maxWidth: 480,
            marginLeft: 'auto',
            marginRight: 'auto',
          }}
        >
          {navItems.map((item) => {
            const isActive = item.section === section
            return (
              <Link
                key={item.section}
                to={hrefs[item.section]}
                aria-label={item.label}
                aria-current={isActive ? 'page' : undefined}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: 52,
                  borderRadius: 16,
                  background: isActive ? 'var(--p-grad-cta)' : 'transparent',
                  color: isActive ? 'var(--btn-text)' : 'var(--text-m)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  fontSize: 13,
                  fontWeight: 600,
                  textDecoration: 'none',
                  boxShadow: isActive
                    ? '0 6px 20px -6px rgba(var(--accent-rgb),0.6)'
                    : 'none',
                  transition: 'background 0.2s, color 0.2s, box-shadow 0.2s',
                  overflow: 'hidden',
                }}
              >
                <item.icon className="w-5 h-5" />
                {isActive && <span aria-hidden="true">{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}

/**
 * The Workout tab covers the workout screens, workout reviews and the active
 * mesocycle's page; Home covers Settings and everything under it.
 */
function sectionOf(pathname: string, activeMesoPath: string | null): Section {
  if (pathname.startsWith('/diet')) return 'diet'
  if (
    pathname === '/workout' ||
    pathname.startsWith('/workout/') ||
    pathname.startsWith('/workouts/') ||
    pathname === activeMesoPath
  ) {
    return 'workout'
  }
  return 'home'
}

/**
 * Tapping Workout on a workout screen opens its mesocycle; tapping it on the
 * active mesocycle's page goes back to the current workout.
 */
function workoutTabTarget(pathname: string, workoutHref: string): string {
  const onWorkout = pathname.match(/^\/workout\/([^/]+)$/)
  if (onWorkout) return `/mesocycles/${onWorkout[1]}`
  return workoutHref
}

/**
 * The Workout tab opens the current session directly instead of hopping
 * through /workout → /workout/:id → ?week=&session= redirects.
 */
function useWorkoutTab(): { activeMesoPath: string | null; workoutHref: string } {
  const { data: mesocycle } = useActiveMesocycle()
  return useMemo(() => {
    if (!mesocycle) return { activeMesoPath: null, workoutHref: '/workout' }
    const pos = getCurrentPosition(mesocycle.structure)
    return {
      activeMesoPath: `/mesocycles/${mesocycle.id}`,
      workoutHref: pos
        ? `/workout/${mesocycle.id}?week=${pos.weekIndex}&session=${pos.sessionIndex}`
        : '/workout',
    }
  }, [mesocycle])
}
