import { useState, useEffect, useRef, useMemo } from 'react'
import { getMuscleColor } from '../../lib/muscleColors'
import type { Exercise } from '../../types'

export default function ExerciseSearch({
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
