import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api/client'
import type { SplitListItem } from '../types'

export default function Splits() {
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
    } catch (error) {
      console.error('Failed to load splits:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this split?')) return
    try {
      await api.delete(`/splits/${id}`)
      setSplits(splits.filter((s) => s.id !== id))
    } catch (error) {
      console.error('Failed to delete split:', error)
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
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)

    try {
      await api.post('/splits', { name })
      onSave()
    } catch (error) {
      console.error('Failed to save split:', error)
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

function TrashIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m14.74 9-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 0 1-2.244 2.077H8.084a2.25 2.25 0 0 1-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 0 0-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 0 1 3.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 0 0-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 0 0-7.5 0" />
    </svg>
  )
}
