import { Link, Navigate } from 'react-router-dom'
import { useActiveMesocycle } from '../api/hooks'
import AppHeader from '../components/AppHeader'

export default function WorkoutHub() {
  const { data: mesocycle, isLoading } = useActiveMesocycle()

  if (isLoading) {
    return <div className="text-slate-500 text-center py-8">Loading...</div>
  }

  if (mesocycle) {
    return <Navigate to={`/workout/${mesocycle.id}`} replace />
  }

  return (
    <div>
      <AppHeader title="Workout" />
      <div className="px-4">
        <div className="card">
          <p className="text-slate-500 text-sm mb-4">
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
