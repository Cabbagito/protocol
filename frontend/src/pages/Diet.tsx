import { useMemo, useState } from 'react'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import AddFoodSheet from '../components/AddFoodSheet'
import BottomSheet from '../components/BottomSheet'
import { useToast } from '../components/Toast'
import { ChevronLeftIcon, ChevronRightIcon, TrashIcon } from '../components/Icons'
import { useDailyLog, useDeleteLog } from '../api/hooks'
import type { FoodLog } from '../types'

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
  if (iso === todayIso()) return 'Today'
  return parseIso(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  })
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
    <div>
      <AppHeader
        title="Diet"
        rightContent={
          <div className="flex items-center gap-1">
            <button
              onClick={() => setDate(shiftDate(date, -1))}
              className="w-7 h-7 flex items-center justify-center rounded-md"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Previous day"
            >
              <ChevronLeftIcon className="w-3.5 h-3.5 text-[var(--text-2)]" />
            </button>
            <div className="min-w-[58px] text-center text-[12px] font-medium text-[var(--text-1)]">
              {dateLabel}
            </div>
            <button
              onClick={() => setDate(shiftDate(date, 1))}
              disabled={date === todayIso()}
              className="w-7 h-7 flex items-center justify-center rounded-md disabled:opacity-30"
              style={{ background: 'rgba(255,255,255,0.06)' }}
              aria-label="Next day"
            >
              <ChevronRightIcon className="w-3.5 h-3.5 text-[var(--text-2)]" />
            </button>
          </div>
        }
      />

      <div className="px-4 space-y-3 pb-24">
        {/* Totals card */}
        <div className="card stagger">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--text-m)] mb-2">
            Today's totals
          </div>
          <div className="flex items-baseline justify-between">
            <div>
              <span className="mono text-3xl font-bold text-[var(--text-1)]">
                {Math.round(totals.kcal)}
              </span>
              <span className="mono text-[13px] text-[var(--text-m)] ml-1">kcal</span>
            </div>
            <div className="mono text-[12px] text-[var(--text-2)]">
              {round1(totals.protein_g)}P · {round1(totals.carbs_g)}C · {round1(totals.fat_g)}F
            </div>
          </div>
        </div>

        {/* Entry list */}
        {isLoading ? (
          <PageLoader />
        ) : entries.length === 0 ? (
          <div className="text-[var(--text-2)] text-center py-10 text-sm">
            Nothing logged yet. Tap the + button to add food.
          </div>
        ) : (
          <div style={{ background: 'var(--card)', borderRadius: 12, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {entries.map((entry, idx) => (
              <FoodLogRow
                key={entry.id}
                entry={entry}
                isLast={idx === entries.length - 1}
                onDelete={() => setLogToDelete(entry)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Floating add button */}
      <button
        onClick={() => setSheetOpen(true)}
        className="fixed z-[100] right-4 flex items-center gap-1.5 px-4 py-3 rounded-full font-semibold text-white shadow-lg active:scale-95 transition-transform"
        style={{
          background: 'var(--accent)',
          bottom: 'calc(env(safe-area-inset-bottom) + 64px)',
          boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
        }}
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
          <path d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-[13px]">Log food</span>
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

function FoodLogRow({
  entry,
  isLast,
  onDelete,
}: {
  entry: FoodLog
  isLast: boolean
  onDelete: () => void
}) {
  return (
    <div
      className="flex items-center gap-3 px-4 py-3 stagger"
      style={{ borderBottom: isLast ? 'none' : '1px solid var(--border)' }}
    >
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-medium text-[var(--text-1)] truncate">{entry.name}</div>
        <div className="mono text-[11px] text-[var(--text-m)] mt-0.5">
          {Math.round(entry.kcal)} kcal · {round1(entry.protein_g)}P · {round1(entry.carbs_g)}C · {round1(entry.fat_g)}F
          {entry.quantity_g ? <span className="ml-1">· {Math.round(entry.quantity_g)}g</span> : null}
        </div>
      </div>
      <button
        onClick={onDelete}
        className="w-8 h-8 flex items-center justify-center rounded-md text-[var(--text-m)] active:scale-90 transition-transform"
        aria-label="Delete entry"
      >
        <TrashIcon className="w-4 h-4" />
      </button>
    </div>
  )
}

function round1(n: number): number {
  return Math.round(n * 10) / 10
}
