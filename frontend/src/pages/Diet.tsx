import { useMemo, useState } from 'react'
import PageLoader from '../components/PageLoader'
import AddFoodSheet from '../components/AddFoodSheet'
import BottomSheet from '../components/BottomSheet'
import AuroraBackground from '../components/AuroraBackground'
import { useToast } from '../components/Toast'
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '../components/Icons'
import { useDailyLog, useDeleteLog } from '../api/hooks'
import type { FoodLog } from '../types'

// Daily targets are not yet user-configurable; sensible defaults from
// the v5 prototype. Can be moved to user prefs later.
const KCAL_GOAL = 2400
const PROTEIN_GOAL = 180
const CARBS_GOAL = 280
const FAT_GOAL = 80

function todayIso(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function parseIso(iso: string): Date {
  const parts = iso.split('-').map(Number)
  const y = parts[0] ?? 1970
  const m = parts[1] ?? 1
  const d = parts[2] ?? 1
  return new Date(y, m - 1, d)
}

function shiftDate(iso: string, delta: number): string {
  const date = parseIso(iso)
  date.setDate(date.getDate() + delta)
  const yy = date.getFullYear()
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  return `${yy}-${mm}-${dd}`
}

function formatDateLabel(iso: string): string {
  if (iso === todayIso()) return 'TODAY'
  return parseIso(iso)
    .toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })
    .toUpperCase()
    .replace(',', ' ·')
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}

