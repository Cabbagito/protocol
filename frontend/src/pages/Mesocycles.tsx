import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import { TrashIcon } from '../components/Icons'
import type { MesocycleListItem, SplitListItem } from '../types'

export default function Mesocycles() {
  const toast = useToast()
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
    } catch {
      toast.showError('Failed to load mesocycles')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this mesocycle and all its workout logs?')) return
    try {
      await api.delete(`/mesocycles/${id}`)
      setMesocycles(mesocycles.filter((m) => m.id !== id))
    } catch {
      toast.showError('Failed to delete mesocycle')
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
  const toast = useToast()
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
        setSplitId(data[0]!.id)
      }
    } catch {
      toast.showError('Failed to load splits')
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
    } catch {
      toast.showError('Failed to create mesocycle')
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

