import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'
import { HomeIcon, ChartIcon, CalendarIcon, DumbbellIcon } from './Icons'

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
  { path: '/mesocycles', label: 'Training', icon: ChartIcon },
  { path: '/splits', label: 'Splits', icon: CalendarIcon },
  { path: '/exercises', label: 'Exercises', icon: DumbbellIcon },
]

export default function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()

  return (
    <div className="min-h-screen flex flex-col">
      <main className="flex-1 pb-20 px-4 pt-4 max-w-lg mx-auto w-full">
        {children}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-slate-800 border-t border-slate-700 pb-[env(safe-area-inset-bottom)]">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path
            return (
              <Link
                key={item.path}
                to={item.path}
                className={clsx(
                  'flex flex-col items-center justify-center w-16 h-full transition-colors',
                  isActive ? 'text-protocol-400' : 'text-slate-400 hover:text-slate-200'
                )}
              >
                <item.icon className="w-6 h-6" />
                <span className="text-xs mt-1">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
