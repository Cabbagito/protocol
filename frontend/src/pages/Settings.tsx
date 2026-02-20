import { useNavigate } from 'react-router-dom'
import AppHeader from '../components/AppHeader'
import { clearToken, getUserInfo } from '../lib/auth'

export default function Settings() {
  const navigate = useNavigate()
  const userInfo = getUserInfo()

  const handleLogout = () => {
    clearToken()
    navigate('/login', { replace: true })
  }

  return (
    <div>
      <AppHeader title="Settings" />
      <div className="px-4 space-y-6">
        <div className="card p-4">
          <div className="text-sm text-slate-400 mb-1">Logged in as</div>
          <div className="font-medium">{userInfo?.name ?? 'Unknown'}</div>
        </div>

        <button
          onClick={handleLogout}
          className="btn w-full bg-red-500/10 text-red-400 hover:bg-red-500/20"
        >
          Log Out
        </button>
      </div>
    </div>
  )
}
