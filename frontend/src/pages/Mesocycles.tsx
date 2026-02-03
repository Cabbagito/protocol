import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { MesocycleListItem, SplitListItem } from '../types'

export default function Mesocycles() {
  const [mesocycles, setMesocycles] = useState<MesocycleListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadMesocycles()
  }, [])

  const loadMesocycles = async () => {
    try {
      const data = await api.get<MesocycleListItem[]>('/mesocycles')
      setMesocycles(data)
    } catch (error) {
      console.error('Failed to load mesocycles:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mesocycle and all its workout logs?')) return
    try {
      await api.delete(`/mesocycles/${id}`)
      setMesocycles(mesocycles.filter((m) => m.id !== id))
    } catch (error) {
      console.error('Failed to delete mesocycle:', error)
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Mesocycles</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary text-sm"
        >
          + New
        </button>
      </header>

      {showForm && (
        <MesocycleForm
          onSave={() => {
            setShowForm(false)
            loadMesocycles()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-slate-400 text-center py-8">Loading...</div>
      ) : mesocycles.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          No mesocycles yet. Create your first training block!
        </div>
      ) : (
        <div className="space-y-2">
          {mesocycles.map((meso) => (
            <div key={meso.id} className="card">
              <div className="flex items-start justify-between">
                <Link to={`/mesocycles/${meso.id}`} className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{meso.name}</span>
                    {meso.is_active && (
                      <span className="text-xs bg-protocol-600 text-white px-2 py-0.5 rounded">
                        Active
                      </span>
                    )}
                  </div>
                  <div className="text-sm text-slate-400 mt-1">
                    {meso.split_name} &middot; Week {meso.current_week}/{meso.total_weeks}
                  </div>
                </Link>
                <button
                  onClick={() => handleDelete(meso.id)}
                  className="text-slate-400 hover:text-red-400 p-2"
                >
                  <TrashIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface MesocycleFormProps {
  onSave: () => void
  onCancel: () => void
}

function MesocycleForm({ onSave, onCancel }: MesocycleFormProps) {
  const [name, setName] = useState('')
  const [splitId, setSplitId] = useState('')
  const [totalWeeks, setTotalWeeks] = useState(4)
  const [splits, setSplits] = useState<SplitListItem[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    loadSplits()
  }, [])

  const loadSplits = async () => {
    try {
      const data = await api.get<SplitListItem[]>('/splits')
      setSplits(data)
      if (data.length > 0) {
        setSplitId(data[0].id)
      }
    } catch (error) {
      console.error('Failed to load splits:', error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!splitId) return
    setSaving(true)

    try {
      await api.post('/mesocycles', {
        name,
        split_id: splitId,
        total_weeks: totalWeeks,
      })
      onSave()
    } catch (error) {
      console.error('Failed to create mesocycle:', error)
    } finally {
      setSaving(false)
    }
  }

  const getRirSchemePreview = (weeks: number): string => {
    if (weeks <= 1) return 'RiR: 0'
    if (weeks === 2) return 'RiR: 2 → Deload'
    if (weeks === 3) return 'RiR: 3 → 1 → Deload'
    if (weeks === 4) return 'RiR: 3 → 2 → 1 → Deload'
    if (weeks === 5) return 'RiR: 3 → 2 → 1 → 0 → Deload'
    return 'RiR: 3 → ... → 0 → Deload'
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Mesocycle name (e.g., February Hypertrophy)"
        className="input"
        autoFocus
      />

      {splits.length === 0 ? (
        <div className="text-slate-500 text-sm py-2">
          No splits available. <Link to="/splits" className="text-protocol-400">Create one first.</Link>
        </div>
      ) : (
        <select
          value={splitId}
          onChange={(e) => setSplitId(e.target.value)}
          className="input"
        >
          {splits.map((split) => (
            <option key={split.id} value={split.id}>
              {split.name} ({split.session_count} sessions)
            </option>
          ))}
        </select>
      )}

      <div>
        <label className="text-sm text-slate-400">Total Weeks</label>
        <input
          type="number"
          min="1"
          max="12"
          value={totalWeeks}
          onChange={(e) => setTotalWeeks(parseInt(e.target.value) || 4)}
          className="input"
        />
        <div className="text-xs text-slate-500 mt-1">
          {getRirSchemePreview(totalWeeks)}
        </div>
      </div>

      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="btn btn-secondary flex-1"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={saving || !name || !splitId}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  )
}

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}
