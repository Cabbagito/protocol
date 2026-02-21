import { Link } from 'react-router-dom'
import { useActiveMesocycle } from '../api/hooks'
import {
  ChartIcon,
  CalendarIcon,
  DumbbellIcon,
  TrendingUpIcon,
  GearIcon,
  ChevronRightIcon,
} from '../components/Icons'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import MesoGrid from '../components/MesoGrid'

const quickLinks = [
  { path: '/mesocycles', label: 'Mesocycles', icon: ChartIcon },
  { path: '/splits', label: 'Splits', icon: CalendarIcon },
  { path: '/exercises', label: 'Exercises', icon: DumbbellIcon },
  { path: '/progress', label: 'Stats', icon: TrendingUpIcon },
  { path: '/settings', label: 'Settings', icon: GearIcon },
]

export default function Dashboard() {
  const { data: mesocycle, isLoading: mesoLoading } = useActiveMesocycle()

  if (mesoLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  const formattedDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div>
      <AppHeader title="Protocol" subtitle={formattedDate} />

      <div className="px-4 space-y-4">
      {/* Active Mesocycle */}
      {mesocycle ? (
        <MesoGrid mesocycle={mesocycle} />
      ) : (
        <div className="card">
          <h2 className="font-semibold mb-2 text-[var(--text-1)]">Get Started</h2>
          <p className="text-[var(--text-m)] text-sm mb-4">
            Create a mesocycle to start tracking your workouts.
          </p>
          <Link to="/mesocycles" className="btn btn-primary inline-block">
            Create Mesocycle
          </Link>
        </div>
      )}

      {/* Quick Links */}
      <div className="space-y-1.5">
        {quickLinks.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className="card flex items-center justify-between py-3.5"
          >
            <div className="flex items-center gap-3">
              <item.icon className="w-5 h-5 text-[var(--text-2)]" />
              <span className="text-sm font-medium text-[var(--text-1)]">{item.label}</span>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-[var(--text-m)]" />
          </Link>
        ))}
      </div>
      </div>
    </div>
  )
}
