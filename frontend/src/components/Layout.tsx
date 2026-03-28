import { Link, useLocation } from 'react-router-dom'
import { useEffect, useRef } from 'react'
import { clsx } from 'clsx'
import { HomeIcon, DumbbellIcon } from './Icons'
import { useKeyboardVisible } from '../lib/useKeyboardVisible'

const NAV_HEIGHT = 'calc(48px + env(safe-area-inset-bottom))'

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
    <>
      <main
        ref={mainRef}
        data-main-scroll
        className="overflow-y-auto overscroll-y-contain max-w-lg mx-auto w-full"
        style={{
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: keyboardOpen ? undefined : NAV_HEIGHT,
          height: '100%',
        }}
      >
        {children}
      </main>

      {!keyboardOpen && (
      <nav
        className="fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)]"
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
