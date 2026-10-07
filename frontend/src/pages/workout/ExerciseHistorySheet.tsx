import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useScrollLock } from '../../hooks/useScrollLock'
import {
  CHIP_GAP, DATE_COLUMN, chipLayout, groupByMesocycle, historySlots, usualCount,
  type ChipLayout, type ExerciseSessionHistory,
} from '../../lib/exerciseHistory'
import { getMuscleColor, type MuscleColor } from '../../lib/muscleColors'
import { SET_TYPE_LABELS } from '../../lib/setConstants'
import { formatWeight } from '../../lib/weightUtils'
import { bestSet, setE1rm } from '../../lib/workoutReview'
import type { MesoSet } from '../../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'
/** Labels: --text-m alone fades into the background. */
const LABEL = 'color-mix(in oklab, var(--text-2) 55%, var(--text-m))'
/** Blocks shown before "Show older". */
const RECENT_BLOCKS = 3
/** Side padding of the list. */
const PAD = 20

interface ExerciseHistorySheetProps {
  exerciseName: string
  muscleGroup: string
  equipmentType: string
  /** Newest first. */
  history: ExerciseSessionHistory[]
  /** The mesocycle being trained, tagged "This block". */
  mesocycleId: string
  onClose: () => void
}

/**
 * Every logged session of one exercise, grouped by mesocycle, one row per
 * session. All chips share one width, so set N sits under set N in every
 * row; what beat the same set the session before is blue.
 */
