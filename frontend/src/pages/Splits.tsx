import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ChevronRightIcon } from '../components/Icons'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import ProtocolMark from '../components/ProtocolMark'
import { useSplits, useSplit } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import type { SplitListItem } from '../types'

export default function Splits() {
  const { data: splits = [], isLoading } = useSplits()
  const navigate = useNavigate()

  return (
    <div>
      <AppHeader
        title="Splits"
        subtitle={`${splits.length} splits`}
        rightContent={
          <button onClick={() => navigate('/splits/new')} className="plus-btn">
            <svg className="w-3.5 h-3.5" style={{ color: 'var(--accent-l)' }} fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            <span className="text-xs font-medium" style={{ color: 'var(--accent-l)' }}>New</span>
          </button>
        }
      />

      <div className="px-4 space-y-3">
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
            onClick={() => navigate('/splits/new')}
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

  // Compute volume per muscle group across all days
  const volumeData = useMemo(() => {
    if (!splitDetail) return []
    const volumeMap: Record<string, number> = {}
    for (const day of splitDetail.days) {
      for (const ex of day.exercises) {
        const mg = ex.muscle_group || 'unknown'
        volumeMap[mg] = (volumeMap[mg] || 0) + 1
      }
    }
    return Object.entries(volumeMap)
      .map(([group, count]) => ({ group, count }))
      .sort((a, b) => b.count - a.count)
  }, [splitDetail])

  const maxVolume = volumeData.length > 0 ? volumeData[0]!.count : 1

  // Compute dominant muscle group per day for schedule strip colors
  const dayColors = useMemo(() => {
    if (!splitDetail) return []
    return splitDetail.days.map((day) => {
      const mgCounts: Record<string, number> = {}
      for (const ex of day.exercises) {
        const mg = ex.muscle_group || 'unknown'
        mgCounts[mg] = (mgCounts[mg] || 0) + 1
      }
      let dominant = ''
      let maxCount = 0
      for (const [mg, count] of Object.entries(mgCounts)) {
        if (count > maxCount) { dominant = mg; maxCount = count }
      }
      return dominant ? getMuscleColor(dominant) : null
    })
  }, [splitDetail])

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
            {splitDetail.days.map((day, idx) => {
              const color = dayColors[idx]
              return (
                <div key={day.id} className="day-cell">
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
                    {day.name}
                  </span>
                </div>
              )
            })}
          </div>

          {/* Volume bars */}
          {volumeData.length > 0 && (
            <div className="space-y-1.5" style={{ padding: '8px 10px', background: 'var(--deep)', borderRadius: 8 }}>
              {volumeData.map(({ group, count }) => {
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
                          width: `${(count / maxVolume) * 100}%`,
                          background: color.primary,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                    <span className="mono text-[9px] w-5 text-right" style={{ color: 'var(--text-m)' }}>
                      {count}
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
