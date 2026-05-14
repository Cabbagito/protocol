import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { ChevronRightIcon } from '../components/Icons'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import MesoGrid from '../components/MesoGrid'
import { useMesocycles, useCreateMesocycle, useSplits, useActiveMesocycle } from '../api/hooks'
import type { MesocycleListItem, Mesocycle } from '../types'

export default function Mesocycles() {
  const { data: mesocycles = [], isLoading } = useMesocycles()
  const { data: activeMeso } = useActiveMesocycle()
  const [showForm, setShowForm] = useState(false)

  const activeMesocycle = mesocycles.find((m) => m.is_active)
  const inactiveMesocycles = mesocycles.filter((m) => !m.is_active)

  return (
    <div>
      <AppHeader
        title="Mesocycles"
        subtitle={`${mesocycles.length} mesocycles`}
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
        <MesocycleForm
          onSave={() => setShowForm(false)}
          onCancel={() => setShowForm(false)}
        />
      )}

      {isLoading ? (
        <PageLoader />
      ) : mesocycles.length === 0 ? (
        <div className="text-[var(--text-2)] text-center py-8">
          No mesocycles yet. Create your first training block!
        </div>
      ) : (
        <div className="space-y-3">
          {/* Active mesocycle */}
          {activeMesocycle && (
            <ActiveMesoCard meso={activeMesocycle} fullMeso={activeMeso ?? null} />
          )}

          {/* Completed/inactive */}
          {inactiveMesocycles.map((meso) => (
            <InactiveMesoCard key={meso.id} meso={meso} />
          ))}

          {/* Add row */}
          <button
            onClick={() => setShowForm(true)}
            className="add-row flex items-center justify-center gap-2 py-3 w-full stagger"
          >
            <svg className="w-4 h-4" style={{ color: 'var(--accent-l)' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--accent-l)' }}>New Mesocycle</span>
          </button>
        </div>
      )}
      </div>
    </div>
  )
}

// --- Active Meso Card ---

function ActiveMesoCard({ meso, fullMeso }: { meso: MesocycleListItem; fullMeso: Mesocycle | null }) {
  const progressPct = meso.total_workouts > 0
    ? (meso.workouts_completed / meso.total_workouts) * 100
    : 0

  return (
    <Link
      to={`/mesocycles/${meso.id}`}
      className="compact-card p-4 block stagger"
      style={{
        borderColor: 'rgba(74,222,128,0.2)',
        borderLeft: meso.split_color ? `3px solid ${meso.split_color}` : undefined,
      }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-[var(--text-1)]">{meso.name}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            Active
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 shrink-0 text-[var(--text-m)]" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>{meso.split_name}</span>
        <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>&middot;</span>
        <span className="mono text-[11px]" style={{ color: 'var(--text-m)' }}>Week {meso.current_week} / {meso.total_weeks}</span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--input)' }}>
          <div
            className="h-full rounded-full"
            style={{
              width: `${progressPct}%`,
              background: '#4ade80',
              boxShadow: '0 0 6px rgba(74,222,128,0.4)',
            }}
          />
        </div>
        <span className="mono text-[10px] font-semibold" style={{ color: '#4ade80' }}>
          {meso.workouts_completed}/{meso.total_workouts}
        </span>
      </div>

      {/* Dot grid */}
      {fullMeso && <MesoGrid mesocycle={fullMeso} compact />}
    </Link>
  )
}

// --- Inactive Meso Card ---

function InactiveMesoCard({ meso }: { meso: MesocycleListItem }) {
  return (
    <Link
      to={`/mesocycles/${meso.id}`}
      className="compact-card p-4 block stagger"
      style={{
        opacity: 0.6,
        borderLeft: meso.split_color ? `3px solid ${meso.split_color}` : undefined,
      }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium" style={{ color: 'var(--text-2)' }}>{meso.name}</span>
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: 'var(--text-m)', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.15)' }}
          >
            Done
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 shrink-0 text-[var(--text-m)]" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>{meso.split_name}</span>
        <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>&middot;</span>
        <span className="mono text-[11px]" style={{ color: 'var(--text-m)' }}>{meso.total_weeks} weeks</span>
        <span className="text-[11px]" style={{ color: 'var(--text-m)' }}>&middot;</span>
        <span className="mono text-[11px]" style={{ color: 'var(--text-m)' }}>{meso.workouts_completed}/{meso.total_workouts}</span>
      </div>
    </Link>
  )
}

