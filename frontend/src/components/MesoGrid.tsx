import { useNavigate, Link } from 'react-router-dom'
import type { Mesocycle } from '../types'

type CellState = 'done' | 'current' | 'pending' | 'deload-done' | 'deload-current' | 'deload-pending'

const cellStyles: Record<CellState, React.CSSProperties> = {
  done: {
    background: 'rgba(34,197,94,0.12)',
    border: '1.5px solid rgba(34,197,94,0.25)',
  },
  current: {
    background: 'rgba(2,132,199,0.15)',
    border: '2px solid #0284c7',
    animation: 'pulse-current 2s ease-in-out infinite',
  },
  pending: {
    background: '#162a3e',
    border: '1.5px solid #244868',
  },
  'deload-done': {
    background: 'rgba(234,179,8,0.12)',
    border: '1.5px solid rgba(234,179,8,0.25)',
  },
  'deload-current': {
    background: 'rgba(234,179,8,0.15)',
    border: '2px solid #eab308',
    animation: 'pulse-deload 2s ease-in-out infinite',
  },
  'deload-pending': {
    background: 'rgba(234,179,8,0.06)',
    border: '1.5px solid rgba(234,179,8,0.12)',
  },
}

function CheckIcon({ color }: { color: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2.5 6L5 8.5L9.5 3.5" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export default function MesoGrid({ mesocycle, compact = false }: { mesocycle: Mesocycle; compact?: boolean }) {
  const navigate = useNavigate()

  const weeks = mesocycle.structure.weeks
  const numWeeks = weeks.length
  const sessionNames = weeks[0]?.sessions.map(s => s.session_name) ?? []

  // Find the first unlogged session
  let currentWi = -1
  let currentSi = -1
  outer: for (let wi = 0; wi < numWeeks; wi++) {
    const week = weeks[wi]!
    for (let si = 0; si < week.sessions.length; si++) {
      const session = week.sessions[si]!
      const isLogged =
        session.exercises.length > 0 &&
        session.exercises.every(ex => ex.sets.every(s => s.logged))
      if (!isLogged) {
        currentWi = wi
        currentSi = si
        break outer
      }
    }
  }

  function getCellState(wi: number, si: number): CellState {
    const session = weeks[wi]!.sessions[si]!
    const isLogged =
      session.exercises.length > 0 &&
      session.exercises.every(ex => ex.sets.every(s => s.logged))
    const isDeload = mesocycle.rir_scheme[wi] === -1
    const isCurrent = wi === currentWi && si === currentSi

    if (isDeload) {
      if (isLogged) return 'deload-done'
      if (isCurrent) return 'deload-current'
      return 'deload-pending'
    }
    if (isLogged) return 'done'
    if (isCurrent) return 'current'
    return 'pending'
  }

  function handleClick(wi: number, si: number) {
    const session = weeks[wi]!.sessions[si]!
    const isLogged =
      session.exercises.length > 0 &&
      session.exercises.every(ex => ex.sets.every(s => s.logged))

    if (isLogged) {
      navigate(`/workouts/${mesocycle.id}/${wi}/${si}`)
    } else {
      navigate(`/workout/${mesocycle.id}?week=${wi}&session=${si}`)
    }
  }

  const useFixedWidth = numWeeks > 5
  const gridTemplateColumns = useFixedWidth
    ? `40px repeat(${numWeeks}, 44px)`
    : `40px repeat(${numWeeks}, 1fr)`

  const gridContent = (
    <div
      className="overflow-x-auto"
      style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
    >
      <style>{`.meso-grid-scroll::-webkit-scrollbar { display: none; }`}</style>
      <div
        className="meso-grid-scroll"
        style={{
          display: 'grid',
          gridTemplateColumns,
          gap: 6,
          alignItems: 'center',
          minWidth: useFixedWidth ? undefined : 'auto',
        }}
      >
        {/* Header row */}
        <div /> {/* empty corner cell */}
        {weeks.map((week, wi) => {
          const isDeload = mesocycle.rir_scheme[wi] === -1
          return (
            <div
              key={wi}
              className="text-center"
              style={{ lineHeight: 1.2 }}
            >
              <div className="text-[10px] font-medium text-slate-400">
                W{wi + 1}
              </div>
              <div
                className="text-[10px]"
                style={{ color: isDeload ? '#eab308' : '#64748b' }}
              >
                {isDeload ? 'DL' : `R${week.rir}`}
              </div>
            </div>
          )
        })}

        {/* Session rows */}
        {sessionNames.map((name, si) => (
          <>
            <div
              key={`label-${si}`}
              className="text-[10px] font-medium text-slate-500 truncate pr-1"
              title={name}
            >
              {name}
            </div>
            {weeks.map((_, wi) => {
              const state = getCellState(wi, si)
              const isCurrent = state === 'current' || state === 'deload-current'
              const isDone = state === 'done' || state === 'deload-done'

              return (
                <button
                  key={`${wi}-${si}`}
                  onClick={() => handleClick(wi, si)}
                  style={{
                    width: 24,
                    height: 24,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    justifySelf: 'center',
                    cursor: 'pointer',
                    padding: 0,
                    ...cellStyles[state],
                  }}
                >
                  {isDone && (
                    <CheckIcon
                      color={state === 'deload-done' ? '#eab308' : '#22c55e'}
                    />
                  )}
                  {isCurrent && (
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: state === 'deload-current' ? '#eab308' : '#0284c7',
                      }}
                    />
                  )}
                </button>
              )
            })}
          </>
        ))}
      </div>
    </div>
  )

  if (compact) return gridContent

  return (
    <div className="card">
      <div className="flex items-start justify-between mb-3">
        <h2 className="font-semibold text-slate-200">{mesocycle.name}</h2>
        <Link to={`/mesocycles/${mesocycle.id}`} className="text-protocol-400 text-sm">
          View
        </Link>
      </div>
      {gridContent}
    </div>
  )
}
