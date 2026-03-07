import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useToast } from '../components/Toast'
import AppHeader from '../components/AppHeader'
import PageLoader from '../components/PageLoader'
import { useSplit, useCreateSplit, useUpdateSplit, useDeleteSplit, useExercises } from '../api/hooks'
import { getMuscleColor } from '../lib/muscleColors'
import type { Exercise } from '../types'

const SPLIT_COLORS = [
  '#14b8a6', '#6366f1', '#f97316', '#ec4899',
  '#22c55e', '#eab308', '#06b6d4', '#f43f5e',
]

interface DayState {
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
  const [showColorPicker, setShowColorPicker] = useState(false)
  const [days, setDays] = useState<DayState[]>([{ tempId: 1, name: '', exercises: [] }])
  const [expandedDay, setExpandedDay] = useState<number>(1)
  const [searchOpenDay, setSearchOpenDay] = useState<number | null>(null)
  const [editingNameDay, setEditingNameDay] = useState<number | null>(1)
  const [initialized, setInitialized] = useState(!isEdit)
  const nextTempId = useRef(2)

  // Load existing split data
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

  const handleAddDay = useCallback(() => {
    const tid = nextTempId.current++
    setDays((prev) => [...prev, { tempId: tid, name: '', exercises: [] }])
    setExpandedDay(tid)
    setEditingNameDay(tid)
    setSearchOpenDay(null)
  }, [])

