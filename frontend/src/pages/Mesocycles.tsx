import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useToast } from '../components/Toast'
import { ChevronRightIcon } from '../components/Icons'
import AppHeader from '../components/AppHeader'
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
            <svg className="w-3.5 h-3.5" style={{ color: '#38bdf8' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: '#38bdf8' }}>New</span>
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
        <div className="text-slate-400 text-center py-8">Loading...</div>
      ) : mesocycles.length === 0 ? (
        <div className="text-slate-400 text-center py-8">
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
            <svg className="w-4 h-4" style={{ color: '#38bdf8' }} fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: '#38bdf8' }}>New Mesocycle</span>
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
      style={{ borderColor: 'rgba(74,222,128,0.2)' }}
    >
      {/* Top row */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-semibold text-slate-200">{meso.name}</span>
          <span
            className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)' }}
          >
            Active
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 shrink-0 text-[#334155]" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-1.5 mb-3">
        <span className="text-[11px]" style={{ color: '#475569' }}>{meso.split_name}</span>
        <span className="text-[11px]" style={{ color: '#334155' }}>&middot;</span>
        <span className="mono text-[11px]" style={{ color: '#64748b' }}>Week {meso.current_week} / {meso.total_weeks}</span>
        <span className="text-[11px]" style={{ color: '#334155' }}>&middot;</span>
        <span className="mono text-[11px]" style={{ color: '#38bdf8' }}>
          {meso.current_rir === -1 ? 'Deload' : `RiR ${meso.current_rir}`}
        </span>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-2 mb-3">
        <div className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ background: '#162a3e' }}>
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
      {fullMeso && <MesoGrid structure={fullMeso.structure} />}
    </Link>
  )
}

// --- Meso Grid (dot grid) ---

function MesoGrid({ structure }: { structure: Mesocycle['structure'] }) {
  const weeks = structure.weeks
  if (!weeks || weeks.length === 0) return null

  // Session labels from first week
  const sessionLabels = weeks[0]!.sessions.map((s) => s.session_name)
  const totalWeeks = weeks.length

  // Find "current" position: first session with any unlogged sets
  let currentWeek = -1
  let currentSession = -1
  let found = false
  for (let wi = 0; wi < weeks.length && !found; wi++) {
    const week = weeks[wi]!
    for (let si = 0; si < week.sessions.length && !found; si++) {
      const session = week.sessions[si]!
      const allLogged = session.exercises.length > 0 &&
        session.exercises.every((ex) => ex.sets.every((s) => s.logged))
      if (!allLogged) {
        currentWeek = wi
        currentSession = si
        found = true
      }
    }
  }

  return (
    <div className="overflow-x-auto scrollbar-hide" style={{ background: '#0a1626', borderRadius: 8, padding: '10px 12px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `40px repeat(${totalWeeks}, 1fr)`,
          gap: 5,
          alignItems: 'center',
          minWidth: 'max-content',
        }}
      >
        {/* Header row */}
        <div />
        {weeks.map((week, wi) => {
          const isDeload = week.rir === -1
          return (
            <div key={wi} className="text-center">
              <div className="text-[10px] font-semibold" style={{ color: isDeload ? '#eab308' : '#64748b' }}>
                W{week.week_number}
              </div>
              <div className="text-[8px] font-normal" style={{ color: isDeload ? 'rgba(234,179,8,0.5)' : '#475569' }}>
                {isDeload ? 'DL' : `R${week.rir}`}
              </div>
            </div>
          )
        })}

        {/* Session rows */}
        {sessionLabels.map((label, si) => (
          <MesoGridRow
            key={si}
            label={label}
            sessionIndex={si}
            weeks={weeks}
            currentWeek={currentWeek}
            currentSession={currentSession}
          />
        ))}
      </div>
    </div>
  )
}

