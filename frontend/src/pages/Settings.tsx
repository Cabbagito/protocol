import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import ThemePicker from '../components/ThemePicker'
import { ChevronRightIcon } from '../components/Icons'
import { useToast } from '../components/Toast'
import {
  useMesocycles,
  useExercises,
  useSplits,
  useDailyTargets,
  useUpdateDailyTargets,
} from '../api/hooks'
import { clearToken, getUserInfo } from '../lib/auth'
import {
  applyMotion, getSavedMotion, MOTION_IDS, type MotionId,
} from '../lib/motion'

const MOTION_LABELS: Record<MotionId, string> = {
  aurora: 'Aurora · full motion',
  pulse: 'Pulse · subtle motion',
  still: 'Still · no motion',
}

export default function Settings() {
  const navigate = useNavigate()
  const userInfo = getUserInfo()
  const initial = (userInfo?.name?.[0] ?? '·').toUpperCase()

  const { data: mesocycles = [] } = useMesocycles()
  const { data: exercises = [] } = useExercises()
  const { data: splits = [] } = useSplits()

  const [motion, setMotion] = useState<MotionId>(() => getSavedMotion())
  const [themeOpen, setThemeOpen] = useState(false)
  const [motionOpen, setMotionOpen] = useState(false)

  // Stats: total workouts completed across all mesos + days since the
  // earliest mesocycle started.
  const stats = useMemo(() => {
    const totalWorkouts = mesocycles.reduce(
      (n, m) => n + (m.workouts_completed ?? 0), 0,
    )
    let days = 0
    if (mesocycles.length > 0) {
      const earliest = mesocycles.reduce((a, b) =>
        (a.started_at < b.started_at ? a : b),
      ).started_at
      const start = new Date(earliest + 'T00:00:00').getTime()
      const today = new Date().setHours(0, 0, 0, 0)
      days = Math.max(0, Math.round((today - start) / (1000 * 60 * 60 * 24)))
    }
    return { totalWorkouts, days }
  }, [mesocycles])

  const activeMesoCount = mesocycles.filter(m => m.is_active).length
  const archivedMesoCount = mesocycles.length - activeMesoCount

  function handleMotionChange(next: MotionId) {
    setMotion(next)
    applyMotion(next)
  }

  function handleLogout() {
    clearToken()
    navigate('/login', { replace: true })
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
        {/* Profile head */}
        <div style={{ textAlign: 'center', padding: '24px 0 28px' }}>
          <div
            style={{
              width: 80,
              height: 80,
              margin: '0 auto',
              borderRadius: 26,
              background: 'var(--p-grad)',
              display: 'grid',
              placeItems: 'center',
              boxShadow: '0 12px 40px -8px rgba(var(--accent-rgb),0.5)',
            }}
          >
            <span
              style={{
                fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
                fontStyle: 'italic',
                fontSize: 34,
                fontWeight: 500,
                color: 'white',
              }}
            >
              {initial}
            </span>
          </div>
          <div
            style={{
              fontFamily: "'Fraunces', 'Instrument Serif', Georgia, serif",
              fontStyle: 'italic',
              fontSize: 26,
              color: 'var(--text-1)',
              marginTop: 14,
            }}
          >
            {userInfo?.name ?? 'Athlete'}
          </div>
          <div
            style={{
              fontSize: 10,
              color: 'var(--text-m)',
              marginTop: 6,
              letterSpacing: '0.2em',
              fontFamily: 'JetBrains Mono, ui-monospace, monospace',
              fontWeight: 500,
            }}
          >
            {stats.days} {stats.days === 1 ? 'DAY' : 'DAYS'} ·{' '}
            {stats.totalWorkouts} {stats.totalWorkouts === 1 ? 'WORKOUT' : 'WORKOUTS'}
          </div>
        </div>

        {/* Library */}
        <SectionCard label="Library">
          <Row
            label="Mesocycles"
            value={`${activeMesoCount} active · ${archivedMesoCount} archived`}
            to="/mesocycles"
          />
          <Row label="Splits" value={`${splits.length} templates`} to="/splits" />
          <Row label="Exercises" value={`${exercises.length} lifts`} to="/exercises" />
          <Row label="Progress" value="Charts & history" to="/progress" />
        </SectionCard>

        {/* Diet targets */}
        <SectionCard label="Diet targets">
          <DietTargetsEditor />
        </SectionCard>

        {/* Appearance */}
        <SectionCard label="Appearance">
          <button
            type="button"
            onClick={() => setThemeOpen(o => !o)}
            style={rowButtonStyle}
          >
            <span style={rowLabelStyle}>Theme</span>
            <span style={rowValueStyle}>{themeOpen ? 'Close' : 'Choose'}</span>
            <Chevron rotated={themeOpen} />
          </button>
          {themeOpen && (
            <div style={{ padding: '0 14px 14px' }}>
              <ThemePicker />
            </div>
          )}
          <Divider />
          <button
            type="button"
            onClick={() => setMotionOpen(o => !o)}
            style={rowButtonStyle}
          >
            <span style={rowLabelStyle}>Motion</span>
            <span style={rowValueStyle}>{MOTION_LABELS[motion]}</span>
            <Chevron rotated={motionOpen} />
          </button>
          {motionOpen && (
            <div style={{ padding: '0 16px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              {MOTION_IDS.map((id) => {
                const active = id === motion
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => handleMotionChange(id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '10px 12px',
                      borderRadius: 10,
                      background: active ? 'rgba(var(--accent-rgb),0.12)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${active ? 'rgba(var(--accent-rgb),0.35)' : 'rgba(255,255,255,0.06)'}`,
                      color: 'var(--text-1)',
                      fontSize: 13,
                      cursor: 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span
                      aria-hidden
                      style={{
                        width: 10,
                        height: 10,
                        borderRadius: 999,
                        background: active ? 'var(--accent)' : 'transparent',
                        border: `1.5px solid ${active ? 'var(--accent)' : 'rgba(255,255,255,0.2)'}`,
                      }}
                    />
                    {MOTION_LABELS[id]}
                  </button>
                )
              })}
            </div>
          )}
        </SectionCard>

        {/* Account */}
        <SectionCard label="Account">
          <Row label="Logged in as" value={userInfo?.name ?? 'Unknown'} />
          <Divider />
          <button
            type="button"
            onClick={handleLogout}
            style={{
              ...rowButtonStyle,
              color: '#f87171',
            }}
          >
            <span style={{ ...rowLabelStyle, color: '#f87171' }}>Log out</span>
          </button>
        </SectionCard>
      </div>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────── */
/*  Small building blocks                                               */
/* ─────────────────────────────────────────────────────────────────── */

const rowButtonStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  padding: '14px 16px',
  width: '100%',
  background: 'transparent',
  border: 'none',
  cursor: 'pointer',
  textAlign: 'left',
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: 14,
  color: 'var(--text-1)',
  flex: 1,
}

