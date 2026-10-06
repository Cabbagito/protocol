import { useEffect, useId, useState } from 'react'
import { useLogWeight, useWeightLogs } from '../api/hooks'
import { useToast } from './Toast'
import { useScrollLock } from '../hooks/useScrollLock'
import { todayIso, parseIso } from '../lib/dates'
import { round1 } from '../lib/formatters'

const MONO = 'JetBrains Mono, ui-monospace, monospace'
const MAX_CHART_POINTS = 60

export default function BodyweightCard() {
  const { data: logs } = useWeightLogs()
  const [sheetOpen, setSheetOpen] = useState(false)

  const entries = logs ?? []
  const latest = entries.length > 0 ? entries[entries.length - 1] : null
  const previous = entries.length > 1 ? entries[entries.length - 2] : null
  const delta = latest && previous ? latest.weight_kg - previous.weight_kg : null
  const weighedToday = latest?.logged_on === todayIso()

  return (
    <div style={{ marginTop: 22 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-m)',
          fontFamily: MONO,
          marginBottom: 12,
        }}
      >
        Bodyweight
      </div>

      <div
        style={{
          padding: '18px 18px 14px',
          borderRadius: 20,
          background: 'color-mix(in oklab, var(--card) 70%, transparent)',
          border: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            {latest ? (
              <>
                <div
                  style={{
                    fontSize: 28,
                    fontWeight: 700,
                    color: 'var(--text-1)',
                    lineHeight: 1,
                    fontFamily: MONO,
                  }}
                >
                  {round1(latest.weight_kg)}
                  <span style={{ fontSize: 12, color: 'var(--text-m)', marginLeft: 4 }}>kg</span>
                </div>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text-m)',
                    marginTop: 6,
                    fontFamily: MONO,
                    letterSpacing: '0.08em',
                  }}
                >
                  {delta !== null && (
                    <span
                      style={{
                        color: delta > 0 ? 'var(--m-quads)' : delta < 0 ? 'var(--accent)' : 'var(--text-m)',
                        marginRight: 8,
                      }}
                    >
                      {delta > 0 ? '▲' : delta < 0 ? '▼' : '·'} {round1(Math.abs(delta))} kg
                    </span>
                  )}
                  {formatLogDate(latest.logged_on)}
                </div>
              </>
            ) : (
              <div style={{ fontSize: 13, color: 'var(--text-m)', paddingTop: 4 }}>
                No weigh-ins yet
              </div>
            )}
          </div>

          <button
            onClick={() => setSheetOpen(true)}
            style={{
              padding: '9px 14px',
              borderRadius: 999,
              background: weighedToday ? 'rgba(255,255,255,0.06)' : 'var(--p-grad-cta)',
              color: weighedToday ? 'var(--text-2)' : 'var(--btn-text)',
              border: weighedToday ? '1px solid rgba(255,255,255,0.08)' : 'none',
              fontFamily: MONO,
              fontWeight: 500,
              fontSize: 11,
              letterSpacing: '0.05em',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            {weighedToday ? 'Update' : 'Weigh in'}
          </button>
        </div>

        {entries.length >= 2 && (
          <div style={{ marginTop: 16 }}>
            <WeightChart logs={entries.slice(-MAX_CHART_POINTS)} />
          </div>
        )}
      </div>

      <WeighInSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        initialWeight={latest?.weight_kg ?? null}
      />
    </div>
  )
}

function formatLogDate(iso: string): string {
  if (iso === todayIso()) return 'TODAY'
  return parseIso(iso)
    .toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    .toUpperCase()
}

/* ─── Weight chart ─────────────────────────────────────────────── */

