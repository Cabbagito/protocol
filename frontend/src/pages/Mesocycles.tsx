import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import PageLoader from '../components/PageLoader'
import { useToast } from '../components/Toast'
import {
  useMesocycles,
  useActiveMesocycle,
  useCreateMesocycle,
  useSplits,
} from '../api/hooks'
import { getCurrentPosition } from '../lib/mesoUtils'
import { getMuscleColor } from '../lib/muscleColors'
import type { MesocycleListItem, Mesocycle } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

export default function Mesocycles() {
  const navigate = useNavigate()
  const { data: mesocycles = [], isLoading } = useMesocycles()
  const { data: activeMeso } = useActiveMesocycle()
  const [createOpen, setCreateOpen] = useState(false)

  const activeMesos = mesocycles.filter((m) => m.is_active)
  const archived = mesocycles.filter((m) => !m.is_active)
  const primaryActive = activeMeso ?? activeMesos[0] ?? null
  const secondaryActive = activeMesos.filter((m) => m.id !== primaryActive?.id)

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
        <Chrome
          title="Mesocycles"
          sub={`${activeMesos.length} ACTIVE · ${archived.length} ARCHIVED`}
          onBack={() => navigate(-1)}
        />

        {isLoading ? (
          <PageLoader />
        ) : mesocycles.length === 0 ? (
          <EmptyState onCreate={() => setCreateOpen(true)} />
        ) : (
          <>
            {primaryActive && <PrimaryActiveCard meso={primaryActive} />}

            {secondaryActive.map((m) => (
              <SecondaryActiveCard key={m.id} meso={m} />
            ))}

            {archived.length > 0 && (
              <div style={{ marginTop: 22 }}>
                <Eyebrow>Archived · {archived.length}</Eyebrow>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
                  {archived.map((m) => (
                    <ArchivedRow key={m.id} meso={m} />
                  ))}
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 52,
                marginTop: 18,
                borderRadius: 14,
                background: 'var(--p-grad)',
                color: 'var(--btn-text)',
                fontWeight: 700,
                fontSize: 13,
                letterSpacing: '0.05em',
                border: 'none',
                cursor: 'pointer',
                boxShadow:
                  '0 14px 40px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 4v16M4 12h16" />
              </svg>
              New mesocycle
            </button>
          </>
        )}
      </div>

      {createOpen && (
        <CreateMesoDialog
          onClose={() => setCreateOpen(false)}
          onCreated={(id) => {
            setCreateOpen(false)
            navigate(`/mesocycles/${id}`)
          }}
        />
      )}
    </div>
  )
}

/* ─── Chrome header ─────────────────────────────────────────────── */

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
      <div style={{ textAlign: 'center' }}>
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

/* ─── Primary active hero ───────────────────────────────────────── */

function PrimaryActiveCard({ meso }: { meso: MesocycleListItem | Mesocycle }) {
  // Build the per-session mini-strip. If we have the full structure
  // (active fetched via /active), use it. Otherwise fall back to
  // workouts_completed / total_workouts.
  const ticks = useMemo(() => buildTicks(meso), [meso])

  const sessionsTotal = ticks.length || (meso as MesocycleListItem).total_workouts || 0
  const sessionsDone = ticks.filter((t) => t === 'done').length
  const pct = sessionsTotal > 0 ? Math.round((sessionsDone / sessionsTotal) * 100) : 0

  return (
    <Link
      to={`/mesocycles/${meso.id}`}
      style={{
        display: 'block',
        borderRadius: 20,
        padding: 20,
        position: 'relative',
        overflow: 'hidden',
        textDecoration: 'none',
        color: 'inherit',
        background:
          'linear-gradient(180deg, rgba(var(--accent-rgb),0.14), rgba(15,29,46,0.6))',
        border: '1px solid rgba(var(--accent-rgb),0.30)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
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
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 9, color: 'var(--accent-l)', letterSpacing: '0.28em', fontFamily: MONO, fontWeight: 600 }}>
            ACTIVE · WEEK {meso.current_week}
          </div>
          <div
            className="p-display"
            style={{
              fontSize: 30,
              color: 'var(--text-1)',
              lineHeight: 1,
              marginTop: 6,
              letterSpacing: '-0.02em',
            }}
          >
            {meso.name}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-m)',
              marginTop: 6,
              letterSpacing: '0.18em',
              fontFamily: MONO,
              textTransform: 'uppercase',
            }}
          >
            {meso.split_name} · {meso.total_weeks} WEEKS
          </div>
        </div>
        <div style={{ textAlign: 'right', flexShrink: 0 }}>
          <div
            className="p-grad-text"
            style={{
              fontSize: 32,
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1,
              fontFamily: MONO,
            }}
          >
            {pct}
            <span style={{ fontSize: 14, opacity: 0.6 }}>%</span>
          </div>
          <div
            style={{
              fontSize: 9,
              color: 'var(--text-m)',
              letterSpacing: '0.18em',
              marginTop: 4,
              fontFamily: MONO,
            }}
          >
            {sessionsTotal} SESSIONS
          </div>
        </div>
      </div>

      {ticks.length > 0 && (
        <div style={{ position: 'relative', display: 'flex', gap: 4, marginTop: 18 }}>
          {ticks.map((state, i) => {
            const isCurrent = state === 'current'
            const isDone = state === 'done'
            return (
              <div
                key={i}
                style={{
                  flex: 1,
                  height: isCurrent ? 6 : 4,
                  borderRadius: 2,
                  background: isDone
                    ? 'var(--accent-l)'
                    : isCurrent
                      ? 'color-mix(in oklab, var(--accent) 60%, rgba(255,255,255,0.06))'
                      : 'rgba(255,255,255,0.05)',
                  boxShadow: isDone || isCurrent ? '0 0 6px var(--accent)' : 'none',
                  alignSelf: 'center',
                }}
              />
            )
          })}
        </div>
      )}
    </Link>
  )
}

