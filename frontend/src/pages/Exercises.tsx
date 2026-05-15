import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import PageLoader from '../components/PageLoader'
import { useExercises } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import { MUSCLE_GROUP_ROWS, EQUIPMENT_TYPES } from '../components/exerciseConstants'
import type { Exercise } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

const EQUIPMENT_ICONS: Record<string, React.ReactNode> = {
  barbell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M2 12h2M20 12h2M5 8v8M19 8v8M8 10v4M16 10v4M8 12h8" />
    </svg>
  ),
  dumbbell: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
      <path d="M5 9v6M3 11v2M19 9v6M21 11v2M8 8v8M16 8v8M8 12h8" />
    </svg>
  ),
  machine: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M8 10v4M16 10v4M10 8h4" />
    </svg>
  ),
  cable: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 3v8a4 4 0 0 0 4 4h6a4 4 0 0 1 4 4v2" />
      <circle cx="5" cy="3" r="1.5" />
      <circle cx="19" cy="21" r="1.5" />
    </svg>
  ),
  bodyweight: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="5" r="2.2" />
      <path d="M12 8v6M9 11l3-2 3 2M9 21l3-7 3 7" />
    </svg>
  ),
}

export default function Exercises() {
  const navigate = useNavigate()
  const { data: exercises = [], isLoading } = useExercises()
  const [query, setQuery] = useState('')
  const [muscleSel, setMuscleSel] = useState<Set<string>>(new Set())
  const [gearSel, setGearSel] = useState<Set<string>>(new Set())
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return exercises.filter((ex) => {
      if (q && !ex.name.toLowerCase().includes(q)) return false
      if (muscleSel.size > 0 && !muscleSel.has(ex.muscle_group)) return false
      if (gearSel.size > 0 && !gearSel.has(ex.equipment_type)) return false
      return true
    })
  }, [exercises, query, muscleSel, gearSel])

  const groupedSections = useMemo(() => {
    const orderedGroups = MUSCLE_GROUP_ROWS.flatMap((row) => row.groups)
    const byGroup = new Map<string, Exercise[]>()
    for (const ex of filtered) {
      const arr = byGroup.get(ex.muscle_group) ?? []
      arr.push(ex)
      byGroup.set(ex.muscle_group, arr)
    }
    const seen = new Set<string>()
    const sections: { group: string; items: Exercise[] }[] = []
    for (const group of orderedGroups) {
      const items = byGroup.get(group)
      if (items && items.length > 0) {
        sections.push({ group, items })
        seen.add(group)
      }
    }
    // Fallback: any groups not in the ordered map
    for (const [group, items] of byGroup) {
      if (!seen.has(group)) sections.push({ group, items })
    }
    return sections
  }, [filtered])

  const totalGroupCount = useMemo(() => {
    const set = new Set(exercises.map((e) => e.muscle_group))
    return set.size
  }, [exercises])

  function toggleMuscle(g: string) {
    setMuscleSel((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

  function toggleGear(g: string) {
    setGearSel((prev) => {
      const next = new Set(prev)
      if (next.has(g)) next.delete(g)
      else next.add(g)
      return next
    })
  }

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
          title="Exercises"
          sub={`${exercises.length} LIFTS · ${totalGroupCount} GROUPS`}
          onBack={() => navigate(-1)}
        />

        {/* Search */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '12px 14px',
            borderRadius: 14,
            background: 'rgba(15,29,46,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-m)" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3-3" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search lifts…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: 'var(--text-1)',
              fontSize: 14,
              padding: 0,
            }}
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              aria-label="Clear search"
              style={{
                width: 22,
                height: 22,
                borderRadius: 6,
                background: 'transparent',
                border: 'none',
                color: 'var(--text-m)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Filter panel */}
        <div
          style={{
            marginTop: 10,
            padding: '10px 12px',
            borderRadius: 14,
            background: 'rgba(15,29,46,0.4)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
          }}
        >
          {MUSCLE_GROUP_ROWS.map((row) => (
            <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span
                style={{
                  fontSize: 9,
                  color: 'var(--text-m)',
                  letterSpacing: '0.2em',
                  width: 30,
                  flexShrink: 0,
                  fontFamily: MONO,
                  fontWeight: 600,
                  textTransform: 'uppercase',
                }}
              >
                {row.label}
              </span>
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                {row.groups.map((g) => {
                  const color = getMuscleColor(g)
                  const sel = muscleSel.has(g)
                  return (
                    <button
                      key={g}
                      type="button"
                      onClick={() => toggleMuscle(g)}
                      style={{
                        padding: '4px 9px',
                        borderRadius: 100,
                        background: sel
                          ? `color-mix(in oklab, ${color.primary} 18%, transparent)`
                          : 'transparent',
                        border: `1px solid ${sel ? `color-mix(in oklab, ${color.primary} 40%, transparent)` : 'rgba(255,255,255,0.05)'}`,
                        color: sel ? color.light : 'var(--text-2)',
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.1em',
                        textTransform: 'uppercase',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 5,
                        cursor: 'pointer',
                        fontFamily: MONO,
                      }}
                    >
                      <span
                        style={{
                          width: 4,
                          height: 4,
                          borderRadius: '50%',
                          background: color.primary,
                          boxShadow: sel ? `0 0 6px ${color.primary}` : 'none',
                        }}
                      />
                      {g}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              marginTop: 6,
              paddingTop: 8,
              borderTop: '1px solid rgba(255,255,255,0.05)',
            }}
          >
            <span
              style={{
                fontSize: 9,
                color: 'var(--text-m)',
                letterSpacing: '0.2em',
                width: 30,
                flexShrink: 0,
                fontFamily: MONO,
                fontWeight: 600,
              }}
            >
              GEAR
            </span>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
              {EQUIPMENT_TYPES.map((eq) => {
                const sel = gearSel.has(eq)
                return (
                  <button
                    key={eq}
                    type="button"
                    onClick={() => toggleGear(eq)}
                    style={{
                      padding: '4px 9px 4px 7px',
                      borderRadius: 100,
                      background: sel ? 'rgba(var(--accent-rgb),0.16)' : 'transparent',
                      border: sel
                        ? '1px solid rgba(var(--accent-rgb),0.40)'
                        : '1px solid rgba(255,255,255,0.05)',
                      color: sel ? 'var(--accent-l)' : 'var(--text-2)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 5,
                      cursor: 'pointer',
                      fontFamily: MONO,
                    }}
                  >
                    <span style={{ width: 11, height: 11, display: 'inline-flex' }}>
                      {EQUIPMENT_ICONS[eq]}
                    </span>
                    {eq}
                  </button>
                )
              })}
            </div>
          </div>
        </div>

        {/* Sections */}
        {isLoading ? (
          <div style={{ marginTop: 24 }}>
            <PageLoader />
          </div>
        ) : groupedSections.length === 0 ? (
          <div
            style={{
              marginTop: 28,
              padding: '40px 22px',
              textAlign: 'center',
              borderRadius: 16,
              background: 'rgba(15,29,46,0.4)',
              border: '1px dashed rgba(255,255,255,0.08)',
              color: 'var(--text-m)',
              fontSize: 13,
            }}
          >
            No exercises match your filters.
          </div>
        ) : (
          <div style={{ marginTop: 20 }}>
            {groupedSections.map((section) => {
              const color = getMuscleColor(section.group)
              return (
                <div key={section.group} style={{ marginBottom: 22 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: color.primary,
                        boxShadow: `0 0 10px ${color.primary}`,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        letterSpacing: '0.22em',
                        color: color.light,
                        textTransform: 'uppercase',
                        fontFamily: MONO,
                      }}
                    >
                      {section.group}
                    </span>
                    <span
                      style={{
                        fontSize: 9,
                        color: 'var(--text-m)',
                        letterSpacing: '0.18em',
                        marginLeft: 'auto',
                        fontFamily: MONO,
                        fontWeight: 600,
                      }}
                    >
                      {section.items.length} {section.items.length === 1 ? 'LIFT' : 'LIFTS'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    {section.items.map((ex) => (
                      <ExerciseRow key={ex.id} exercise={ex} onClick={() => navigate('/progress')} />
                    ))}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

/* ─── Exercise row ─────────────────────────────────────────────── */

function ExerciseRow({ exercise, onClick }: { exercise: Exercise; onClick: () => void }) {
  const color = getMuscleColor(exercise.muscle_group)
  return (
    <button
      type="button"
      onClick={onClick}
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
        cursor: 'pointer',
        textAlign: 'left',
        width: '100%',
        color: 'inherit',
      }}
    >
      <div
        style={{
          width: 2,
          height: 30,
          borderRadius: 1,
          background: `linear-gradient(180deg, ${color.primary}, ${color.light})`,
          opacity: 0.85,
        }}
      />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            color: 'var(--text-1)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {exercise.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-m)',
            marginTop: 2,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            fontFamily: MONO,
          }}
        >
          {exercise.equipment_type}
        </div>
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-m)" strokeWidth={2} strokeLinecap="round">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
  )
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
