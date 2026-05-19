import { Link, useNavigate, useParams } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import PageLoader from '../components/PageLoader'
import { useToast } from '../components/Toast'
import {
  useMesocycle,
  useUpdateMesocycle,
  useDeleteMesocycle,
} from '../api/hooks'
import { getCurrentPosition } from '../lib/mesoUtils'
import { getVolumeByMuscleGroup } from '../lib/mesoAnalysis'
import { getMuscleColor } from '../lib/muscleColors'
import type { Mesocycle, MesoSession } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

type CellState = 'done' | 'current' | 'queued'

export default function MesocycleDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const toast = useToast()
  const { data: mesocycle, isLoading } = useMesocycle(id!)
  const updateMeso = useUpdateMesocycle(id!)
  const deleteMeso = useDeleteMesocycle()

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--deep)' }}>
        <PageLoader className="min-h-[60vh]" />
      </div>
    )
  }
  if (!mesocycle) {
    return (
      <div
        style={{
          minHeight: '100vh',
          background: 'var(--deep)',
          color: 'var(--text-2)',
          padding: 32,
          textAlign: 'center',
        }}
      >
        Mesocycle not found.
      </div>
    )
  }

  const sessionNames = mesocycle.structure.weeks[0]?.sessions.map((s) => s.session_name) ?? []
  const sessionsPerWeek = sessionNames.length
  const weekCount = mesocycle.structure.weeks.length
  const pos = getCurrentPosition(mesocycle.structure)

  const grid: CellState[][] = mesocycle.structure.weeks.map((week, wi) =>
    week.sessions.map((session, si) => sessionState(session, wi, si, pos)),
  )

  const flat = grid.flat()
  const totalSessions = flat.length
  const doneSessions = flat.filter((s) => s === 'done').length
  const pct = totalSessions > 0 ? Math.round((doneSessions / totalSessions) * 100) : 0

  const next = findNextSession(mesocycle)
  const volume = getVolumeByMuscleGroup(mesocycle)
  const peakVolume = volume[0]?.sets ?? 1

  async function handleArchive() {
    if (!mesocycle) return
    try {
      await updateMeso.mutateAsync({ is_active: !mesocycle.is_active })
      toast.showSuccess(mesocycle.is_active ? 'Mesocycle archived' : 'Mesocycle reactivated')
    } catch {
      toast.showError('Failed to update mesocycle')
    }
  }

  async function handleDelete() {
    if (!mesocycle) return
    if (!confirm('Delete this mesocycle and all its workout logs?')) return
    try {
      await deleteMeso.mutateAsync(mesocycle.id)
      navigate('/mesocycles')
    } catch {
      toast.showError('Failed to delete mesocycle')
    }
  }

  const eyebrow = mesocycle.is_active ? 'MESOCYCLE · ACTIVE' : 'MESOCYCLE · ARCHIVED'
  const currentWeekLabel = pos ? pos.weekIndex + 1 : mesocycle.current_week

  return (
    <div
      style={{
        position: 'relative',
        minHeight: '100vh',
        background: 'var(--deep)',
        overflow: 'hidden',
      }}
    >
      <AuroraBackground />

      <div style={{ position: 'relative', zIndex: 1, padding: '12px 22px 130px' }}>
        <Chrome title={mesocycle.name} sub={eyebrow} onBack={() => navigate('/mesocycles')} />

        {/* Hero progress */}
        <div style={{ textAlign: 'center', padding: '4px 0 22px' }}>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-m)',
              letterSpacing: '0.28em',
              fontFamily: MONO,
              fontWeight: 600,
            }}
          >
            PROGRESS
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'center',
              gap: 6,
              marginTop: 10,
            }}
          >
            <div
              className="p-grad-text"
              style={{
                fontSize: 78,
                fontWeight: 700,
                letterSpacing: '-0.05em',
                lineHeight: 0.9,
                fontFamily: MONO,
                filter: 'drop-shadow(0 0 28px rgba(var(--accent-rgb),0.35))',
              }}
            >
              {pct}
            </div>
            <div
              className="p-grad-text"
              style={{ fontSize: 30, fontWeight: 500, lineHeight: 1, opacity: 0.7, fontFamily: MONO }}
            >
              %
            </div>
          </div>
          <div
            style={{
              fontSize: 11,
              color: 'var(--accent-l)',
              marginTop: 6,
              letterSpacing: '0.2em',
              fontFamily: MONO,
              fontWeight: 500,
            }}
          >
            {doneSessions} / {totalSessions} SESSIONS · WEEK {currentWeekLabel} OF {weekCount}
          </div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-m)',
              marginTop: 6,
              letterSpacing: '0.22em',
              fontFamily: MONO,
              textTransform: 'uppercase',
            }}
          >
            {mesocycle.split_name} · {sessionsPerWeek}× WEEK
          </div>
        </div>

        {/* Week × session grid */}
        <div
          style={{
            padding: 16,
            borderRadius: 18,
            background: 'rgba(15,29,46,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Header row */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: `60px repeat(${weekCount}, 1fr)`,
              gap: 6,
              alignItems: 'center',
              marginBottom: 8,
            }}
          >
            <div />
            {mesocycle.structure.weeks.map((_, wi) => (
              <div
                key={wi}
                style={{
                  fontSize: 9,
                  color: 'var(--text-m)',
                  letterSpacing: '0.18em',
                  textAlign: 'center',
                  fontFamily: MONO,
                  fontWeight: 600,
                }}
              >
                W{wi + 1}
              </div>
            ))}
          </div>

          {/* Session rows */}
          {sessionNames.map((sName, ri) => (
            <div
              key={ri}
              style={{
                display: 'grid',
                gridTemplateColumns: `60px repeat(${weekCount}, 1fr)`,
                gap: 6,
                alignItems: 'center',
                marginBottom: ri < sessionNames.length - 1 ? 5 : 0,
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: 'var(--text-2)',
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  fontFamily: MONO,
                }}
              >
                {sName}
              </div>
              {mesocycle.structure.weeks.map((_, wi) => {
                const st = grid[wi]?.[ri] ?? 'queued'
                return <GridCell key={wi} state={st} />
              })}
            </div>
          ))}
        </div>

        {/* Up-next CTA */}
        {mesocycle.is_active && next && (
          <Link
            to={`/workout/${mesocycle.id}?week=${next.weekIndex}&session=${next.sessionIndex}`}
            style={{ display: 'block', marginTop: 14, textDecoration: 'none', color: 'inherit' }}
          >
            <div
              style={{
                padding: 16,
                borderRadius: 16,
                position: 'relative',
                overflow: 'hidden',
                background:
                  'linear-gradient(180deg, rgba(var(--accent-rgb),0.12), rgba(15,29,46,0.6))',
                border: '1px solid rgba(var(--accent-rgb),0.30)',
                backdropFilter: 'blur(24px)',
                WebkitBackdropFilter: 'blur(24px)',
                boxShadow: '0 20px 50px -22px rgba(var(--accent-rgb),0.45)',
              }}
            >
              <div
                aria-hidden
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  background:
                    'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(var(--accent-rgb),0.20), transparent 70%)',
                }}
              />
              <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div
                  style={{
                    width: 4,
                    height: 50,
                    borderRadius: 2,
                    background: 'var(--p-grad-cta)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 9,
                      color: 'var(--text-m)',
                      letterSpacing: '0.22em',
                      fontFamily: MONO,
                      fontWeight: 600,
                    }}
                  >
                    NEXT SESSION
                  </div>
                  <div
                    style={{
                      fontSize: 18,
                      fontWeight: 600,
                      color: 'var(--text-1)',
                      marginTop: 3,
                      letterSpacing: '-0.01em',
                    }}
                  >
                    {next.session.session_name} · Week {next.weekIndex + 1}
                  </div>
                  <div
                    style={{
                      fontSize: 10,
                      color: 'var(--text-m)',
                      marginTop: 2,
                      letterSpacing: '0.18em',
                      fontFamily: MONO,
                    }}
                  >
                    {next.session.exercises.filter((e) => !e.skipped).length} LIFTS
                  </div>
                </div>
                <div
                  style={{
                    height: 42,
                    padding: '0 16px',
                    borderRadius: 12,
                    background: 'var(--p-grad-cta)',
                    color: 'var(--btn-text)',
                    fontSize: 12,
                    fontWeight: 500,
                    letterSpacing: '0.18em',
                    fontFamily: MONO,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    boxShadow: '0 6px 20px -6px rgba(var(--accent-rgb),0.6)',
                  }}
                >
                  START
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </div>
              </div>
            </div>
          </Link>
        )}

        {/* Volume by muscle */}
        {volume.length > 0 && (
          <div style={{ marginTop: 22 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 12,
              }}
            >
              <Eyebrow>Volume · this week</Eyebrow>
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--text-m)',
                  letterSpacing: '0.18em',
                  fontFamily: MONO,
                  fontWeight: 600,
                }}
              >
                SETS / PEAK
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 8,
                padding: 14,
                borderRadius: 14,
                background: 'rgba(15,29,46,0.4)',
                border: '1px solid rgba(255,255,255,0.05)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
              }}
            >
              {volume.map((v) => {
                const color = getMuscleColor(v.muscleGroup)
                const ratio = peakVolume > 0 ? Math.min(100, (v.sets / peakVolume) * 100) : 0
                return (
                  <div
                    key={v.muscleGroup}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '92px 1fr 64px',
                      gap: 10,
                      alignItems: 'center',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: '50%',
                          background: color.primary,
                          boxShadow: `0 0 7px ${color.primary}`,
                        }}
                      />
                      <span
                        style={{
                          fontSize: 9,
                          color: color.light,
                          letterSpacing: '0.15em',
                          textTransform: 'uppercase',
                          fontFamily: MONO,
                          fontWeight: 600,
                        }}
                      >
                        {v.muscleGroup}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 6,
                        borderRadius: 3,
                        background: 'rgba(255,255,255,0.05)',
                        overflow: 'hidden',
                      }}
                    >
                      <div
                        style={{
                          width: `${ratio}%`,
                          height: '100%',
                          background: `linear-gradient(90deg, ${color.primary}, ${color.light})`,
                          boxShadow: `0 0 8px ${color.primary}`,
                        }}
                      />
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-2)',
                        textAlign: 'right',
                        fontFamily: MONO,
                      }}
                    >
                      {v.sets}
                      <span style={{ color: 'var(--text-m)' }}> / {peakVolume}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* Action row */}
        <div
          style={{
            marginTop: 18,
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 8,
          }}
        >
          <button
            onClick={handleArchive}
            disabled={updateMeso.isPending}
            style={{
              height: 46,
              borderRadius: 13,
              background: 'rgba(15,29,46,0.5)',
              border: '1px solid rgba(255,255,255,0.05)',
              backdropFilter: 'blur(20px)',
              color: 'var(--text-1)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {mesocycle.is_active ? 'Archive' : 'Reactivate'}
          </button>
          <button
            onClick={handleDelete}
            disabled={deleteMeso.isPending}
            style={{
              height: 46,
              borderRadius: 13,
              background: 'rgba(15,29,46,0.5)',
              border: '1px solid rgba(248,113,113,0.18)',
              backdropFilter: 'blur(20px)',
              color: 'rgba(248,113,113,0.85)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Delete
          </button>
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function sessionState(
  session: MesoSession,
  weekIndex: number,
  sessionIndex: number,
  pos: { weekIndex: number; sessionIndex: number } | null,
): CellState {
  const nonSkipped = session.exercises.filter((ex) => !ex.skipped)
  if (nonSkipped.length === 0) return 'queued'
  const allLogged = nonSkipped.every((ex) => ex.sets.every((s) => s.logged))
  if (allLogged) return 'done'
  if (pos && pos.weekIndex === weekIndex && pos.sessionIndex === sessionIndex) return 'current'
  return 'queued'
}

function findNextSession(
  meso: Mesocycle,
): { weekIndex: number; sessionIndex: number; session: MesoSession } | null {
  for (let wi = 0; wi < meso.structure.weeks.length; wi++) {
    const week = meso.structure.weeks[wi]!
    for (let si = 0; si < week.sessions.length; si++) {
      const session = week.sessions[si]!
      const nonSkipped = session.exercises.filter((ex) => !ex.skipped)
      if (nonSkipped.length === 0) continue
      const allLogged = nonSkipped.every((ex) => ex.sets.every((s) => s.logged))
      if (!allLogged) return { weekIndex: wi, sessionIndex: si, session }
    }
  }
  return null
}

/* ─── Subcomponents ─────────────────────────────────────────────── */

function GridCell({ state }: { state: CellState }) {
  if (state === 'current') {
    return (
      <div
        style={{
          height: 26,
          borderRadius: 7,
          background: 'var(--p-grad-cta)',
          display: 'grid',
          placeItems: 'center',
          boxShadow: '0 0 14px rgba(var(--accent-rgb),0.55)',
        }}
      >
        <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'white' }} />
      </div>
    )
  }
  if (state === 'done') {
    return (
      <div
        style={{
          height: 26,
          borderRadius: 7,
          background: 'rgba(var(--accent-rgb),0.18)',
          border: '1px solid rgba(var(--accent-rgb),0.30)',
          display: 'grid',
          placeItems: 'center',
        }}
      >
        <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--accent-l)" strokeWidth={3} strokeLinecap="round">
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </div>
    )
  }
  return (
    <div
      style={{
        height: 26,
        borderRadius: 7,
        background: 'rgba(255,255,255,0.03)',
        border: '1px solid rgba(255,255,255,0.06)',
      }}
    />
  )
}

function Chrome({ title, sub, onBack }: { title: string; sub: string; onBack: () => void }) {
  return (
    <div
      style={{
        padding: '4px 0 18px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <button
        onClick={onBack}
        aria-label="Back"
        style={{
          width: 36,
          height: 36,
          borderRadius: 12,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.05)',
          backdropFilter: 'blur(20px)',
          color: 'var(--text-2)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </button>
      <div style={{ textAlign: 'center', minWidth: 0, padding: '0 8px' }}>
        <div
          style={{
            fontSize: 9,
            color: 'var(--text-m)',
            letterSpacing: '0.22em',
            fontFamily: MONO,
            fontWeight: 500,
          }}
        >
          {sub}
        </div>
        <div
          className="p-display"
          style={{
            fontSize: 18,
            color: 'var(--text-1)',
            marginTop: 1,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {title}
        </div>
      </div>
      <div style={{ width: 36 }} />
    </div>
  )
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 600,
        letterSpacing: '0.18em',
        textTransform: 'uppercase',
        color: 'var(--text-m)',
        fontFamily: MONO,
      }}
    >
      {children}
    </div>
  )
}
