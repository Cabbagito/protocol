import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  useCreateExercise,
  useDeleteExercise,
  useExercises,
  useUpdateExercise,
} from '../api/hooks'
import { useToast } from './Toast'
import { useScrollLock } from '../hooks/useScrollLock'
import { getMuscleColor } from '../lib/muscleColors'
import { MUSCLE_GROUP_ROWS, EQUIPMENT_TYPES } from './exerciseConstants'
import type { EquipmentType, Exercise } from '../types'

const MONO = 'JetBrains Mono, ui-monospace, monospace'

interface CreateExerciseSheetProps {
  open: boolean
  onClose: () => void
  /** Prefill for the name of a new exercise (e.g. the current search text). */
  initialName?: string
  /** Edit (and allow deleting) this user-owned exercise instead of creating one. */
  exercise?: Exercise | null
  /** Called with the created or updated exercise, after the sheet closes. */
  onSaved?: (exercise: Exercise) => void
}

/**
 * Bottom sheet to create a custom exercise (name, muscle group, equipment),
 * or edit / delete one the user owns. Portaled to <body> so it works from
 * inside any page, sheet or picker.
 */
export default function CreateExerciseSheet(props: CreateExerciseSheetProps) {
  useScrollLock(props.open)
  if (!props.open) return null
  // Keyed so every open starts from fresh form state.
  return createPortal(
    <ExerciseForm key={props.exercise?.id ?? 'new'} {...props} />,
    document.body,
  )
}

