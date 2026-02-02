import { useState, useEffect } from 'react'
import { api } from '../api/client'

export default function Dashboard() {
  const [health, setHealth] = useState<{ status: string; version: string } | null>(null)

  useEffect(() => {
    api.get<{ status: string; version: string }>('/health')
      .then(setHealth)
      .catch(console.error)
  }, [])

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Protocol</h1>
        <p className="text-slate-400 text-sm">Your fitness dashboard</p>
      </header>

      <div className="card">
        <h2 className="font-semibold mb-2">Today's Workout</h2>
        <p className="text-slate-400 text-sm">No workout scheduled</p>
      </div>

      <div className="card">
        <h2 className="font-semibold mb-2">Macros</h2>
        <div className="grid grid-cols-4 gap-2 text-center text-sm">
          <div>
            <div className="text-lg font-bold text-protocol-400">0</div>
            <div className="text-slate-400">Protein</div>
          </div>
          <div>
            <div className="text-lg font-bold text-green-400">0</div>
            <div className="text-slate-400">Carbs</div>
          </div>
          <div>
            <div className="text-lg font-bold text-yellow-400">0</div>
            <div className="text-slate-400">Fat</div>
          </div>
          <div>
            <div className="text-lg font-bold text-slate-300">0</div>
            <div className="text-slate-400">kcal</div>
          </div>
        </div>
      </div>

      {health && (
        <div className="text-xs text-slate-500 text-center">
          API: {health.status} | v{health.version}
        </div>
      )}
    </div>
  )
}
