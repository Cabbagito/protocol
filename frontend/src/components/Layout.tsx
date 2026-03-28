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
  const mainRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    mainRef.current?.scrollTo(0, 0)
  }, [pathname])

  return (
    <div className="h-dvh flex flex-col" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
      <main
        ref={mainRef}
        data-main-scroll
        className="flex-1 overflow-y-auto overscroll-y-contain max-w-lg mx-auto w-full"
      >
        {children}
      </main>

      {!keyboardOpen && (
      <nav
        className="flex-shrink-0 pb-[env(safe-area-inset-bottom)]"
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
    </div>
  )
}
