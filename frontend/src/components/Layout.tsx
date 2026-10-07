import { Link, useLocation } from 'react-router-dom'
import { useLayoutEffect, useMemo } from 'react'
import { HomeIcon, DumbbellIcon, AppleIcon } from './Icons'
import { useActiveMesocycle } from '../api/hooks'
import { getCurrentPosition } from '../lib/mesoUtils'
import { useKeyboardVisible } from '../lib/useKeyboardVisible'

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/workout', label: 'Workout', icon: DumbbellIcon },
  { path: '/diet', label: 'Diet', icon: AppleIcon },
]

/**
 * The app shell: owns the screen (height, safe-area insets, background,
 * status-bar scrim, nav clearance) so pages only lay out their content.
 * See the layout contract at the top of src/index.css.
 */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const keyboardOpen = useKeyboardVisible()
  const workoutHref = useWorkoutHref()

  // The document is the scroll container: open every route at the top
  // instead of at the previous page's offset.
  useLayoutEffect(() => {
    window.scrollTo(0, 0)
  }, [pathname])

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
            const isActive =
              item.path === '/'
                ? pathname === '/'
                : pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path === '/workout' ? workoutHref : item.path}
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
 * The Workout tab opens the current session directly instead of hopping
 * through /workout → /workout/:id → ?week=&session= redirects.
 */
function useWorkoutHref(): string {
  const { data: mesocycle } = useActiveMesocycle()
  return useMemo(() => {
    if (!mesocycle) return '/workout'
    const pos = getCurrentPosition(mesocycle.structure)
    return pos
      ? `/workout/${mesocycle.id}?week=${pos.weekIndex}&session=${pos.sessionIndex}`
      : '/workout'
  }, [mesocycle])
}
