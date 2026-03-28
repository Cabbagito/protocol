import { useState, useEffect, useRef } from 'react'
import { getMuscleColor } from '../../lib/muscleColors'
import type { Exercise } from '../../types'
import type { DayState } from '../SplitEditor'
import ExerciseSearch from './ExerciseSearch'

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

export default function DayCard({
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
