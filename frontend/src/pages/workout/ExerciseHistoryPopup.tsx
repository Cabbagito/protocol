import { SET_TYPE_LABELS } from '../../lib/setConstants'
import { formatWeight } from '../../lib/weightUtils'
import type { ExerciseSessionHistory } from '../../lib/exerciseHistory'
import type { MesoSet } from '../../types'

interface ExerciseHistoryPopupProps {
  exerciseName: string
  muscleGroup: string
  equipmentType: string
  history: ExerciseSessionHistory[]
  onClose: () => void
}

type HistorySetState = 'logged' | 'exceeded' | 'under'

function getHistorySetState(set: MesoSet): HistorySetState {
  if (set.set_type === 'myorep_match') return 'logged'
  if (set.target_reps == null) return 'logged'
  if ((set.reps ?? 0) > set.target_reps) return 'exceeded'
  if ((set.reps ?? 0) < set.target_reps) return 'under'
  return 'logged'
}

const STATE_COLORS: Record<HistorySetState, string> = {
  logged: 'var(--accent-l)',
  exceeded: '#c084fc',
  under: '#f87171',
}

function formatDate(date: string | null): string | null {
  if (!date) return null
  try {
    const d = new Date(date + 'T00:00:00')
    return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
  } catch {
    return null
  }
}

export function ExerciseHistoryPopup({ exerciseName, muscleGroup, equipmentType, history, onClose }: ExerciseHistoryPopupProps) {
  return (
    <div className="fixed inset-0 z-[102] flex items-center justify-center px-4" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative w-full max-w-sm rounded-2xl flex flex-col slide-up"
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          maxHeight: '80vh',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-3 flex items-start justify-between flex-shrink-0" style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
          <div>
            <h3 className="text-[15px] font-semibold text-[var(--text-1)]">{exerciseName}</h3>
            <span className="text-[11px] uppercase tracking-wider font-medium text-[var(--text-m)] capitalize">
              {muscleGroup} · {equipmentType}
            </span>
          </div>
          <button onClick={onClose} className="p-1.5 -mr-1 -mt-0.5 rounded-lg active:bg-white/5">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--text-m)" strokeWidth={2} strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="px-4 py-3 overflow-y-auto flex-1 space-y-2">
          {history.map((session, i) => {
            const totalReps = session.sets.reduce((sum, s) => sum + (s.reps ?? 0), 0)
            const weights = session.sets.filter(s => s.weight != null).map(s => s.weight!)
            const avgWeight = weights.length > 0 ? weights.reduce((a, b) => a + b, 0) / weights.length : 0

            return (
              <div
                key={i}
                className="rounded-[10px] p-2.5"
                style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.04)' }}
              >
                {/* Session header */}
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[11px] font-medium uppercase tracking-wider" style={{ color: 'var(--accent-l)' }}>
                    Week {session.week_number}
                  </span>
                  <span className="text-[11px] text-[var(--text-m)]">·</span>
                  <span className="text-[12px] font-medium text-[var(--text-2)]">{session.session_name}</span>
                  {session.date && (
                    <>
                      <span className="text-[11px] text-[var(--text-m)]">·</span>
                      <span className="text-[12px] font-medium text-[var(--text-2)]">{formatDate(session.date)}</span>
                    </>
                  )}
                </div>
                <div className="text-[10px] mb-2 text-[var(--text-m)] truncate">{session.meso_name}</div>

                {/* Set rows */}
                <div className="space-y-1">
                  {session.sets.map(set => {
                    const state = getHistorySetState(set)
                    const color = STATE_COLORS[state]
                    const setType = set.set_type ?? 'straight'
                    const typeInfo = SET_TYPE_LABELS[setType]

                    return (
                      <div key={set.set_num} className="flex items-center gap-2 text-[12px]">
                        {/* Set number or type pill */}
                        <span className="w-5 flex justify-center">
                          {typeInfo ? (
                            <span
                              className="text-[9px] font-bold px-1 py-px rounded"
                              style={{
                                background: typeInfo.bg,
                                border: `1px solid ${typeInfo.border}`,
                                color: typeInfo.color,
                                lineHeight: '1.3',
                              }}
                            >
                              {typeInfo.label}
                            </span>
                          ) : (
                            <span className="font-mono font-medium text-[var(--text-m)]">{set.set_num}</span>
                          )}
                        </span>

                        {/* State dot */}
                        <span
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ background: typeInfo ? typeInfo.color : color }}
                        />

                        {/* Weight */}
                        <span className="font-mono font-medium" style={{ color: typeInfo ? typeInfo.color : color }}>
                          {set.weight != null ? `${formatWeight(set.weight)}kg` : '–'}
                        </span>

                        <span className="text-[var(--text-m)]">×</span>

                        {/* Reps */}
                        <span className="font-mono font-medium" style={{ color: typeInfo ? typeInfo.color : color }}>
                          {set.reps ?? '–'}
                        </span>
                      </div>
                    )
                  })}
                </div>

                {/* Summary line */}
                <div className="mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.04)' }}>
                  <span className="text-[11px] font-mono text-[var(--text-m)]">
                    {session.sets.length} sets · {formatWeight(avgWeight)}kg · {totalReps} reps
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