function MesoGridRow({
  label,
  sessionIndex,
  weeks,
  currentWeek,
  currentSession,
}: {
  label: string
  sessionIndex: number
  weeks: Mesocycle['structure']['weeks']
  currentWeek: number
  currentSession: number
}) {
  return (
    <>
      <div className="text-[10px] font-medium" style={{ color: '#94a3b8' }}>{label}</div>
      {weeks.map((week, wi) => {
        const session = week.sessions[sessionIndex]
        if (!session) {
          return <div key={wi} className="flex justify-center"><div className="w-6 h-6" /></div>
        }

        const allLogged = session.exercises.length > 0 &&
          session.exercises.every((ex) => ex.sets.every((s) => s.logged))
        const isCurrent = wi === currentWeek && sessionIndex === currentSession
        const isDeload = week.rir === -1

        let dotStyle: React.CSSProperties

        if (allLogged) {
          // Done — solid green
          dotStyle = { background: '#4ade80' }
        } else if (isCurrent) {
          // Current — pulsing blue ring
          dotStyle = {
            background: 'rgba(2,132,199,0.15)',
            border: '2px solid #0284c7',
            animation: 'pulse-current 2s ease-in-out infinite',
          }
        } else if (isDeload) {
          // Deload — faint amber
          dotStyle = {
            background: 'rgba(234,179,8,0.06)',
            border: '1.5px solid rgba(234,179,8,0.12)',
          }
        } else {
          // Pending — hollow dark
          dotStyle = {
            background: '#162a3e',
            border: '1.5px solid #1e3a52',
          }
        }

        return (
          <div key={wi} className="flex justify-center">
            <div className="w-6 h-6 rounded-full" style={dotStyle}>
              {isCurrent && (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="w-2 h-2 rounded-full" style={{ background: '#38bdf8' }} />
                </div>
              )}
            </div>
          </div>
        )
      })}
    </>
  )
}

// --- Inactive Meso Card ---

function InactiveMesoCard({ meso }: { meso: MesocycleListItem }) {
  return (
    <Link
      to={`/mesocycles/${meso.id}`}
      className="compact-card p-4 block stagger"
      style={{ opacity: 0.6 }}
    >
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-2">
          <span className="text-[15px] font-medium" style={{ color: '#94a3b8' }}>{meso.name}</span>
          <span
            className="text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded"
            style={{ color: '#64748b', background: 'rgba(100,116,139,0.1)', border: '1px solid rgba(100,116,139,0.15)' }}
          >
            Done
          </span>
        </div>
        <ChevronRightIcon className="w-4 h-4 shrink-0 text-[#334155]" />
      </div>
      <div className="flex items-center gap-1.5">
        <span className="text-[11px]" style={{ color: '#475569' }}>{meso.split_name}</span>
        <span className="text-[11px]" style={{ color: '#334155' }}>&middot;</span>
        <span className="mono text-[11px]" style={{ color: '#475569' }}>{meso.total_weeks} weeks</span>
        <span className="text-[11px]" style={{ color: '#334155' }}>&middot;</span>
        <span className="mono text-[11px]" style={{ color: '#475569' }}>{meso.workouts_completed}/{meso.total_workouts}</span>
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

  const getRirSchemePreview = (weeks: number): string => {
    if (weeks <= 1) return 'RiR: 0'
    if (weeks === 2) return 'RiR: 2 \u2192 Deload'
    if (weeks === 3) return 'RiR: 3 \u2192 1 \u2192 Deload'
    if (weeks === 4) return 'RiR: 3 \u2192 2 \u2192 1 \u2192 Deload'
    if (weeks === 5) return 'RiR: 3 \u2192 2 \u2192 1 \u2192 0 \u2192 Deload'
    return 'RiR: 3 \u2192 ... \u2192 0 \u2192 Deload'
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
          disabled={createMesocycle.isPending || !name || !splitId}
          className="btn btn-primary flex-1 disabled:opacity-50"
        >
          {createMesocycle.isPending ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  )
}
