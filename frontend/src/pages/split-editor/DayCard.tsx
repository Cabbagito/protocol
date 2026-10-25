import { useEffect, useRef, useState } from 'react'
import { getMuscleColor } from '../../lib/muscleColors'
import type { Exercise } from '../../types'
import type { DayState } from '../SplitEditor'
import ExerciseSearch from './ExerciseSearch'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

interface DayCardProps {
  day: DayState
  index: number
  isExpanded: boolean
  isSearchOpen: boolean
  isEditingName: boolean
  canDelete: boolean
  /** Seeded template: view only — no renaming, adding, removing or deleting. */
  readOnly?: boolean
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
  index,
  isExpanded,
  isSearchOpen,
  isEditingName,
  canDelete,
  readOnly = false,
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

  function commitName() {
    onFinishRename(localName)
  }

  return (
    <div
      style={{
        borderRadius: 14,
        background: 'var(--glass)',
        border: isExpanded
          ? '1px solid rgba(var(--accent-rgb),0.30)'
          : '1px solid var(--line)',
        overflow: 'hidden',
      }}
    >
      {/* Header: a div, not a button, so the name input and the icon buttons
          aren't nested inside another button (iOS won't type into those). */}
      <div
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={(e) => {
          if ((e.target as HTMLElement).closest('button, input')) return
          onToggle()
        }}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault()
            onToggle()
          }
        }}
        style={{
          width: '100%',
          padding: '12px 14px',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          cursor: 'pointer',
          background: 'transparent',
          border: 'none',
          textAlign: 'left',
          color: 'inherit',
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
            flexShrink: 0,
          }}
        >
          D{index + 1}
        </span>

        {isEditingName ? (
          <input
            ref={nameInputRef}
            value={localName}
            onChange={(e) => setLocalName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') commitName()
            }}
            onBlur={commitName}
            placeholder="Day name…"
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              borderBottom: '1.5px solid var(--accent)',
              color: 'var(--text-1)',
              fontSize: 14,
              fontWeight: 600,
              outline: 'none',
              padding: 0,
              minWidth: 0,
            }}
          />
        ) : (
          <span
            style={{
              flex: 1,
              fontSize: 14,
              fontWeight: 600,
              color: isExpanded ? 'var(--text-1)' : 'var(--text-2)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              minWidth: 0,
            }}
          >
            {day.name || (
              <span style={{ color: 'var(--text-m)', fontWeight: 400, fontStyle: 'italic' }}>Untitled</span>
            )}
          </span>
        )}

        <span
          style={{
            fontSize: 10,
            color: 'var(--text-m)',
            fontFamily: MONO,
            fontWeight: 600,
            flexShrink: 0,
          }}
        >
          {day.exercises.length} {day.exercises.length === 1 ? 'lift' : 'lifts'}
        </span>

        {!readOnly && !isEditingName && (
          <button
            type="button"
            onClick={onStartRename}
            aria-label="Rename day"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-m)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
              <path d="M12 20h9" />
              <path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4Z" />
            </svg>
          </button>
        )}

        {canDelete && !readOnly && (
          <button
            type="button"
            onClick={onDelete}
            aria-label="Delete day"
            style={{
              width: 26,
              height: 26,
              borderRadius: 8,
              background: 'transparent',
              border: 'none',
              color: 'var(--text-m)',
              display: 'grid',
              placeItems: 'center',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        )}

        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--text-m)"
          strokeWidth={2}
          strokeLinecap="round"
          style={{
            transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
            flexShrink: 0,
          }}
        >
          <path d="M9 18l6-6-6-6" />
        </svg>
      </div>

      {/* Body */}
      <div
        style={{
          overflow: 'hidden',
          maxHeight: isExpanded ? 4000 : 0,
          transition: 'max-height 0.3s ease',
        }}
      >
        <div style={{ padding: '0 12px 12px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            {day.exercises.map((ex, i) => {
              const color = getMuscleColor(ex.muscle_group)
              return (
                <div
                  key={`${ex.exercise_id}-${i}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '9px 12px',
                    borderRadius: 10,
                    background: 'var(--fill-soft)',
                    border: '1px solid var(--line)',
                  }}
                >
                  <div
                    style={{
                      width: 2,
                      height: 18,
                      borderRadius: 1,
                      background: `linear-gradient(180deg, ${color.primary}, ${color.light})`,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: 13,
                        color: 'var(--text-1)',
                        fontWeight: 500,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {ex.exercise_name}
                    </div>
                    <div
                      style={{
                        fontSize: 9,
                        color: color.text,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        fontFamily: MONO,
                        fontWeight: 600,
                      }}
                    >
                      {ex.muscle_group}
                    </div>
                  </div>
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => onRemoveExercise(i)}
                      aria-label={`Remove ${ex.exercise_name}`}
                      style={{
                        width: 24,
                        height: 24,
                        borderRadius: 6,
                        background: 'transparent',
                        border: 'none',
                        color: 'var(--text-m)',
                        cursor: 'pointer',
                        display: 'grid',
                        placeItems: 'center',
                      }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round">
                        <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                      </svg>
                    </button>
                  )}
                </div>
              )
            })}

            {day.exercises.length === 0 && !isSearchOpen && (
              <div
                style={{
                  padding: '14px 12px',
                  textAlign: 'center',
                  borderRadius: 10,
                  border: '1px dashed var(--fill-strong)',
                }}
              >
                <span
                  style={{
                    fontSize: 10,
                    color: 'var(--text-m)',
                    letterSpacing: '0.18em',
                    fontFamily: MONO,
                    fontWeight: 600,
                  }}
                >
                  NO LIFTS YET
                </span>
              </div>
            )}

            {readOnly ? null : isSearchOpen ? (
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
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 6,
                  padding: '10px 12px',
                  borderRadius: 10,
                  background: 'transparent',
                  border: '1px dashed var(--fill-strong)',
                  color: 'var(--accent-l)',
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                Add lift
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
