import { useNavigate } from 'react-router-dom'
import { ChevronLeftIcon } from '../components/Icons'

export default function Settings() {
  const navigate = useNavigate()

  return (
    <div className="px-4 pt-5">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate(-1)} className="text-slate-400 hover:text-slate-200">
          <ChevronLeftIcon className="w-6 h-6" />
        </button>
        <h1 className="text-lg font-semibold text-slate-200">Settings</h1>
      </div>

      <p className="text-slate-500 text-sm">Settings coming soon.</p>
    </div>
  )
}
