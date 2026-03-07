import { useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { ChevronRightIcon } from '../components/Icons'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import ProtocolMark from '../components/ProtocolMark'
import { useSplits, useCreateSplit, useSplit, useExercises } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import type { SplitListItem } from '../types'

export default function Splits() {
  const { data: splits = [], isLoading } = useSplits()
  const [showForm, setShowForm] = useState(false)

  return (
    <div>
      <AppHeader
        title="Splits"
        subtitle={`${splits.length} splits`}
        rightContent={
          <button onClick={() => setShowForm(!showForm)} className="plus-btn">
            <svg className="w-3.5 h-3.5" style={{ color: 'var(--accent-l)' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--accent-l)' }}>New</span>
          </button>
        }
      />

      <div className="px-4 space-y-3">
      {showForm && (
        <SplitForm
          onSave={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <PageLoader />
      ) : splits.length === 0 ? (
        <div className="text-[var(--text-2)] text-center py-8">
          No splits yet. Create your first workout split!
        </div>
      ) : (
        <div className="space-y-3">
          {splits.map((split) => (
            <SplitCard key={split.id} split={split} />
          ))}

          {/* Add row */}
          <button
            onClick={() => setShowForm(true)}
            className="add-row flex items-center justify-center gap-2 py-3 w-full stagger"
          >
            <svg className="w-4 h-4" style={{ color: 'var(--accent-l)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--accent-l)' }}>New Split</span>
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

// --- Split Card ---

function SplitCard({ split }: { split: SplitListItem }) {
  const { data: splitDetail, isLoading } = useSplit(split.id)
  const { data: exercises = [] } = useExercises()

  // Build exerciseId → muscleGroup map
  const exerciseMap = useMemo(() => {
    const map: Record<string, string> = {}
    for (const ex of exercises) {
      map[ex.id] = ex.muscle_group
    }
    return map
  }, [exercises])

  // Compute volume per muscle group across all sessions
  const volumeData = useMemo(() => {
    if (!splitDetail) return []
    const volumeMap: Record<string, number> = {}
    for (const session of splitDetail.sessions) {
      if (session.is_rest_day) continue
      for (const ex of session.exercises) {
        const mg = exerciseMap[ex.exercise_id] || 'unknown'
        volumeMap[mg] = (volumeMap[mg] || 0) + ex.sets
      }
    }
    return Object.entries(volumeMap)
      .map(([group, sets]) => ({ group, sets }))
      .sort((a, b) => b.sets - a.sets)
  }, [splitDetail, exerciseMap])

  const maxVolume = volumeData.length > 0 ? volumeData[0]!.sets : 1

  // Compute dominant muscle group per session for schedule strip colors
  const sessionColors = useMemo(() => {
    if (!splitDetail) return []
    return splitDetail.sessions.map((session) => {
      if (session.is_rest_day) return null
      const mgSets: Record<string, number> = {}
      for (const ex of session.exercises) {
        const mg = exerciseMap[ex.exercise_id] || 'unknown'
        mgSets[mg] = (mgSets[mg] || 0) + ex.sets
      }
      let dominant = ''
      let maxSets = 0
      for (const [mg, sets] of Object.entries(mgSets)) {
        if (sets > maxSets) { dominant = mg; maxSets = sets }
      }
      return dominant ? getMuscleColor(dominant) : null
    })
  }, [splitDetail, exerciseMap])

  return (
    <Link
      to={`/splits/${split.id}`}
      className="compact-card p-4 list-row block stagger"
      style={{ borderLeft: split.color ? `3px solid ${split.color}` : undefined }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-3">
        <div className="text-[15px] font-semibold text-[var(--text-1)]">{split.name}</div>
        <ChevronRightIcon className="w-4 h-4 shrink-0 text-[var(--text-m)]" />
      </div>

      {isLoading ? (
        <div className="h-16 flex items-center justify-center">
          <ProtocolMark mode="loading" className="w-10 h-10" />
        </div>
      ) : splitDetail ? (
        <>
          {/* Schedule strip */}
          <div className="schedule-strip flex gap-1 mb-3 pb-1" style={{ margin: '0 -4px', padding: '0 4px' }}>
            {splitDetail.sessions.map((session, idx) => {
              const color = sessionColors[idx]
              return (
                <div key={session.id} className="day-cell">
                  <div
                    className="day-num"
                    style={{
                      background: color ? `${color.bg}` : 'rgba(148,163,184,0.08)',
                      color: color ? color.light : 'var(--text-2)',
                      border: `1px solid ${color ? color.border : 'rgba(148,163,184,0.15)'}`,
                    }}
                  >
                    {idx + 1}
                  </div>
                  <span className="day-name" style={{ color: 'var(--text-m)' }}>
                    {session.name}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Volume bars */}
          {volumeData.length > 0 && (
            <div className="space-y-1.5" style={{ padding: '8px 10px', background: 'var(--deep)', borderRadius: 8 }}>
              {volumeData.map(({ group, sets }) => {
                const color = getMuscleColor(group)
                return (
                  <div key={group} className="flex items-center gap-2">
                    <span className="text-[9px] font-medium w-14 text-right capitalize" style={{ color: 'var(--text-m)' }}>
                      {group}
                    </span>
                    <div className="flex-1 h-[5px] rounded-full" style={{ background: 'var(--input)' }}>
                      <div
                        className="vol-bar rounded-full h-full"
                        style={{
                          width: `${(sets / maxVolume) * 100}%`,
                          background: color.primary,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="mono text-[9px] w-5 text-right" style={{ color: 'var(--text-m)' }}>
                      {sets}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </>
      ) : null}
    </Link>
  )
}

// --- Split Colors ---

const SPLIT_COLORS = [
  '#14b8a6', // teal
  '#6366f1', // indigo
  '#f97316', // orange
  '#ec4899', // pink
  '#22c55e', // green
  '#eab308', // yellow
  '#06b6d4', // cyan
  '#f43f5e', // rose
]

function SplitColorPicker({ value, onChange }: { value: string | null; onChange: (c: string) => void }) {
  return (
    <div className="flex gap-2 items-center">
      {SPLIT_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          className="w-6 h-6 rounded-full shrink-0 transition-transform"
          style={{
            background: c,
            boxShadow: value === c ? `0 0 0 2px var(--base), 0 0 0 4px ${c}` : 'none',
            transform: value === c ? 'scale(1.1)' : 'scale(1)',
          }}
        />
      ))}
    </div>
  )
}

// --- Split Form ---

interface SplitFormProps {
  onSave: () => void
  onCancel: () => void
}

function SplitForm({ onSave, onCancel }: SplitFormProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [color, setColor] = useState<string | null>(SPLIT_COLORS[0]!)
  const createSplit = useCreateSplit()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      await createSplit.mutateAsync({ name, color })
      onSave()
    } catch {
      toast.showError('Failed to save split')
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
      <SplitColorPicker value={color} onChange={setColor} />
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
          disabled={createSplit.isPending || !name}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {createSplit.isPending ? 'Saving...' : 'Save'}
        </button>
      </div>
    </form>
  )
}
