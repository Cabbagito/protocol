import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import PageLoader from '../components/PageLoader'
import { useSplits, useSplit, useActiveMesocycle } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import type { SplitListItem } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

export default function Splits() {
  const navigate = useNavigate()
  const { data: splits = [], isLoading } = useSplits()
  const { data: activeMeso } = useActiveMesocycle()
  const liveSplitId = activeMeso?.split_id ?? null

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
          title="Splits"
          sub={`${splits.length} TEMPLATE${splits.length === 1 ? '' : 'S'}`}
          onBack={() => navigate(-1)}
        />

        {isLoading ? (
          <PageLoader />
        ) : splits.length === 0 ? (
          <EmptyState onCreate={() => navigate('/splits/new')} />
        ) : (
          <>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {splits.map((split) => (
                <SplitCard
                  key={split.id}
                  split={split}
                  isLive={split.id === liveSplitId}
                />
              ))}
            </div>

            <button
              type="button"
              onClick={() => navigate('/splits/new')}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                width: '100%',
                height: 50,
                marginTop: 14,
                borderRadius: 14,
                background: 'transparent',
                border: '1px dashed rgba(255,255,255,0.08)',
                color: 'var(--accent-l)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              New split
            </button>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── Split card ───────────────────────────────────────────────── */

function SplitCard({ split, isLive }: { split: SplitListItem; isLive: boolean }) {
  const { data: detail } = useSplit(split.id)

  const days = useMemo(() => {
    if (!detail) return []
    return detail.days.map((d) => {
      const groups: string[] = []
      const seen = new Set<string>()
      for (const ex of d.exercises) {
        const mg = ex.muscle_group
        if (!seen.has(mg)) {
          seen.add(mg)
          groups.push(mg)
        }
      }
      return { name: d.name, groups }
    })
  }, [detail])

  const groupTotal = useMemo(
    () => days.reduce((acc, d) => acc + d.groups.length, 0),
    [days],
  )

  const accent = split.color || 'var(--accent)'
  const accentLight = lighten(split.color) || 'var(--accent-l)'

  return (
    <Link
      to={`/splits/${split.id}`}
      style={{
        position: 'relative',
        overflow: 'hidden',
        padding: 16,
        borderRadius: 18,
        background: isLive
          ? `linear-gradient(180deg, color-mix(in oklab, ${accent} 14%, rgba(15,29,46,0.5)), rgba(15,29,46,0.6))`
          : 'rgba(15,29,46,0.45)',
        border: isLive
          ? `1px solid color-mix(in oklab, ${accent} 35%, rgba(255,255,255,0.05))`
          : '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        textDecoration: 'none',
        color: 'inherit',
        display: 'block',
      }}
    >
      {isLive && (
        <div
          aria-hidden
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            background: `radial-gradient(ellipse 70% 50% at 0% 0%, color-mix(in oklab, ${accent} 18%, transparent), transparent 70%)`,
          }}
        />
      )}

      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
        <div
          style={{
            width: 4,
            height: 38,
            borderRadius: 2,
            background: `linear-gradient(180deg, ${accent}, ${accentLight})`,
            boxShadow: `0 0 12px ${accent}`,
          }}
        />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div
              style={{
                fontSize: 17,
                fontWeight: 600,
                color: 'var(--text-1)',
                letterSpacing: '-0.01em',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {split.name}
            </div>
            {isLive && (
              <span
                style={{
                  fontSize: 8,
                  color: accentLight,
                  letterSpacing: '0.22em',
                  padding: '2px 7px',
                  borderRadius: 100,
                  border: `1px solid color-mix(in oklab, ${accent} 40%, transparent)`,
                  background: `color-mix(in oklab, ${accent} 12%, transparent)`,
                  fontFamily: MONO,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                · LIVE
              </span>
            )}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-m)',
              marginTop: 3,
              letterSpacing: '0.18em',
              fontFamily: MONO,
              fontWeight: 600,
            }}
          >
            {split.day_count} DAYS{detail ? ` · ${groupTotal} GROUPS` : ''}
          </div>
        </div>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-m)" strokeWidth={2} strokeLinecap="round">
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {detail && (
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {days.map((d, di) => (
            <div
              key={di}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 0',
                borderTop: di > 0 ? '1px solid rgba(255,255,255,0.04)' : 'none',
              }}
            >
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--text-m)',
                  letterSpacing: '0.18em',
                  width: 22,
                  fontFamily: MONO,
                  fontWeight: 600,
                }}
              >
                D{di + 1}
              </span>
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 500,
                  color: 'var(--text-2)',
                  minWidth: 64,
                  flexShrink: 0,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                {d.name}
              </span>
              <div style={{ flex: 1, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {d.groups.map((g) => {
                  const c = getMuscleColor(g)
                  return (
                    <span
                      key={g}
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 4,
                        padding: '2px 7px',
                        borderRadius: 100,
                        fontSize: 9,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        background: `color-mix(in oklab, ${c.primary} 12%, transparent)`,
                        border: `1px solid color-mix(in oklab, ${c.primary} 25%, transparent)`,
                        color: c.light,
                        fontFamily: MONO,
                      }}
                    >
                      <span style={{ width: 4, height: 4, borderRadius: '50%', background: c.primary }} />
                      {g}
                    </span>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </Link>
  )
}

/* ─── Helpers ──────────────────────────────────────────────────── */

// Map a stored hex to a slightly lighter shade (40% mix with white) for the
// gradient highlight on the accent bar.
function lighten(hex: string | null): string | null {
  if (!hex) return null
  return `color-mix(in oklab, ${hex} 70%, white)`
}

/* ─── Chrome ───────────────────────────────────────────────────── */

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
          style={{ fontSize: 18, color: 'var(--text-1)', marginTop: 1 }}
        >
          {title}
        </div>
      </div>
      <div style={{ width: 36 }} />
    </div>
  )
}

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
        No splits yet
      </div>
      <div style={{ fontSize: 12, color: 'var(--text-m)', marginTop: 8 }}>
        Build a training template — days and exercises.
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
        New split
      </button>
    </div>
  )
}