export function ExerciseHistorySheet({
  exerciseName, muscleGroup, equipmentType, history, mesocycleId, onClose,
}: ExerciseHistorySheetProps) {
  useScrollLock(true)
  const c = getMuscleColor(muscleGroup)
  const [showAll, setShowAll] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [rowWidth, setRowWidth] = useState(() => Math.min(window.innerWidth, 512) - 2 * PAD)

  // Rows span the scroll area minus its side padding.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (!el) return
    setRowWidth(el.clientWidth - 2 * PAD)
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w) setRowWidth(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const slots = useMemo(() => history.map(h => historySlots(h.sets)), [history])
  const blocks = useMemo(() => groupByMesocycle(history), [history])
  // Where each block starts in `history` (for its sessions' slots and the session before).
  const starts = useMemo(() => {
    let n = 0
    return blocks.map(b => { const start = n; n += b.sessions.length; return start })
  }, [blocks])
  const layout = useMemo(() => {
    const longest = Math.max(0, ...history.flatMap(h => h.sets.map(label).map(l => l.length)))
    return chipLayout(rowWidth, longest, usualCount(slots.map(s => s.length)))
  }, [history, slots, rowWidth])
  const best = bestSet(history.flatMap(h => h.sets))
  const visible = showAll ? blocks : blocks.slice(0, RECENT_BLOCKS)

  return (
    <div className="fixed inset-0 z-[102]" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(2,6,12,0.55)' }} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`${exerciseName} history`}
        className="slide-up"
        onClick={e => e.stopPropagation()}
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0,
          top: 'calc(env(safe-area-inset-top) + 56px)',
          maxWidth: '32rem', margin: '0 auto',
          display: 'flex', flexDirection: 'column',
          borderRadius: '26px 26px 0 0',
          background: 'color-mix(in oklab, var(--card) 94%, transparent)',
          borderTop: '1px solid rgba(255,255,255,0.08)',
          boxShadow: '0 -20px 60px -20px rgba(0,0,0,0.8)',
        }}
      >
        <div style={{ width: 38, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.16)', margin: '8px auto 0', flex: 'none' }} />
        <div style={{ padding: '12px 20px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flex: 'none' }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: MONO, fontSize: 9, fontWeight: 600, letterSpacing: '0.16em', textTransform: 'uppercase', color: c.light }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.primary, boxShadow: `0 0 10px ${c.primary}` }} />
              {muscleGroup} · {equipmentType}
            </div>
            <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: '-0.015em', marginTop: 4, color: 'var(--text-1)' }}>
              {exerciseName}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(255,255,255,0.05)', display: 'grid', placeItems: 'center', color: 'var(--text-2)', flex: 'none' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div
          ref={scrollRef}
          style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: `0 ${PAD}px calc(env(safe-area-inset-bottom) + 24px)` }}
        >
          {history.length === 0 ? (
            <p style={{ marginTop: 32, textAlign: 'center', fontSize: 14, color: 'var(--text-2)' }}>
              No sets logged for this exercise yet.
            </p>
          ) : (
            <>
              <div
                style={{
                  display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', marginTop: 14, padding: '12px 0',
                  borderRadius: 16, background: 'rgba(15,29,46,0.55)', border: '1px solid rgba(255,255,255,0.05)',
                }}
              >
                <Stat label="Best set" divider={false}>
                  {best && <>{formatWeight(best.weight ?? 0)}<Times />{best.reps}</>}
                </Stat>
                <Stat label="Best est. 1RM">{best ? formatWeight(setE1rm(best)) : '—'}</Stat>
                <Stat label="Sessions">{history.length}</Stat>
              </div>

              <div>
                {visible.map((block, bi) => (
                  <div key={starts[bi]}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, margin: '22px 0 6px' }}>
                      <span style={{ fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif", fontStyle: 'italic', fontSize: 15, color: 'var(--text-1)', minWidth: 0 }}>
                        {block.mesoName}
                        {block.mesoId === mesocycleId && <ThisBlockTag />}
                      </span>
                      <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', color: LABEL, whiteSpace: 'nowrap' }}>
                        {dateRange(block.sessions)}
                      </span>
                    </div>
                    {block.sessions.map((h, si) => {
                      const i = starts[bi]! + si
                      return (
                        <SessionRow
                          key={i}
                          entry={h}
                          slots={slots[i]!}
                          previous={slots[i + 1] ?? null}
                          layout={layout}
                          color={c}
                        />
                      )
                    })}
                  </div>
                ))}
              </div>

              {!showAll && blocks.length > RECENT_BLOCKS && (
                <button
                  type="button"
                  onClick={() => setShowAll(true)}
                  style={{
                    marginTop: 14, width: '100%', height: 42, borderRadius: 12,
                    border: '1px dashed rgba(255,255,255,0.12)', color: 'var(--text-2)', fontSize: 12.5,
                  }}
                >
                  Show older
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

/* ─── Helpers ───────────────────────────────────────────────────── */

function label(s: MesoSet): string {
  return `${formatWeight(s.weight ?? 0)}×${s.reps ?? 0}`
}

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']

function shortDate(iso: string | null): string {
  if (!iso) return '—'
  const d = new Date(`${iso}T00:00:00`)
  return `${MONTHS[d.getMonth()]} ${d.getDate()}`
}

function dateRange(sessions: ExerciseSessionHistory[]): string {
  const dates = sessions.map(s => s.date).filter((d): d is string => !!d).sort()
  if (dates.length === 0) return ''
  const first = shortDate(dates[0]!)
  const last = shortDate(dates[dates.length - 1]!)
  return first === last ? first : `${first} – ${last}`
}

/* ─── Subcomponents ─────────────────────────────────────────────── */

function SessionRow({
  entry, slots, previous, layout, color,
}: {
  entry: ExerciseSessionHistory
  slots: (MesoSet | null)[]
  previous: (MesoSet | null)[] | null
  layout: ChipLayout
  color: MuscleColor
}) {
  const top = bestSet(entry.sets)
  const when = (
    <div style={{ fontFamily: MONO, letterSpacing: '0.08em', marginBottom: layout.beside ? 0 : 6 }}>
      <span style={{ display: layout.beside ? 'block' : 'inline', fontSize: 10, fontWeight: 600, color: 'var(--text-2)' }}>
        {shortDate(entry.date)}
      </span>
      <span style={{ display: layout.beside ? 'block' : 'inline', fontSize: 9, letterSpacing: '0.1em', color: LABEL, marginTop: layout.beside ? 2 : 0, marginLeft: layout.beside ? 0 : 8 }}>
        W{entry.week_number} · D{entry.session_index + 1}
      </span>
    </div>
  )
  return (
    <div
      style={{
        padding: '8px 0', borderTop: '1px solid rgba(255,255,255,0.045)',
        ...(layout.beside
          ? { display: 'grid', gridTemplateColumns: `${DATE_COLUMN - 10}px 1fr`, gap: 10, alignItems: 'center' }
          : {}),
      }}
    >
      {when}
      <div
        aria-label={entry.sets.map(s => `${formatWeight(s.weight ?? 0)} by ${s.reps}`).join(', ')}
        style={{ display: 'grid', gap: CHIP_GAP, gridTemplateColumns: `repeat(${layout.perLine}, ${layout.chipWidth}px)` }}
      >
        {slots.map((s, i) =>
          s ? (
            <Chip key={i} set={s} previous={previous?.[i] ?? null} isBest={s === top} color={color} />
          ) : (
            <span
              key={i}
              title="Skipped"
              style={{
                height: 28, borderRadius: 7, display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px dashed rgba(255,255,255,0.13)', color: LABEL, fontFamily: MONO, fontSize: 12,
              }}
            >
              –
            </span>
          ),
        )}
      </div>
    </div>
  )
}

function Chip({
  set, previous, isBest, color,
}: {
  set: MesoSet
  previous: MesoSet | null
  isBest: boolean
  color: MuscleColor
}) {
  const typeInfo = set.set_type ? SET_TYPE_LABELS[set.set_type] : undefined
  const weightUp = previous != null && (set.weight ?? 0) > (previous.weight ?? 0)
  const repsUp = previous != null && (set.reps ?? 0) > (previous.reps ?? 0)
  return (
    <span
      style={{
        position: 'relative', height: 28, borderRadius: 7,
        display: 'flex', alignItems: 'center', justifyContent: 'center', whiteSpace: 'nowrap',
        fontFamily: MONO, fontSize: 12.5, fontWeight: 600, letterSpacing: '-0.02em', color: 'var(--text-1)',
        background: isBest ? `color-mix(in oklab, ${color.primary} 10%, transparent)` : 'rgba(255,255,255,0.035)',
        border: `1px solid ${isBest ? `color-mix(in oklab, ${color.primary} 50%, transparent)` : 'rgba(255,255,255,0.06)'}`,
      }}
    >
      {typeInfo && (
        <span style={{ position: 'absolute', top: 1, right: 3, fontSize: 6.5, fontWeight: 700, letterSpacing: '0.04em', color: typeInfo.color }}>
          {typeInfo.label}
        </span>
      )}
      <span style={weightUp ? { color: 'var(--accent-l)' } : undefined}>{formatWeight(set.weight ?? 0)}</span>
      <Times />
      <span style={repsUp ? { color: 'var(--accent-l)' } : undefined}>{set.reps}</span>
    </span>
  )
}

function Times() {
  return <span style={{ color: 'var(--text-m)', fontWeight: 400, margin: '0 1px' }}>×</span>
}

function ThisBlockTag() {
  return (
    <span
      style={{
        fontFamily: MONO, fontStyle: 'normal', fontSize: 8.5, letterSpacing: '0.14em', color: 'var(--accent-l)',
        border: '1px solid rgba(var(--accent-rgb),0.3)', background: 'rgba(var(--accent-rgb),0.1)',
        borderRadius: 6, padding: '2px 5px', marginLeft: 6, verticalAlign: 2,
      }}
    >
      THIS BLOCK
    </span>
  )
}

function Stat({ label: text, children, divider = true }: { label: string; children: React.ReactNode; divider?: boolean }) {
  return (
    <div style={{ textAlign: 'center', borderLeft: divider ? '1px solid rgba(255,255,255,0.06)' : undefined }}>
      <div style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.18em', fontWeight: 600, textTransform: 'uppercase', color: LABEL }}>
        {text}
      </div>
      <div style={{ fontFamily: MONO, fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', marginTop: 5, color: 'var(--text-1)' }}>
        {children}
      </div>
    </div>
  )
}
