import { useState } from 'react'
import MuscleGroupBadge from '../../components/MuscleGroupBadge'
import BottomSheet from '../../components/BottomSheet'
import { getMuscleColor } from '../../lib/muscleColors'
import { EllipsisIcon, ReplaceIcon, SkipIcon, UnskipIcon, NoteIcon, TrashIcon } from './icons'
import { SetRow } from './SetRow'
import type { WorkingSet, MesoExercise } from '../../types'

export interface ExerciseCardProps {
  exercise: MesoExercise
  exerciseIndex: number
  sets: WorkingSet[]
  allSets: WorkingSet[]
  targetRir: number
  onUpdateSet: (exerciseId: string, setNum: number, field: keyof WorkingSet, value: number | boolean | string) => void
  onCompleteSet: (exerciseId: string, setNum: number) => void
  onUncompleteSet: (exerciseId: string, setNum: number) => void
  locked?: boolean
  skipped: boolean
  onToggleSkip: () => void
  note?: string
  onEditNote: () => void
  onReplace: () => void
  onAddSet: (exerciseId: string) => void
  onRemoveSet: (exerciseId: string, setNum: number) => void
  onToggleSkipSet: (exerciseId: string, setNum: number) => void
  onRemoveExercise: () => void
  skippedSets: Set<string>
  animPhaseRef: React.MutableRefObject<Map<string, 'saving' | 'success'>>
  onClearAnim: (exerciseId: string, setNum: number) => void
}

export function ExerciseCard({ exercise, sets, allSets, targetRir, onUpdateSet, onCompleteSet, onUncompleteSet, locked, skipped, onToggleSkip, note, onEditNote, onReplace, onAddSet, onRemoveSet, onToggleSkipSet, onRemoveExercise, skippedSets, animPhaseRef, onClearAnim }: ExerciseCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const color = getMuscleColor(exercise.muscle_group)

  return (
    <>
    <div className="exercise-card" style={{ borderColor: skipped ? 'rgba(255,255,255,0.04)' : color.cardBorder, opacity: skipped ? 0.6 : 1 }}>
      {/* Header row */}
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <MuscleGroupBadge muscleGroup={exercise.muscle_group} />
          {skipped && (
            <span
              className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
              style={{ background: 'rgba(148,163,184,0.1)', color: 'var(--text-2)' }}
            >
              Skipped
            </span>
          )}
        </div>
        {!locked && (
          <button
            onClick={() => setMenuOpen(true)}
            className="p-1.5 -mr-1 -mt-0.5 rounded-lg active:bg-white/5"
          >
            <EllipsisIcon />
          </button>
        )}
      </div>

      {/* Exercise name + equipment */}
      <div className="mb-1">
        <h2 className="text-base font-semibold text-[var(--text-1)]">{exercise.exercise_name}</h2>
        {exercise.equipment_type && (
          <span className="text-xs text-[var(--text-m)] capitalize">{exercise.equipment_type}</span>
        )}
      </div>

      {/* Note */}
      {note && (
        <div className="mb-2 px-2 py-1.5 rounded-md" style={{ background: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.1)' }}>
          <p className="text-[11px] text-amber-400/80 leading-relaxed">{note}</p>
        </div>
      )}

      {/* Sets panel */}
      <div className="panel-frosted">
        {/* Column headers */}
        <div className="flex items-center mb-2 px-2 pt-1">
          <div className="w-8 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            #
          </div>
          <div className="flex-1 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            Weight
          </div>
          <div className="flex-1 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            Reps
          </div>
          <div className="w-12 text-center text-[11px] font-medium uppercase tracking-wider text-[var(--text-m)]">
            Log
          </div>
        </div>

        {/* Set rows */}
        <div className="space-y-1.5">
        {sets.map((set) => {
          const setSkipKey = `${exercise.exercise_id}:${set.set_num}`
          const isSetSkipped = skippedSets.has(setSkipKey)
          const canDelete = !set.completed && !locked && sets.length > 1
          return (
            <div key={set.set_num}>
              <SetRow
                set={set}
                exercise={exercise}
                allSets={allSets}
                targetRir={targetRir}
                onUpdate={onUpdateSet}
                onComplete={onCompleteSet}
                onUncomplete={onUncompleteSet}
                locked={locked}
                isSkipped={isSetSkipped}
                onSkipSet={() => onToggleSkipSet(exercise.exercise_id, set.set_num)}
                onRemoveSet={() => onRemoveSet(exercise.exercise_id, set.set_num)}
                canRemove={canDelete}
                animPhase={animPhaseRef.current.get(`${exercise.exercise_id}:${set.set_num}`)}
                onClearAnim={onClearAnim}
                strikethrough={isSetSkipped}
              />
            </div>
          )
        })}
        </div>

        {/* Add Set button */}
        {!locked && (
          <button
            onClick={() => onAddSet(exercise.exercise_id)}
            className="w-full py-2 text-center text-xs font-medium active:bg-white/5 rounded-b-lg"
            style={{ color: 'var(--text-m)', opacity: 0.6 }}
          >
            + Add Set
          </button>
        )}
      </div>
    </div>

    <BottomSheet
      open={menuOpen}
      onClose={() => setMenuOpen(false)}
      title={exercise.exercise_name}
      actions={[
        {
          label: 'Replace Exercise',
          icon: <ReplaceIcon />,
          onClick: onReplace,
        },
        {
          label: skipped ? 'Unskip Exercise' : 'Skip Exercise',
          icon: skipped ? <UnskipIcon /> : <SkipIcon />,
          onClick: onToggleSkip,
        },
        {
          label: note ? 'Edit Note' : 'Add Note',
          icon: <NoteIcon />,
          onClick: onEditNote,
        },
        {
          label: 'Remove Exercise',
          icon: <TrashIcon />,
          onClick: onRemoveExercise,
          variant: 'danger' as const,
        },
      ]}
    />
    </>
  )
}
