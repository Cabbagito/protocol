import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { HomeIcon, DumbbellIcon } from './Icons'
import { useKeyboardVisible } from '../lib/useKeyboardVisible'

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/workout', label: 'Workout', icon: DumbbellIcon },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const keyboardOpen = useKeyboardVisible()
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <>
      {/* Safe-area mask behind status bar */}
      <div
        className="fixed top-0 left-0 right-0 z-50"
        style={{ height: 'env(safe-area-inset-top)', background: 'var(--base)' }}
      />

      {/* Inner scroll container — fixed, so iOS keyboard can't push it */}
      <div
        ref={scrollRef}
        data-main-scroll
        className="fixed left-0 right-0 overflow-y-auto overscroll-y-contain"
        style={{
          top: 'env(safe-area-inset-top)',
          bottom: keyboardOpen ? '0' : 'calc(48px + env(safe-area-inset-bottom))',
        }}
      >
        <div className="max-w-lg mx-auto w-full">
          {children}
        </div>
      </div>

      {/* Nav — fixed at bottom, body safe-area padding covers the gap below */}
      {!keyboardOpen && (
      <nav
        className="fixed bottom-0 left-0 right-0 z-40 pb-[env(safe-area-inset-bottom)]"
        style={{
          background: 'var(--nav-bg)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex justify-around items-center h-12 md:h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? pathname === '/'
                : pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center justify-center w-16 h-full transition-colors',
                  isActive ? 'text-protocol-400' : 'text-[var(--text-m)] hover:text-[var(--text-2)]'
                )}
              >
                <item.icon className="w-5 h-5 md:w-6 md:h-6" />
                <span className="text-[10px] md:text-xs mt-0.5 md:mt-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
      )}
    </>
  )
}