function buildTicks(meso: MesocycleListItem | Mesocycle): ('done' | 'current' | 'queued')[] {
  if ('structure' in meso && meso.structure) {
    const ticks: ('done' | 'current' | 'queued')[] = []
    const pos = getCurrentPosition(meso.structure)
    for (let wi = 0; wi < meso.structure.weeks.length; wi++) {
      const week = meso.structure.weeks[wi]!
      for (let si = 0; si < week.sessions.length; si++) {
        const session = week.sessions[si]!
        const nonSkipped = session.exercises.filter((ex) => !ex.skipped)
        const allLogged =
          nonSkipped.length > 0 && nonSkipped.every((ex) => ex.sets.every((s) => s.logged))
        if (allLogged) ticks.push('done')
        else if (pos && pos.weekIndex === wi && pos.sessionIndex === si) ticks.push('current')
        else ticks.push('queued')
      }
    }
    return ticks
  }
  const total = (meso as MesocycleListItem).total_workouts
  const done = (meso as MesocycleListItem).workouts_completed
  const ticks: ('done' | 'current' | 'queued')[] = []
  for (let i = 0; i < total; i++) {
    ticks.push(i < done ? 'done' : i === done ? 'current' : 'queued')
  }
  return ticks
}

/* ─── Secondary active (compact) ────────────────────────────────── */

function SecondaryActiveCard({ meso }: { meso: MesocycleListItem }) {
  const color = getMuscleColor(meso.split_name.toLowerCase().includes('run') ? 'quads' : 'back')
  const accent = meso.split_color || color.primary
  const accentLight = color.light
  const pct =
    meso.total_workouts > 0 ? Math.round((meso.workouts_completed / meso.total_workouts) * 100) : 0

  return (
    <Link
      to={`/mesocycles/${meso.id}`}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        marginTop: 12,
        padding: 16,
        borderRadius: 14,
        background: 'rgba(15,29,46,0.5)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 3,
          height: 46,
          borderRadius: 2,
          background: `linear-gradient(180deg, ${accent}, ${accentLight})`,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 9,
            color: accentLight,
            letterSpacing: '0.22em',
            fontFamily: MONO,
            fontWeight: 600,
          }}
        >
          ACTIVE · WEEK {meso.current_week}
        </div>
        <div
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: 'var(--text-1)',
            marginTop: 2,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meso.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-m)',
            marginTop: 2,
            letterSpacing: '0.15em',
            fontFamily: MONO,
            textTransform: 'uppercase',
          }}
        >
          {meso.split_name} · {meso.total_weeks} WEEKS · {pct}%
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-m)" strokeWidth={2} strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </Link>
  )
}

/* ─── Archived row ──────────────────────────────────────────────── */

function ArchivedRow({ meso }: { meso: MesocycleListItem }) {
  const pct =
    meso.total_workouts > 0 ? Math.round((meso.workouts_completed / meso.total_workouts) * 100) : 0
  const dateLabel = formatDateRange(meso.started_at, meso.total_weeks)
  return (
    <Link
      to={`/mesocycles/${meso.id}`}
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        background: 'rgba(15,29,46,0.4)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'rgba(255,255,255,0.15)' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: 'var(--text-2)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {meso.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-m)',
            marginTop: 2,
            letterSpacing: '0.1em',
            fontFamily: MONO,
          }}
        >
          {dateLabel}
        </div>
      </div>
      <span style={{ fontSize: 10, color: 'var(--text-m)', fontFamily: MONO }}>{pct}%</span>
    </Link>
  )
}

