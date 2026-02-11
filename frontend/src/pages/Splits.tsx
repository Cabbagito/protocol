import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import { useToast } from '../components/Toast'
import { TrashIcon } from '../components/Icons'
import type { SplitListItem } from '../types'

export default function Splits() {
  const toast = useToast()
  const [splits, setSplits] = useState<SplitListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    loadSplits()
  }, [])

  const loadSplits = async () => {
    try {
      const data = await api.get<SplitListItem[]>('/splits')
      setSplits(data)
    } catch {
      toast.showError('Failed to load splits')
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this split?')) return
    try {
      await api.delete(`/splits/${id}`)
      setSplits(splits.filter((s) => s.id !== id))
    } catch {
      toast.showError('Failed to delete split')
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Splits</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="btn btn-primary text-sm"
        >
          + Add
        </button>
      </header>

      {showForm && (
        <SplitForm
          onSave={() => {
            setShowForm(false)
            loadSplits()
          }}
          onCancel={() => setShowForm(false)}
        />
      )}

      {loading ? (
        <div className="text-slate-400 text-center py-8">Loading...</div>
      ) : splits.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
          No splits yet. Create your first workout split!
        </div>
      ) : (
        <div className="space-y-2">
          {splits.map((split) => (
            <div key={split.id} className="card flex items-center justify-between">
              <Link to={`/splits/${split.id}`} className="flex-1">
                <div className="font-medium">{split.name}</div>
                <div className="text-sm text-slate-400">
                  {split.session_count} {split.session_count === 1 ? 'session' : 'sessions'}
                </div>
              </Link>
              <button
                onClick={() => handleDelete(split.id)}
                className="text-slate-400 hover:text-red-400 p-2"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

interface SplitFormProps {
  onSave: () => void
  onCancel: () => void
}

function SplitForm({ onSave, onCancel }: SplitFormProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await api.post('/splits', { name })
      onSave()
    } catch {
      toast.showError('Failed to save split')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-3">
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Split name (e.g., PPL 6-Day)"
        className="input"
        autoFocus
      />
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
          disabled={saving || !name}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}