const rowValueStyle: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--text-m)',
  fontFamily: 'JetBrains Mono, ui-monospace, monospace',
}

function SectionCard({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 20 }}>
      <div
        style={{
          fontSize: 10,
          fontWeight: 600,
          letterSpacing: '0.18em',
          textTransform: 'uppercase',
          color: 'var(--text-m)',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          marginBottom: 10,
          paddingLeft: 2,
        }}
      >
        {label}
      </div>
      <div
        style={{
          borderRadius: 14,
          overflow: 'hidden',
          border: '1px solid rgba(255,255,255,0.05)',
          background: 'color-mix(in oklab, var(--card) 65%, transparent)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
        }}
      >
        {children}
      </div>
    </div>
  )
}

function Row({ label, value, to }: { label: string; value?: string; to?: string }) {
  const inner = (
    <>
      <span style={rowLabelStyle}>{label}</span>
      {value && <span style={rowValueStyle}>{value}</span>}
      {to && (
        <span style={{ color: 'var(--text-m)', display: 'inline-flex' }}>
          <ChevronRightIcon className="w-3.5 h-3.5" />
        </span>
      )}
    </>
  )
  return to ? (
    <Link to={to} style={{ ...rowButtonStyle, textDecoration: 'none' }}>
      {inner}
    </Link>
  ) : (
    <div style={rowButtonStyle as React.CSSProperties}>{inner}</div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />
}

function DietTargetsEditor() {
  const { data: targets, isLoading } = useDailyTargets()
  const update = useUpdateDailyTargets()
  const toast = useToast()

  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')

  useEffect(() => {
    if (!targets) return
    setProtein(String(Math.round(targets.protein_g)))
    setCarbs(String(Math.round(targets.carbs_g)))
    setFat(String(Math.round(targets.fat_g)))
  }, [targets])

  const proteinN = Number(protein)
  const carbsN = Number(carbs)
  const fatN = Number(fat)
  const valid =
    Number.isFinite(proteinN) && proteinN > 0 &&
    Number.isFinite(carbsN) && carbsN > 0 &&
    Number.isFinite(fatN) && fatN > 0

  const derivedKcal = valid ? proteinN * 4 + carbsN * 4 + fatN * 9 : 0

  const pristine =
    !!targets &&
    proteinN === Math.round(targets.protein_g) &&
    carbsN === Math.round(targets.carbs_g) &&
    fatN === Math.round(targets.fat_g)

  async function handleSave() {
    if (!valid || pristine) return
    try {
      await update.mutateAsync({
        protein_g: proteinN,
        carbs_g: carbsN,
        fat_g: fatN,
      })
      toast.showSuccess('Targets updated')
    } catch {
      toast.showError('Failed to update targets')
    }
  }

  if (isLoading && !targets) {
    return <div style={{ padding: '14px 16px', color: 'var(--text-m)', fontSize: 13 }}>Loading…</div>
  }

  return (
    <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <TargetRow label="Protein" value={protein} onChange={setProtein} />
      <TargetRow label="Carbs" value={carbs} onChange={setCarbs} />
      <TargetRow label="Fat" value={fat} onChange={setFat} />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingTop: 10,
          borderTop: '1px solid rgba(255,255,255,0.05)',
        }}
      >
        <span style={{ fontSize: 14, color: 'var(--text-1)' }}>Calories</span>
        <span
          style={{
            fontSize: 13,
            color: 'var(--text-2)',
            fontFamily: 'JetBrains Mono, ui-monospace, monospace',
          }}
        >
          {valid ? Math.round(derivedKcal).toLocaleString() : '—'}
          <span style={{ color: 'var(--text-m)', fontSize: 10, marginLeft: 4 }}>kcal · auto</span>
        </span>
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={!valid || pristine || update.isPending}
        className="btn-primary"
        style={{
          marginTop: 6,
          padding: '10px 14px',
          fontSize: 13,
          fontWeight: 500,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          letterSpacing: '0.05em',
          opacity: !valid || pristine || update.isPending ? 0.5 : 1,
          cursor: !valid || pristine || update.isPending ? 'not-allowed' : 'pointer',
        }}
      >
        {update.isPending ? 'Saving…' : 'Save'}
      </button>
    </div>
  )
}

function TargetRow({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span style={{ flex: 1, fontSize: 14, color: 'var(--text-1)' }}>{label}</span>
      <input
        type="number"
        inputMode="decimal"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="input"
        style={{ width: 90, textAlign: 'right' }}
      />
      <span
        style={{
          width: 14,
          fontSize: 11,
          color: 'var(--text-m)',
          fontFamily: 'JetBrains Mono, ui-monospace, monospace',
        }}
      >
        g
      </span>
    </label>
  )
}

function Chevron({ rotated }: { rotated: boolean }) {
  return (
    <span
      style={{
        color: 'var(--text-m)',
        display: 'inline-flex',
        transition: 'transform 0.2s',
        transform: rotated ? 'rotate(90deg)' : 'rotate(0deg)',
      }}
    >
      <ChevronRightIcon className="w-3.5 h-3.5" />
    </span>
  )
}
