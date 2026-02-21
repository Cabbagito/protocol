import { Link, Navigate } from 'react-router-dom'
import { useActiveMesocycle } from '../api/hooks'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'

export default function WorkoutHub() {
  const { data: mesocycle, isLoading } = useActiveMesocycle()

  if (isLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  if (mesocycle) {
    return <Navigate to={`/workout/${mesocycle.id}`} replace />
  }

  return (
    <div>
      <AppHeader title="Workout" />
      <div className="px-4">
        <div className="card">
          <p className="text-[var(--text-m)] text-sm mb-4">
            No active mesocycle. Create one to start working out.
          </p>
          <Link to="/mesocycles" className="btn btn-primary inline-block">
            Create Mesocycle
          </Link>
        </div>
      </div>
    </div>
  )
}