  const handleDeleteDay = useCallback((tempId: number) => {
    setDays((prev) => {
      if (prev.length <= 1) return prev
      return prev.filter((d) => d.tempId !== tempId)
    })
    setExpandedDay((prev) => (prev === tempId ? -1 : prev))
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
          : d
      )
    )
  }, [])

  const handleRemoveExercise = useCallback((dayTempId: number, exIndex: number) => {
    setDays((prev) =>
      prev.map((d) =>
        d.tempId === dayTempId
          ? { ...d, exercises: d.exercises.filter((_, i) => i !== exIndex) }
          : d
      )
    )
  }, [])

  const handleRenameDayDone = useCallback((dayTempId: number, newName: string) => {
    setDays((prev) =>
      prev.map((d) => (d.tempId === dayTempId ? { ...d, name: newName } : d))
    )
    setEditingNameDay(null)
  }, [])

  const handleSave = async () => {
    if (!name.trim()) {
      toast.showError('Split name is required')
      return
    }
    const payload = {
      name: name.trim(),
      color,
      days: days.map((d) => ({
        name: d.name || `Day ${days.indexOf(d) + 1}`,
        exercises: d.exercises.map((ex) => ({ exercise_id: ex.exercise_id })),
      })),
    }

    try {
      if (isEdit) {
        await updateSplit.mutateAsync(payload)
      } else {
        await createSplit.mutateAsync(payload)
      }
      navigate('/splits')
    } catch {
      toast.showError(`Failed to ${isEdit ? 'update' : 'create'} split`)
    }
  }

  const handleDelete = async () => {
    if (!id || !confirm('Delete this split? This cannot be undone.')) return
    try {
      await deleteSplit.mutateAsync(id)
      navigate('/splits')
    } catch {
      toast.showError('Failed to delete split')
    }
  }

  const isSaving = createSplit.isPending || updateSplit.isPending

  if (isEdit && splitLoading) {
    return <PageLoader className="min-h-[60vh]" />
  }

  return (
    <div>
      <AppHeader
        title={isEdit ? 'Edit Split' : 'New Split'}
        breadcrumb={{ label: 'Splits', to: '/splits' }}
      />

      <div className="px-4">
        {/* Name + Color row */}
        <div className="flex gap-2.5 items-center mb-4 relative">
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Split name..."
            className="flex-1 h-11 rounded-xl font-semibold text-[15px] px-3.5 outline-none transition-colors"
            style={{
              background: 'var(--input)',
              border: '1.5px solid var(--border)',
              color: 'var(--text-1)',
            }}
            autoFocus={!isEdit}
          />
          <button
            type="button"
            onClick={() => setShowColorPicker(!showColorPicker)}
            className="w-9 h-9 rounded-full shrink-0 transition-transform active:scale-90"
            style={{
              background: color,
              boxShadow: `0 0 0 2.5px var(--base), 0 0 0 4.5px ${color}`,
            }}
          />
          {showColorPicker && (
            <div
              className="absolute right-0 top-12 z-50 flex flex-wrap gap-2 p-2.5 rounded-xl"
              style={{
                background: 'var(--card)',
                border: '1px solid var(--border)',
                boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                width: 160,
              }}
            >
              {SPLIT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(c); setShowColorPicker(false) }}
                  className="w-7 h-7 rounded-full transition-transform active:scale-85"
                  style={{
                    background: c,
                    boxShadow: color === c ? `0 0 0 2.5px var(--card), 0 0 0 4px ${c}` : 'none',
                  }}
                />
              ))}
            </div>
          )}
        </div>

        {/* Day cards */}
        <div className="space-y-2 mb-3">
          {days.map((day) => (
            <DayCard
              key={day.tempId}
              day={day}
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
              onRemoveExercise={(idx) => handleRemoveExercise(day.tempId, idx)}
              onOpenSearch={() => setSearchOpenDay(day.tempId)}
              onCloseSearch={() => setSearchOpenDay(null)}
              onStartRename={() => setEditingNameDay(day.tempId)}
              onFinishRename={(newName) => handleRenameDayDone(day.tempId, newName)}
            />
          ))}
        </div>

        {/* Add Day */}
        <button
          type="button"
          onClick={handleAddDay}
          className="flex items-center justify-center gap-1.5 w-full py-3.5 rounded-xl mb-3 text-[13px] font-semibold transition-all active:scale-[0.98]"
          style={{
            border: '1.5px dashed var(--border)',
            color: 'var(--accent-l)',
            background: 'transparent',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
          Add Day
        </button>

        <div className="h-px mb-3" style={{ background: 'var(--border)', opacity: 0.5 }} />

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={isSaving || !name.trim()}
          className="flex items-center justify-center w-full h-12 rounded-[14px] text-[15px] font-bold text-white transition-all active:scale-[0.98] disabled:opacity-50"
          style={{
            background: 'var(--accent)',
            boxShadow: '0 4px 16px rgba(14,165,233,0.25)',
          }}
        >
          {isSaving ? 'Saving...' : isEdit ? 'Save Split' : 'Create Split'}
        </button>

        {/* Delete (edit mode only) */}
        {isEdit && (
          <button
            onClick={handleDelete}
            className="w-full py-3 mt-4 text-sm font-medium text-red-400 rounded-lg border border-red-400/20 hover:bg-red-400/5 transition-colors"
          >
            Delete Split
          </button>
        )}
      </div>
    </div>
  )
}

// --- Day Card ---

interface DayCardProps {
  day: DayState
  isExpanded: boolean
  isSearchOpen: boolean
  isEditingName: boolean
  canDelete: boolean
  allExercises: Exercise[]
  onToggle: () => void
  onDelete: () => void
  onAddExercise: (ex: Exercise) => void
  onRemoveExercise: (index: number) => void
  onOpenSearch: () => void
  onCloseSearch: () => void
  onStartRename: () => void
  onFinishRename: (name: string) => void
}

