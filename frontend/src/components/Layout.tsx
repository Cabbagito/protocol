import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { HomeIcon, DumbbellIcon, AppleIcon } from './Icons'
import { useKeyboardVisible } from '../lib/useKeyboardVisible'

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/workout', label: 'Workout', icon: DumbbellIcon },
  { path: '/diet', label: 'Diet', icon: AppleIcon },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const keyboardOpen = useKeyboardVisible()
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="min-h-screen flex flex-col">
      <main
        ref={mainRef}
        data-main-scroll
        className="flex-1 pb-28 max-w-lg mx-auto w-full"
      >
        {children}
      </main>

      {/* BottomNavV3 — floating glass capsule with gradient pill on active item. */}
      {!keyboardOpen && (
        <nav
          className="fixed z-[101]"
          style={{
            left: 18,
            right: 18,
            bottom: 'calc(env(safe-area-inset-bottom) + 18px)',
            height: 64,
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
                to={item.path}
                style={{
                  position: 'relative',
                  flex: 1,
                  height: 52,
                  borderRadius: 16,
                  background: isActive ? 'var(--p-grad)' : 'transparent',
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
                {isActive && (
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
                )}
                <item.icon className="w-5 h-5" />
                {isActive && <span>{item.label}</span>}
              </Link>
            )
          })}
        </nav>
      )}
    </div>
  )
}