function WeightChart({ logs }: { logs: { logged_on: string; weight_kg: number }[] }) {
  const id = useId().replace(/:/g, '')
  const w = 312
  const h = 90
  const pts = logs.map((l) => l.weight_kg)
  const max = Math.max(...pts)
  const min = Math.min(...pts)
  const range = max - min || 1
  const stepX = w / (pts.length - 1)
  const ys = pts.map((v) => h - ((v - min) / range) * (h - 14) - 7)
  const xs = pts.map((_, i) => i * stepX)
  const d = pts
    .map((_, i) => `${i === 0 ? 'M' : 'L'}${xs[i]!.toFixed(1)},${ys[i]!.toFixed(1)}`)
    .join(' ')
  const dFill =
    `M${xs[0]!.toFixed(1)},${h} L${xs[0]!.toFixed(1)},${ys[0]!.toFixed(1)} ` +
    xs.slice(1).map((x, i) => `L${x.toFixed(1)},${ys[i + 1]!.toFixed(1)}`).join(' ') +
    ` L${xs[xs.length - 1]!.toFixed(1)},${h} Z`

  return (
    <div>
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block', overflow: 'visible' }}>
        <defs>
          <linearGradient id={`bw-${id}`} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.3" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={dFill} fill={`url(#bw-${id})`} />
        <path
          d={d}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ filter: 'drop-shadow(0 0 6px rgba(var(--accent-rgb),0.5))' }}
        />
        <circle
          cx={xs[xs.length - 1]!}
          cy={ys[ys.length - 1]!}
          r={3.5}
          fill="var(--accent)"
          stroke="white"
          strokeWidth={1.5}
          style={{ filter: 'drop-shadow(0 0 8px rgba(var(--accent-rgb),0.6))' }}
        />
      </svg>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: 8,
          fontSize: 9,
          color: 'var(--text-m)',
          fontFamily: MONO,
          letterSpacing: '0.1em',
        }}
      >
        <span>{formatLogDate(logs[0]!.logged_on)}</span>
        <span>
          {round1(min)}–{round1(max)} KG
        </span>
        <span>{formatLogDate(logs[logs.length - 1]!.logged_on)}</span>
      </div>
    </div>
  )
}

/* ─── Weigh-in sheet ───────────────────────────────────────────── */

function WeighInSheet({
  open,
  onClose,
  initialWeight,
}: {
  open: boolean
  onClose: () => void
  initialWeight: number | null
}) {
  const [value, setValue] = useState('')
  const logWeight = useLogWeight()
  const toast = useToast()
  useScrollLock(open)

  useEffect(() => {
    if (open) setValue(initialWeight !== null ? String(round1(initialWeight)) : '')
  }, [open, initialWeight])

  if (!open) return null

  const parsed = parseFloat(value.replace(',', '.'))
  const valid = !isNaN(parsed) && parsed > 0 && parsed < 500

  async function handleSave() {
    if (!valid) return
    try {
      await logWeight.mutateAsync({ logged_on: todayIso(), weight_kg: parsed })
      onClose()
    } catch {
      toast.showError('Failed to log weight')
    }
  }

  return (
    <div className="fixed inset-0 z-[102] flex items-center justify-center px-4" onClick={onClose}>
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)' }}
      />
      <div
        className="relative w-full max-w-sm rounded-2xl slide-up"
        style={{
          background: 'var(--card)',
          border: '1px solid rgba(255,255,255,0.06)',
          boxShadow: '0 24px 48px rgba(0,0,0,0.6)',
          padding: '20px 20px 18px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: '0.18em',
            textTransform: 'uppercase',
            color: 'var(--text-m)',
            fontFamily: MONO,
          }}
        >
          Weigh in
        </div>

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginTop: 16 }}>
          <input
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSave()}
            placeholder="0.0"
            style={{
              flex: 1,
              minWidth: 0,
              fontSize: 32,
              fontWeight: 700,
              fontFamily: MONO,
              color: 'var(--text-1)',
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12,
              padding: '10px 14px',
              outline: 'none',
              textAlign: 'center',
            }}
          />
          <span style={{ fontSize: 14, color: 'var(--text-m)', fontFamily: MONO }}>kg</span>
        </div>

        <button
          onClick={handleSave}
          disabled={!valid || logWeight.isPending}
          style={{
            width: '100%',
            marginTop: 16,
            padding: '13px 0',
            borderRadius: 12,
            background: 'var(--p-grad-cta)',
            color: 'var(--btn-text)',
            fontFamily: MONO,
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: '0.05em',
            border: 'none',
            cursor: valid ? 'pointer' : 'default',
            opacity: valid && !logWeight.isPending ? 1 : 0.4,
          }}
        >
          {logWeight.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  )
}