function DayCard({
  day,
  isExpanded,
  isSearchOpen,
  isEditingName,
  canDelete,
  allExercises,
  onToggle,
  onDelete,
  onAddExercise,
  onRemoveExercise,
  onOpenSearch,
  onCloseSearch,
  onStartRename,
  onFinishRename,
}: DayCardProps) {
  const nameInputRef = useRef<HTMLInputElement>(null)
  const [localName, setLocalName] = useState(day.name)

  useEffect(() => {
    setLocalName(day.name)
  }, [day.name])

  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus()
      nameInputRef.current.select()
    }
  }, [isEditingName])

  const commitName = () => {
    onFinishRename(localName)
  }

  return (
    <div
      className="rounded-xl overflow-hidden transition-shadow"
      style={{
        background: 'var(--card)',
        boxShadow: isExpanded ? '0 4px 16px rgba(0,0,0,0.5)' : '0 2px 8px rgba(0,0,0,0.3)',
        border: isExpanded ? '1px solid rgba(56,189,248,0.1)' : '1px solid rgba(255,255,255,0.04)',
      }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2.5 px-3.5 py-3 cursor-pointer select-none active:bg-white/[0.02]"
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('.day-delete') || (e.target as HTMLElement).closest('.day-name-input')) return
          onToggle()
        }}
      >
        <svg
          className="w-4 h-4 shrink-0 transition-transform duration-200"
          style={{ color: 'var(--text-m)', transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"
        >
          <path d="M9 18l6-6-6-6" />
        </svg>

        {isEditingName ? (
          <input
            ref={nameInputRef}
            className="day-name-input flex-1 bg-transparent border-b-[1.5px] border-b-[var(--accent)] text-[14px] font-semibold outline-none pb-0.5 min-w-0"
            style={{ color: 'var(--text-1)', border: 'none', borderBottom: '1.5px solid var(--accent)' }}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') commitName()
            }}
            onBlur={commitName}
            placeholder="Day name..."
          />
        ) : (
          <span
            className="flex-1 text-[14px] font-semibold truncate"
            style={{ color: 'var(--text-1)' }}
            onDoubleClick={(e) => {
              e.stopPropagation()
              onStartRename()
            }}
          >
            {day.name || 'Untitled'}
          </span>
        )}

        {!isExpanded && (
          <span
            className="text-[11px] font-medium px-2 py-0.5 rounded-[10px] mono"
            style={{ color: 'var(--text-m)', background: 'var(--panel)' }}
          >
            {day.exercises.length}
          </span>
        )}

        {canDelete && (
          <button
            type="button"
            className="day-delete w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors hover:bg-red-500/10 hover:text-red-400"
            style={{ color: 'var(--text-m)' }}
            onClick={(e) => {
              e.stopPropagation()
              onDelete()
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Body */}
      <div
        className="overflow-hidden transition-all duration-300"
        style={{ maxHeight: isExpanded ? 2000 : 0 }}
      >
        <div className="px-3.5 pb-3.5">
          {/* Exercise list */}
          {day.exercises.length > 0 && (
            <div className="flex flex-col gap-0.5">
              {day.exercises.map((ex, i) => {
                const color = getMuscleColor(ex.muscle_group)
                return (
                  <div
                    key={`${ex.exercise_id}-${i}`}
                    className="flex items-center gap-2.5 px-2.5 py-2 rounded-lg hover:bg-white/[0.02] transition-colors"
                  >
                    <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color.primary }} />
                    <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>
                      {ex.exercise_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => onRemoveExercise(i)}
                      className="w-[22px] h-[22px] rounded-md flex items-center justify-center opacity-50 hover:opacity-100 hover:bg-red-500/10 hover:text-red-400 transition-all"
                      style={{ color: 'var(--text-m)' }}
                    >
                      &times;
                    </button>
                  </div>
                )
              })}
            </div>
          )}

          {/* Add exercise / search */}
          {isSearchOpen ? (
            <ExerciseSearch
              allExercises={allExercises}
              addedExerciseIds={day.exercises.map((e) => e.exercise_id)}
              onAdd={onAddExercise}
              onDone={onCloseSearch}
            />
          ) : (
            <button
              type="button"
              onClick={onOpenSearch}
              className="flex items-center gap-1.5 py-2.5 px-2.5 w-full text-[12px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: 'var(--accent-l)' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
              Add exercise
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Exercise Search ---

function ExerciseSearch({
  allExercises,
  addedExerciseIds,
  onAdd,
  onDone,
}: {
  allExercises: Exercise[]
  addedExerciseIds: string[]
  onAdd: (ex: Exercise) => void
  onDone: () => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setTimeout(() => inputRef.current?.focus(), 50)
  }, [])

  const grouped = useMemo(() => {
    const addedSet = new Set(addedExerciseIds)
    const available = allExercises.filter((ex) => !addedSet.has(ex.id))
    const q = query.toLowerCase().trim()
    const filtered = q
      ? available.filter(
          (ex) =>
            ex.name.toLowerCase().includes(q) ||
            ex.muscle_group.toLowerCase().includes(q) ||
            ex.equipment_type.toLowerCase().includes(q)
        )
      : available

    const groups: Record<string, Exercise[]> = {}
    for (const ex of filtered) {
      const mg = ex.muscle_group
      if (!groups[mg]) groups[mg] = []
      groups[mg]!.push(ex)
    }

    return Object.entries(groups).sort((a, b) => b[1].length - a[1].length)
  }, [allExercises, addedExerciseIds, query])

  return (
    <div className="mt-1">
      {/* Search input */}
      <div className="relative mb-1.5">
        <svg
          className="absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none"
          width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-m)" strokeWidth={2}
        >
          <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search exercises..."
          className="w-full h-[38px] rounded-[10px] text-[13px] pl-[34px] pr-2.5 outline-none transition-colors"
          style={{
            background: 'var(--input)',
            border: '1.5px solid var(--border)',
            color: 'var(--text-1)',
          }}
          autoComplete="off"
        />
      </div>

      {/* Results */}
      <div
        className="max-h-[300px] overflow-y-auto rounded-lg flex flex-col"
        style={{ background: 'var(--panel)', border: '1px solid rgba(255,255,255,0.04)' }}
      >
        {grouped.length === 0 ? (
          <div className="py-4 text-center text-[12px]" style={{ color: 'var(--text-m)' }}>
            No exercises found
          </div>
        ) : (
          grouped.map(([mg, exercises]) => {
            const color = getMuscleColor(mg)
            return (
              <div key={mg}>
                <div
                  className="text-[10px] font-bold uppercase tracking-wider px-3 pt-2 pb-1 sticky top-0 z-[1]"
                  style={{ color: color.primary, background: 'var(--panel)' }}
                >
                  {mg}
                </div>
                {exercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors hover:bg-[var(--input)] active:bg-[rgba(14,165,233,0.08)]"
                    onClick={() => onAdd(ex)}
                  >
                    <div className="w-[7px] h-[7px] rounded-full shrink-0" style={{ background: color.primary }} />
                    <span className="flex-1 text-[13px] font-medium" style={{ color: 'var(--text-1)' }}>
                      {ex.name}
                    </span>
                    <span className="text-[10px] font-medium capitalize" style={{ color: 'var(--text-m)' }}>
                      {ex.equipment_type}
                    </span>
                    <div
                      className="w-[22px] h-[22px] rounded-md flex items-center justify-center text-[15px] transition-all"
                      style={{
                        border: '1.5px solid var(--border)',
                        color: 'var(--accent-l)',
                      }}
                    >
                      +
                    </div>
                  </div>
                ))}
              </div>
            )
          })
        )}
      </div>

      {/* Done button */}
      <button
        type="button"
        onClick={onDone}
        className="flex items-center justify-center w-full py-2 mt-1.5 rounded-lg text-[12px] font-semibold transition-colors hover:border-[var(--accent)] hover:text-[var(--accent-l)]"
        style={{
          border: '1px solid var(--border)',
          background: 'var(--panel)',
          color: 'var(--text-2)',
        }}
      >
        Done
      </button>
    </div>
  )
}
