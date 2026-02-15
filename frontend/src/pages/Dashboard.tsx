import { Link } from 'react-router-dom'
import { useActiveMesocycle } from '../api/hooks'
import {
  ProtocolLogo,
  ChartIcon,
  CalendarIcon,
  DumbbellIcon,
  TrendingUpIcon,
  GearIcon,
  ChevronRightIcon,
} from '../components/Icons'
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
    return <div className="text-slate-500 text-center py-8">Loading...</div>
  }

  return (
    <div className="px-4 pt-5 space-y-4">
      {/* Header */}
      <header className="flex items-center gap-3">
        <ProtocolLogo className="w-9 h-9 flex-shrink-0" />
        <div>
          <h1 className="text-[15px] font-semibold text-slate-200">Protocol</h1>
          <p className="text-[11px] text-slate-600">
            {new Date().toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
            })}
          </p>
        </div>
      </header>

      {/* Active Mesocycle */}
      {mesocycle ? (
        <MesoGrid mesocycle={mesocycle} />
      ) : (
        <div className="card">
          <h2 className="font-semibold mb-2 text-slate-200">Get Started</h2>
          <p className="text-slate-500 text-sm mb-4">
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
              <item.icon className="w-5 h-5 text-slate-400" />
              <span className="text-sm font-medium text-slate-200">{item.label}</span>
            </div>
            <ChevronRightIcon className="w-4 h-4 text-slate-600" />
          </Link>
        ))}
      </div>
    </div>
  )
}