// --- Mesocycle Form ---

interface MesocycleFormProps {
  onSave: () => void
  onCancel: () => void
}

function MesocycleForm({ onSave, onCancel }: MesocycleFormProps) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [splitId, setSplitId] = useState('')
  const [totalWeeks, setTotalWeeks] = useState(4)
  const { data: splits = [] } = useSplits()
  const createMesocycle = useCreateMesocycle()

  // Auto-select first split when loaded
  if (splits.length > 0 && !splitId) {
    setSplitId(splits[0]!.id)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!splitId) return

    try {
      await createMesocycle.mutateAsync({
        name,
        split_id: splitId,
        total_weeks: totalWeeks,
      })
      onSave()
    } catch {
      toast.showError('Failed to create mesocycle')
    }
  }

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {/* Name */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-m)' }}>
          Name
        </div>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. March Hypertrophy"
          className="input"
          autoFocus
        />
      </div>

      {/* Split Picker */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-m)' }}>
          Split
        </div>
        {splits.length === 0 ? (
          <div className="text-[var(--text-m)] text-sm py-2">
            No splits available. <Link to="/splits" className="text-protocol-400">Create one first.</Link>
          </div>
        ) : (
          <div className="-mx-4 px-4 flex gap-2.5 overflow-x-auto scrollbar-hide pb-1">
            {splits.map((split) => {
              const isSelected = splitId === split.id
              const accent = split.color || 'var(--accent)'
              return (
                <button
                  key={split.id}
                  type="button"
                  onClick={() => setSplitId(split.id)}
                  className="shrink-0 w-[190px] rounded-xl text-left relative overflow-hidden transition-all"
                  style={{
                    background: 'var(--card)',
                    border: isSelected ? `1.5px solid ${accent}` : '1.5px solid var(--border)',
                  }}
                >
                  {isSelected && (
                    <div className="h-[3px] w-full" style={{ background: accent }} />
                  )}
                  <div className="p-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      {split.color && (
                        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: split.color }} />
                      )}
                      <span
                        className="text-[13px] font-semibold truncate"
                        style={{ color: isSelected ? 'var(--text-1)' : 'var(--text-2)' }}
                      >
                        {split.name}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px]" style={{ color: 'var(--text-m)' }}>
                      <span>{split.day_count} days</span>
                      <span>&middot;</span>
                      <span>{split.exercise_count} exercises</span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>

      {/* Weeks Stepper + RIR Heatmap */}
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-m)' }}>
          Duration & Intensity
        </div>
        <div className="rounded-xl p-4" style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.04)' }}>
          {/* Stepper */}
          <div className="flex items-center justify-between mb-4">
            <span className="text-[13px] font-medium" style={{ color: 'var(--text-2)' }}>Weeks</span>
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={() => setTotalWeeks(Math.max(3, totalWeeks - 1))}
                disabled={totalWeeks <= 3}
                className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all active:scale-90"
                style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
              >
                <span className="text-lg" style={{ color: 'var(--text-2)' }}>-</span>
              </button>
              <span className="mono text-2xl font-bold w-6 text-center" style={{ color: 'var(--text-1)' }}>
                {totalWeeks}
              </span>
              <button
                type="button"
                onClick={() => setTotalWeeks(Math.min(8, totalWeeks + 1))}
                disabled={totalWeeks >= 8}
                className="w-10 h-10 rounded-lg flex items-center justify-center disabled:opacity-30 transition-all active:scale-90"
                style={{ background: 'var(--input)', border: '1px solid var(--border)' }}
              >
                <span className="text-lg" style={{ color: 'var(--text-2)' }}>+</span>
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* Actions */}
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
          disabled={createMesocycle.isPending || !name || !splitId}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {createMesocycle.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  )
}
