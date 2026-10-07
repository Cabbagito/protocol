import { Navigate, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { useMesocycle } from '../api/hooks'
import PageLoader from '../components/PageLoader'
import { getCurrentPosition } from '../lib/mesoUtils'
import { WorkoutSession } from './workout/WorkoutSession'

/**
 * /workout/:mesocycleId[?week=&session=[&edit=1]]
 *
 * Without a position, resolves "where we left off" on the client (so it
 * works offline, including sets not yet synced) and redirects. The session
 * screen is keyed per session so switching sessions never carries state over.
 */
export default function Workout() {
  const navigate = useNavigate()
  const { mesocycleId = '' } = useParams<{ mesocycleId: string }>()
  const [searchParams] = useSearchParams()
  const weekParam = searchParams.get('week')
  const sessionParam = searchParams.get('session')
  const editing = searchParams.get('edit') === '1'
  const { data: mesocycle, isLoading } = useMesocycle(mesocycleId)

  if (isLoading) return <PageLoader className="min-h-[60vh]" />

  if (!mesocycle) {
    return (
      <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-2)' }}>
        <p>Couldn't load this workout.</p>
        <p style={{ fontSize: 13, color: 'var(--text-m)', marginTop: 6 }}>
          It hasn't been opened on this phone yet — connect and try again.
        </p>
        <button type="button" className="btn btn-primary" style={{ marginTop: 20 }} onClick={() => navigate('/')}>
          Home
        </button>
      </div>
    )
  }

  if (weekParam === null || sessionParam === null) {
    const pos = getCurrentPosition(mesocycle.structure)
    return pos
      ? <Navigate to={`/workout/${mesocycle.id}?week=${pos.weekIndex}&session=${pos.sessionIndex}`} replace />
      : <Navigate to={`/mesocycles/${mesocycle.id}`} replace />
  }

  const weekIndex = Number(weekParam)
  const sessionIndex = Number(sessionParam)
  if (!mesocycle.structure.weeks[weekIndex]?.sessions[sessionIndex]) {
    return <Navigate to={`/workout/${mesocycle.id}`} replace />
  }

  return (
    <WorkoutSession
      key={`${mesocycle.id}:${weekIndex}:${sessionIndex}`}
      mesocycle={mesocycle}
      weekIndex={weekIndex}
      sessionIndex={sessionIndex}
      editing={editing}
    />
  )
}
