import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { HomeIcon, DumbbellIcon } from './Icons'

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/workout', label: 'Workout', icon: DumbbellIcon },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-16 md:pb-20 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav
        className="fixed bottom-0 left-0 right-0 pb-[env(safe-area-inset-bottom)]"
        style={{
          background: 'rgba(13,27,42,0.95)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <div className="flex justify-around items-center h-12 md:h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive =
              item.path === '/'
                ? location.pathname === '/'
                : location.pathname.startsWith(item.path)
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center justify-center w-16 h-full transition-colors',
                  isActive ? 'text-protocol-400' : 'text-slate-600 hover:text-slate-400'
                )}
              >
                <item.icon className="w-5 h-5 md:w-6 md:h-6" />
                <span className="text-[10px] md:text-xs mt-0.5 md:mt-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
