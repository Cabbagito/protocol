import { Link, useLocation } from 'react-router-dom'
import { clsx } from 'clsx'

const navItems = [
  { path: '/', label: 'Home', icon: HomeIcon },
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

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  )
}

function DumbbellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h2.25M3 12h2.25m0 0V7.5m0 4.5v4.5M3 16.5h2.25M21 7.5h-2.25m0 0V12m0-4.5v4.5m0 0h2.25m-2.25 0v4.5m0 0h2.25M6.75 7.5h10.5v9H6.75v-9Z" />
    </svg>
  )
}

function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 0 1 2.25-2.25h13.5A2.25 2.25 0 0 1 21 7.5v11.25m-18 0A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75m-18 0v-7.5A2.25 2.25 0 0 1 5.25 9h13.5A2.25 2.25 0 0 1 21 11.25v7.5" />
    </svg>
  )
}