function formatDateRange(startedAt: string, weeks: number): string {
  const start = new Date(startedAt + 'T00:00:00')
  if (Number.isNaN(start.getTime())) return startedAt
  const end = new Date(start)
  end.setDate(end.getDate() + weeks * 7)
  const fmt = (d: Date) =>
    d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  return `${fmt(start)} — ${fmt(end)}`
}

/* ─── Create dialog ─────────────────────────────────────────────── */

function CreateMesoDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: (id: string) => void
}) {
  const toast = useToast()
  const { data: splits = [] } = useSplits()
  const createMeso = useCreateMesocycle()
  const [name, setName] = useState('')
  const [splitId, setSplitId] = useState<string>('')
  const [weeks, setWeeks] = useState(4)

  useEffect(() => {
    if (!splitId && splits.length > 0) setSplitId(splits[0]!.id)
  }, [splits, splitId])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !splitId) return
    try {
      const result = await createMeso.mutateAsync({
        name: name.trim(),
        split_id: splitId,
        total_weeks: weeks,
      })
      onCreated((result as { id: string }).id)
    } catch {
      toast.showError('Failed to create mesocycle')
    }
  }

  return (
    <div
      className="fixed inset-0 z-[102] flex items-center justify-center px-4"
      onClick={onClose}
    >
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      />
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm rounded-2xl slide-up"
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          padding: 20,
        }}
      >
        <div className="p-display" style={{ fontSize: 22, color: 'var(--text-1)' }}>
          New mesocycle
        </div>
        <div style={{ fontSize: 11, color: 'var(--text-m)', marginTop: 4, fontFamily: MONO, letterSpacing: '0.18em' }}>
          START A NEW BLOCK
        </div>

        <div style={{ marginTop: 18 }}>
          <Eyebrow>Name</Eyebrow>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Mass — Phase 2"
            autoFocus
            style={{
              marginTop: 8,
              width: '100%',
              padding: '10px 12px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-1)',
              fontSize: 14,
              outline: 'none',
            }}
          />
        </div>

        <div style={{ marginTop: 14 }}>
          <Eyebrow>Split</Eyebrow>
          {splits.length === 0 ? (
            <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-m)' }}>
              No splits yet —{' '}
              <Link to="/splits/new" style={{ color: 'var(--accent-l)' }}>
                create one first
              </Link>
              .
            </div>
          ) : (
            <select
              value={splitId}
              onChange={(e) => setSplitId(e.target.value)}
              style={{
                marginTop: 8,
                width: '100%',
                padding: '10px 12px',
                borderRadius: 10,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'var(--text-1)',
                fontSize: 14,
                outline: 'none',
              }}
            >
              {splits.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          )}
        </div>

        <div style={{ marginTop: 14 }}>
          <Eyebrow>Weeks</Eyebrow>
          <div
            style={{
              marginTop: 8,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
            }}
          >
            <button
              type="button"
              onClick={() => setWeeks(Math.max(3, weeks - 1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              −
            </button>
            <span
              style={{
                fontFamily: MONO,
                fontSize: 22,
                fontWeight: 700,
                color: 'var(--text-1)',
              }}
            >
              {weeks}
            </span>
            <button
              type="button"
              onClick={() => setWeeks(Math.min(8, weeks + 1))}
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.06)',
                color: 'var(--text-2)',
                cursor: 'pointer',
              }}
            >
              +
            </button>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, marginTop: 22 }}>
          <button
            type="button"
            onClick={onClose}
            style={{
              flex: 1,
              height: 44,
              borderRadius: 12,
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-2)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={createMeso.isPending || !name.trim() || !splitId}
            style={{
              flex: 2,
              height: 44,
              borderRadius: 12,
              background: 'var(--p-grad)',
              color: 'var(--btn-text)',
              fontSize: 13,
              fontWeight: 700,
              letterSpacing: '0.05em',
              border: 'none',
              cursor: 'pointer',
              opacity: createMeso.isPending || !name.trim() || !splitId ? 0.5 : 1,
            }}
          >
            {createMeso.isPending ? 'Creating…' : 'Create'}
          </button>
        </div>
      </form>
    </div>
  )
}

/* ─── Empty state ───────────────────────────────────────────────── */

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div
      style={{
        marginTop: 40,
        padding: '40px 22px',
        borderRadius: 16,
        textAlign: 'center',
        background: 'rgba(15,29,46,0.4)',
        border: '1px dashed rgba(255,255,255,0.08)',
      }}
    >
      <div className="p-display" style={{ fontSize: 22, color: 'var(--text-1)' }}>
        No mesocycles yet
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-m)', marginTop: 8 }}>
        Start a training block to track your progress.
      </div>
      <button
        onClick={onCreate}
        style={{
          marginTop: 18,
          padding: '10px 20px',
          borderRadius: 12,
          background: 'var(--p-grad)',
          color: 'var(--btn-text)',
          fontWeight: 700,
          fontSize: 13,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        New mesocycle
      </button>
    </div>
  )
}
