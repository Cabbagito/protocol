import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import AuroraBackground from '../components/AuroraBackground'
import PageLoader from '../components/PageLoader'
import { useToast } from '../components/Toast'
import {
  useSplit,
  useCreateSplit,
  useUpdateSplit,
  useDeleteSplit,
  useExercises,
} from '../api/hooks'
import type { Exercise } from '../types'
import DayCard from './split-editor/DayCard'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

const SPLIT_COLORS = [
  '#0ea5e9', '#14b8a6', '#6366f1', '#a855f7',
  '#f97316', '#eab308', '#22c55e', '#ec4899',
]

export interface DayState {
  tempId: number
  name: string
  exercises: { exercise_id: string; exercise_name: string; muscle_group: string }[]
}

export default function SplitEditor() {
  const { id } = useParams<{ id: string }>()
  const isEdit = !!id
  const navigate = useNavigate()
  const toast = useToast()

  const { data: existingSplit, isLoading: splitLoading } = useSplit(id ?? '')
  const { data: allExercises = [] } = useExercises()
  const createSplit = useCreateSplit()
  const updateSplit = useUpdateSplit(id ?? '')
  const deleteSplit = useDeleteSplit()

  const [name, setName] = useState('')
  const [color, setColor] = useState<string>(SPLIT_COLORS[0]!)
  const [editingName, setEditingName] = useState(!isEdit)
  const [days, setDays] = useState<DayState[]>([{ tempId: 1, name: '', exercises: [] }])
  const [expandedDay, setExpandedDay] = useState<number>(1)
  const [searchOpenDay, setSearchOpenDay] = useState<number | null>(null)
  const [editingNameDay, setEditingNameDay] = useState<number | null>(1)
  const [initialized, setInitialized] = useState(!isEdit)
  const nextTempId = useRef(2)
  const [dirty, setDirty] = useState(false)
  const nameInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isEdit && existingSplit && !initialized) {
      setName(existingSplit.name)
      setColor(existingSplit.color || SPLIT_COLORS[0]!)
      const loadedDays = existingSplit.days.map((d, i) => ({
        tempId: i + 1,
        name: d.name,
        exercises: d.exercises.map((ex) => ({
          exercise_id: ex.exercise_id,
          exercise_name: ex.exercise_name,
          muscle_group: ex.muscle_group,
        })),
      }))
      if (loadedDays.length > 0) {
        setDays(loadedDays)
        setExpandedDay(loadedDays[0]!.tempId)
        setEditingNameDay(null)
        nextTempId.current = loadedDays.length + 1
      }
      setInitialized(true)
    }
  }, [isEdit, existingSplit, initialized])

  useEffect(() => {
    if (editingName) {
      setTimeout(() => nameInputRef.current?.focus(), 50)
    }
  }, [editingName])

  function markDirty() { setDirty(true) }

  const handleAddDay = useCallback(() => {
    const tid = nextTempId.current++
    setDays((prev) => [...prev, { tempId: tid, name: '', exercises: [] }])
    setExpandedDay(tid)
    setEditingNameDay(tid)
    setSearchOpenDay(null)
    markDirty()
  }, [])

  const handleDeleteDay = useCallback((tempId: number) => {
    setDays((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((d) => d.tempId !== tempId)
    })
    setExpandedDay((prev) => (prev === tempId ? -1 : prev))
    markDirty()
  }, [])

  const handleAddExercise = useCallback((dayTempId: number, exercise: Exercise) => {
    setDays((prev) =>
      prev.map((d) =>
        d.tempId === dayTempId
          ? {
              ...d,
              exercises: [
                ...d.exercises,
                { exercise_id: exercise.id, exercise_name: exercise.name, muscle_group: exercise.muscle_group },
              ],
            }
          : d,
      ),
    )
    markDirty()
  }, [])

  const handleRemoveExercise = useCallback((dayTempId: number, exIndex: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.tempId === dayTempId
          ? { ...d, exercises: d.exercises.filter((_, i) => i !== exIndex) }
          : d,
      ),
    )
    markDirty()
  }, [])

  const handleRenameDayDone = useCallback((dayTempId: number, newName: string) => {
    setDays((prev) =>
      prev.map((d) => (d.tempId === dayTempId ? { ...d, name: newName } : d)),
    )
    setEditingNameDay(null)
    markDirty()
  }, [])

  async function handleSave() {
    if (!name.trim()) {
      toast.showError('Split name is required')
      return
    }
    const payload = {
      name: name.trim(),
      color,
      days: days.map((d, idx) => ({
        name: d.name || `Day ${idx + 1}`,
        exercises: d.exercises.map((ex) => ({ exercise_id: ex.exercise_id })),
      })),
    }
    try {
      if (isEdit) await updateSplit.mutateAsync(payload)
      else await createSplit.mutateAsync(payload)
      navigate('/splits')
    } catch {
      toast.showError(`Failed to ${isEdit ? 'update' : 'create'} split`)
    }
  }

  async function handleDelete() {
    if (!id || !confirm('Delete this split? This cannot be undone.')) return
    try {
      await deleteSplit.mutateAsync(id)
      navigate('/splits')
    } catch {
      toast.showError('Failed to delete split')
    }
  }

  function handleDiscard() {
    if (dirty && !confirm('Discard your changes?')) return
    navigate('/splits')
  }

  const isSaving = createSplit.isPending || updateSplit.isPending

  if (isEdit && splitLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--deep)' }}>
        <PageLoader className="min-h-[60vh]" />
      </div>
    )
  }

  const eyebrow = isEdit
    ? dirty
      ? 'EDIT SPLIT · UNSAVED'
      : 'EDIT SPLIT'
    : 'NEW SPLIT'

  const accentLight = `color-mix(in oklab, ${color} 70%, white)`

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

      <div style={{ position: 'relative', zIndex: 1, padding: '12px 22px 200px' }}>
        <Chrome
          title={name || 'Untitled split'}
          sub={eyebrow}
          onBack={() => navigate('/splits')}
        />

        {/* Name + color swatch row */}
        <div
          style={{
            padding: 14,
            borderRadius: 14,
            background: 'rgba(15,29,46,0.5)',
            border: '1px solid rgba(255,255,255,0.05)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${color}, ${accentLight})`,
              boxShadow: `0 0 16px ${color}`,
              flexShrink: 0,
            }}
          />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: 9,
                color: 'var(--text-m)',
                letterSpacing: '0.18em',
                fontFamily: MONO,
                fontWeight: 600,
              }}
            >
              SPLIT NAME
            </div>
            {editingName ? (
              <input
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => { setName(e.target.value); markDirty() }}
                onBlur={() => setEditingName(false)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === 'Escape') setEditingName(false) }}
                placeholder="Upper / Lower"
                style={{
                  width: '100%',
                  marginTop: 2,
                  background: 'transparent',
                  border: 'none',
                  borderBottom: '1.5px solid var(--accent)',
                  color: 'var(--text-1)',
                  fontSize: 15,
                  fontWeight: 600,
                  outline: 'none',
                  padding: 0,
                }}
              />
            ) : (
              <button
                type="button"
                onClick={() => setEditingName(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: 0,
                  textAlign: 'left',
                  color: 'var(--text-1)',
                  fontSize: 15,
                  fontWeight: 600,
                  cursor: 'text',
                  marginTop: 2,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  maxWidth: '100%',
                  display: 'block',
                }}
              >
                {name || <span style={{ color: 'var(--text-m)' }}>Untitled split</span>}
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={() => setEditingName(true)}
            aria-label="Edit name"
            style={{
              width: 28,
              height: 28,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-m)',
              cursor: 'pointer',
              display: 'grid',
              placeItems: 'center',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        </div>

        {/* Color picker row */}
        <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
          {SPLIT_COLORS.map((c) => {
            const selected = c === color
            const light = `color-mix(in oklab, ${c} 70%, white)`
            return (
              <button
                key={c}
                type="button"
                onClick={() => { setColor(c); markDirty() }}
                aria-label={`Select color ${c}`}
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 10,
                  background: `linear-gradient(135deg, ${c}, ${light})`,
                  border: selected ? '2px solid var(--text-1)' : '1px solid rgba(255,255,255,0.05)',
                  outline: selected ? '2px solid rgba(255,255,255,0.1)' : 'none',
                  outlineOffset: 2,
                  boxShadow: selected ? `0 0 10px ${c}` : 'none',
                  cursor: 'pointer',
                  padding: 0,
                }}
              />
            )
          })}
        </div>

        {/* Days section */}
        <div style={{ marginTop: 22 }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              justifyContent: 'space-between',
              marginBottom: 10,
            }}
          >
            <Eyebrow>Days · {days.length}</Eyebrow>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {days.map((day, idx) => (
              <DayCard
                key={day.tempId}
                day={day}
                index={idx}
                isExpanded={expandedDay === day.tempId}
                isSearchOpen={searchOpenDay === day.tempId}
                isEditingName={editingNameDay === day.tempId}
                canDelete={days.length > 1}
                allExercises={allExercises}
                onToggle={() => {
                  setExpandedDay(expandedDay === day.tempId ? -1 : day.tempId)
                  setSearchOpenDay(null)
                  setEditingNameDay(null)
                }}
                onDelete={() => handleDeleteDay(day.tempId)}
                onAddExercise={(ex) => handleAddExercise(day.tempId, ex)}
                onRemoveExercise={(i) => handleRemoveExercise(day.tempId, i)}
                onOpenSearch={() => setSearchOpenDay(day.tempId)}
                onCloseSearch={() => setSearchOpenDay(null)}
                onStartRename={() => setEditingNameDay(day.tempId)}
                onFinishRename={(newName) => handleRenameDayDone(day.tempId, newName)}
              />
            ))}

            <button
              type="button"
              onClick={handleAddDay}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                padding: '12px 12px',
                borderRadius: 12,
                marginTop: 4,
                background: 'transparent',
                border: '1px dashed rgba(255,255,255,0.08)',
                color: 'var(--text-m)',
                fontSize: 12,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
              Add day
            </button>
          </div>
        </div>

        {isEdit && (
          <button
            onClick={handleDelete}
            style={{
              marginTop: 20,
              width: '100%',
              padding: '12px 14px',
              borderRadius: 12,
              background: 'transparent',
              border: '1px solid rgba(248,113,113,0.18)',
              color: 'rgba(248,113,113,0.8)',
              fontSize: 13,
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Delete split
          </button>
        )}
      </div>

      {/* Sticky save bar */}
      <div
        style={{
          position: 'fixed',
          left: 18,
          right: 18,
          bottom: 'calc(env(safe-area-inset-bottom) + 96px)',
          maxWidth: 480,
          marginLeft: 'auto',
          marginRight: 'auto',
          padding: 8,
          borderRadius: 18,
          display: 'flex',
          gap: 8,
          zIndex: 100,
          background: 'rgba(15,29,46,0.85)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.05)',
          boxShadow: '0 12px 40px -10px rgba(0,0,0,0.6)',
        }}
      >
        <button
          type="button"
          onClick={handleDiscard}
          style={{
            flex: 1,
            height: 42,
            borderRadius: 12,
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.05)',
            color: 'var(--text-2)',
            fontSize: 13,
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Discard
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          style={{
            flex: 2,
            height: 42,
            borderRadius: 12,
            background: 'var(--p-grad)',
            color: 'var(--btn-text)',
            fontSize: 13,
            fontWeight: 700,
            letterSpacing: '0.18em',
            fontFamily: MONO,
            border: 'none',
            cursor: 'pointer',
            opacity: isSaving || !name.trim() ? 0.5 : 1,
            boxShadow: '0 6px 20px -6px rgba(var(--accent-rgb),0.6)',
          }}
        >
          {isSaving ? 'SAVING…' : 'SAVE SPLIT'}
        </button>
      </div>
    </div>
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