function ExerciseForm({ onClose, initialName = '', exercise, onSaved }: CreateExerciseSheetProps) {
  const toast = useToast()
  const { data: allExercises = [] } = useExercises()
  const createExercise = useCreateExercise()
  const updateExercise = useUpdateExercise()
  const deleteExercise = useDeleteExercise()

  const isEdit = !!exercise
  const [name, setName] = useState(exercise?.name ?? initialName.trim())
  const [muscle, setMuscle] = useState<string | null>(exercise?.muscle_group ?? null)
  const [equipment, setEquipment] = useState<EquipmentType | null>(exercise?.equipment_type ?? null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteBlocked, setDeleteBlocked] = useState(false)

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const trimmed = name.trim()
  const duplicate = allExercises.some(
    (ex) => ex.id !== exercise?.id && ex.name.trim().toLowerCase() === trimmed.toLowerCase(),
  )
  const pending = createExercise.isPending || updateExercise.isPending
  const canSave = trimmed.length > 0 && !duplicate && !!muscle && !!equipment && !pending

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave || !muscle || !equipment) return
    const data = { name: trimmed, muscle_group: muscle, equipment_type: equipment }
    try {
      const saved = exercise
        ? await updateExercise.mutateAsync({ id: exercise.id, data })
        : await createExercise.mutateAsync(data)
      onClose()
      onSaved?.(saved)
    } catch {
      toast.showError(`Couldn't ${isEdit ? 'save' : 'create'} the exercise`)
    }
  }

  async function handleDelete() {
    if (!exercise) return
    try {
      await deleteExercise.mutateAsync(exercise.id)
      toast.showSuccess(`Deleted ${exercise.name}`)
      onClose()
    } catch (err) {
      if ((err as { status?: number }).status === 409) {
        setDeleteBlocked(true)
        setConfirmDelete(false)
      } else {
        toast.showError("Couldn't delete the exercise")
      }
    }
  }

  return (
    <div className="fixed inset-0 z-[104] flex flex-col">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(0,0,0,0.6)' }}
        onClick={onClose}
      />
      <form
        onSubmit={handleSave}
        role="dialog"
        aria-modal="true"
        aria-labelledby="exercise-sheet-title"
        className="relative flex flex-col w-full max-w-lg mx-auto mt-auto rounded-t-2xl slide-up"
        style={{
          background: 'var(--base)',
          border: '1px solid var(--border)',
          borderBottom: 'none',
          maxHeight: 'calc(100dvh - env(safe-area-inset-top) - 24px)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        <div className="px-5 pt-4 pb-3 flex items-center justify-between border-b border-[var(--border)]">
          <div id="exercise-sheet-title" className="text-sm font-semibold text-[var(--text-1)]">
            {isEdit ? 'Edit exercise' : 'New exercise'}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 flex items-center justify-center rounded-full"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--text-2)' }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain px-5 py-4 space-y-5">
          <label className="block">
            <FieldLabel>Name</FieldLabel>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={100}
              placeholder="e.g. Landmine Press"
              className="input mt-1.5"
              autoFocus={!isEdit && !initialName}
            />
            {duplicate && (
              <div className="text-[11px] mt-1.5" style={{ color: '#f87171' }}>
                An exercise with this name already exists.
              </div>
            )}
          </label>

          <div role="radiogroup" aria-label="Muscle group">
            <FieldLabel>Muscle group</FieldLabel>
            <div className="mt-1.5 space-y-2">
              {MUSCLE_GROUP_ROWS.map((row) => (
                <div key={row.label} className="flex items-start gap-2">
                  <span
                    className="shrink-0 pt-[7px]"
                    style={{
                      width: 34,
                      fontSize: 9,
                      color: 'var(--text-m)',
                      letterSpacing: '0.2em',
                      fontFamily: MONO,
                      fontWeight: 600,
                      textTransform: 'uppercase',
                    }}
                  >
                    {row.label}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {row.groups.map((g) => {
                      const c = getMuscleColor(g)
                      const sel = muscle === g
                      return (
                        <button
                          key={g}
                          type="button"
                          role="radio"
                          aria-checked={sel}
                          onClick={() => setMuscle(g)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: 100,
                            background: sel ? `color-mix(in oklab, ${c.primary} 20%, transparent)` : 'transparent',
                            border: `1px solid ${sel ? `color-mix(in oklab, ${c.primary} 45%, transparent)` : 'rgba(255,255,255,0.08)'}`,
                            color: sel ? c.light : 'var(--text-2)',
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: '0.1em',
                            textTransform: 'uppercase',
                            fontFamily: MONO,
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: 5,
                          }}
                        >
                          <span style={{ width: 5, height: 5, borderRadius: '50%', background: c.primary }} />
                          {g}
                        </button>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div role="radiogroup" aria-label="Equipment">
            <FieldLabel>Equipment</FieldLabel>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {EQUIPMENT_TYPES.map((eq) => {
                const sel = equipment === eq
                return (
                  <button
                    key={eq}
                    type="button"
                    role="radio"
                    aria-checked={sel}
                    onClick={() => setEquipment(eq)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: 10,
                      background: sel ? 'rgba(var(--accent-rgb),0.16)' : 'transparent',
                      border: `1px solid ${sel ? 'rgba(var(--accent-rgb),0.40)' : 'rgba(255,255,255,0.08)'}`,
                      color: sel ? 'var(--accent-l)' : 'var(--text-2)',
                      fontSize: 12,
                      fontWeight: 500,
                      textTransform: 'capitalize',
                    }}
                  >
                    {eq}
                  </button>
                )
              })}
            </div>
          </div>

          {isEdit && (
            <div className="pt-1">
              {deleteBlocked ? (
                <div
                  role="alert"
                  className="text-[12px] rounded-xl px-3 py-2.5"
                  style={{
                    color: 'var(--text-2)',
                    background: 'rgba(248,113,113,0.08)',
                    border: '1px solid rgba(248,113,113,0.2)',
                  }}
                >
                  This exercise is used in a split or mesocycle, so it can't be deleted. Remove it
                  from those first — or just rename it.
                </div>
              ) : confirmDelete ? (
                <div className="flex items-center gap-2">
                  <span className="flex-1 text-[12px] text-[var(--text-2)]">Delete this exercise?</span>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    className="px-3 py-2 rounded-lg text-[12px]"
                    style={{ color: 'var(--text-2)', border: '1px solid rgba(255,255,255,0.08)' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleteExercise.isPending}
                    className="px-3 py-2 rounded-lg text-[12px] font-semibold"
                    style={{ color: '#fff', background: 'rgba(220,38,38,0.85)' }}
                  >
                    {deleteExercise.isPending ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  className="w-full py-2.5 rounded-xl text-[13px]"
                  style={{ color: 'rgba(248,113,113,0.9)', border: '1px solid rgba(248,113,113,0.18)' }}
                >
                  Delete exercise
                </button>
              )}
            </div>
          )}
        </div>

        <div className="px-5 pt-3 pb-4 border-t border-[var(--border)]">
          <button
            type="submit"
            disabled={!canSave}
            className="btn-primary w-full rounded-xl disabled:opacity-40"
            style={{ height: 46, fontSize: 13 }}
          >
            {pending ? 'Saving…' : isEdit ? 'Save changes' : 'Create exercise'}
          </button>
        </div>
      </form>
    </div>
  )
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <span
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
    </span>
  )
}