export default function Diet() {
  const [date, setDate] = useState(todayIso())
  const [sheetOpen, setSheetOpen] = useState(false)
  const [logToDelete, setLogToDelete] = useState<FoodLog | null>(null)
  const { data, isLoading } = useDailyLog(date)
  const deleteLog = useDeleteLog()
  const toast = useToast()

  const totals = data?.totals ?? { kcal: 0, protein_g: 0, carbs_g: 0, fat_g: 0 }
  const entries = data?.entries ?? []
  const dateLabel = useMemo(() => formatDateLabel(date), [date])

  async function handleDelete() {
    if (!logToDelete) return
    try {
      await deleteLog.mutateAsync({ id: logToDelete.id, date })
    } catch {
      toast.showError('Failed to delete entry')
    } finally {
      setLogToDelete(null)
    }
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

      <div
        style={{
          position: 'relative',
          zIndex: 1,
          padding: '12px 22px 130px',
        }}
      >
        {/* Top bar — date pager */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
          <button
            onClick={() => setDate(shiftDate(date, -1))}
            aria-label="Previous day"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-2)',
              display: 'grid', placeItems: 'center',
              cursor: 'pointer',
            }}
          >
            <ChevronLeftIcon className="w-3.5 h-3.5" />
          </button>
          <div
            style={{
              fontSize: 11, color: 'var(--text-2)', letterSpacing: '0.22em',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace', fontWeight: 500,
              minWidth: 140, textAlign: 'center',
            }}
          >
            {dateLabel}
          </div>
          <button
            onClick={() => setDate(shiftDate(date, 1))}
            disabled={date === todayIso()}
            aria-label="Next day"
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.06)',
              color: 'var(--text-2)',
              display: 'grid', placeItems: 'center',
              opacity: date === todayIso() ? 0.3 : 1,
              cursor: 'pointer',
            }}
          >
            <ChevronRightIcon className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Calorie ring + macros */}
        <div
          style={{
            marginTop: 22,
            padding: 22,
            borderRadius: 20,
            textAlign: 'center',
            background:
              'linear-gradient(180deg, rgba(var(--accent-rgb),0.06), color-mix(in oklab, var(--card) 65%, transparent))',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          <CalorieRing kcal={totals.kcal} goal={KCAL_GOAL} />

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr 1fr 1fr',
              gap: 10,
              marginTop: 18,
            }}
          >
            <MacroBar
              label="PROTEIN"
              value={totals.protein_g}
              goal={PROTEIN_GOAL}
              color="var(--m-chest)"
            />
            <MacroBar
              label="CARBS"
              value={totals.carbs_g}
              goal={CARBS_GOAL}
              color="var(--accent)"
            />
            <MacroBar
              label="FAT"
              value={totals.fat_g}
              goal={FAT_GOAL}
              color="var(--m-quads)"
            />
          </div>
        </div>

        {/* Meals */}
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: 'var(--text-m)',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              marginBottom: 12,
            }}
          >
            Meals
          </div>

          {isLoading ? (
            <PageLoader />
          ) : entries.length === 0 ? (
            <button
              onClick={() => setSheetOpen(true)}
              style={{
                width: '100%',
                padding: '18px 16px',
                borderRadius: 14,
                background: 'transparent',
                border: '1px dashed rgba(255,255,255,0.08)',
                color: 'var(--text-m)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              + Log first meal
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {entries.map(entry => (
                <MealRow
                  key={entry.id}
                  entry={entry}
                  onDelete={() => setLogToDelete(entry)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setSheetOpen(true)}
        style={{
          position: 'fixed',
          zIndex: 100,
          right: 22,
          bottom: 'calc(env(safe-area-inset-bottom) + 100px)',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '12px 18px',
          borderRadius: 999,
          background: 'var(--p-grad-cta)',
          color: 'var(--btn-text)',
          fontFamily: "'JetBrains Mono', 'SF Mono', monospace",
          fontWeight: 500,
          fontSize: 12,
          letterSpacing: '0.05em',
          border: 'none',
          cursor: 'pointer',
          boxShadow: '0 14px 40px -10px rgba(var(--accent-rgb),0.55), inset 0 1px 0 rgba(255,255,255,0.18)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 4v16m8-8H4" />
        </svg>
        Log food
      </button>

      <AddFoodSheet open={sheetOpen} onClose={() => setSheetOpen(false)} date={date} />

      <BottomSheet
        open={!!logToDelete}
        onClose={() => setLogToDelete(null)}
        title={logToDelete?.name}
        actions={[
          {
            label: 'Delete entry',
            variant: 'danger',
            icon: <TrashIcon className="w-4 h-4" />,
            onClick: handleDelete,
          },
        ]}
      />
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Calorie ring                                                        */
/* ─────────────────────────────────────────────────────────────────── */

function CalorieRing({ kcal, goal }: { kcal: number; goal: number }) {
  const radius = 85
  const circumference = 2 * Math.PI * radius // ≈ 534
  const pct = Math.min(1, kcal / goal)
  const filled = pct * circumference

  return (
    <div style={{ position: 'relative', width: 180, height: 180, margin: '0 auto' }}>
      <svg
        viewBox="0 0 200 200"
        style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}
      >
        <defs>
          <linearGradient id="diet-ring-grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-d)" />
          </linearGradient>
        </defs>
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.06)"
          strokeWidth="14"
        />
        <circle
          cx="100"
          cy="100"
          r={radius}
          fill="none"
          stroke="url(#diet-ring-grad)"
          strokeWidth="14"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          style={{ filter: 'drop-shadow(0 0 8px rgba(var(--accent-rgb),0.5))' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div
            style={{
              fontSize: 36,
              fontWeight: 700,
              color: 'var(--text-1)',
              lineHeight: 1,
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
          >
            {Math.round(kcal)}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-m)',
              marginTop: 6,
              letterSpacing: '0.2em',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            }}
          >
            / {goal} KCAL
          </div>
        </div>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Macro bar                                                           */
/* ─────────────────────────────────────────────────────────────────── */

function MacroBar({
  label, value, goal, color,
}: { label: string; value: number; goal: number; color: string }) {
  const pct = Math.min(100, (value / goal) * 100)
  return (
    <div style={{ textAlign: 'center' }}>
      <div
        style={{
          fontSize: 9,
          color: 'var(--text-m)',
          letterSpacing: '0.15em',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: 18,
          fontWeight: 600,
          color: 'var(--text-1)',
          marginTop: 4,
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        }}
      >
        {round1(value)}
        <span style={{ fontSize: 10, color: 'var(--text-m)' }}>/{goal}g</span>
      </div>
      <div
        style={{
          height: 2,
          marginTop: 6,
          background: 'rgba(255,255,255,0.06)',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            width: `${pct}%`,
            height: '100%',
            background: color,
            boxShadow: `0 0 6px ${color}`,
            borderRadius: 1,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Meal row                                                            */
/* ─────────────────────────────────────────────────────────────────── */

function MealRow({ entry, onDelete }: { entry: FoodLog; onDelete: () => void }) {
  return (
    <div
      style={{
        position: 'relative',
        padding: '14px 16px',
        borderRadius: 14,
        background: 'color-mix(in oklab, var(--card) 70%, transparent)',
        border: '1px solid rgba(255,255,255,0.05)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
      }}
    >
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 14,
            fontWeight: 600,
            color: 'var(--text-1)',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
          }}
        >
          {entry.name}
        </div>
        <div
          style={{
            fontSize: 10,
            color: 'var(--text-m)',
            marginTop: 4,
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
            letterSpacing: '0.05em',
          }}
        >
          {round1(entry.protein_g)}P · {round1(entry.carbs_g)}C · {round1(entry.fat_g)}F
          {entry.quantity_g ? ` · ${Math.round(entry.quantity_g)}g` : ''}
        </div>
      </div>
      <div
        style={{
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          fontSize: 13,
          color: 'var(--text-1)',
        }}
      >
        {Math.round(entry.kcal)}
        <span style={{ color: 'var(--text-m)', fontSize: 10, marginLeft: 4 }}>kcal</span>
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete entry"
        style={{
          width: 32,
          height: 32,
          borderRadius: 8,
          background: 'transparent',
          border: 'none',
          color: 'var(--text-m)',
          display: 'grid',
          placeItems: 'center',
          cursor: 'pointer',
        }}
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
