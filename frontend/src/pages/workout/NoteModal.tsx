import { useState, useEffect, useRef } from 'react'

interface NoteModalProps {
  exerciseName: string
  initialNote: string
  onSave: (note: string) => void
  onClose: () => void
}

export function NoteModal({ exerciseName, initialNote, onSave, onClose }: NoteModalProps) {
  const [note, setNote] = useState(initialNote)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" onClick={onClose}>
      <div className="absolute inset-0" style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(2px)' }} />
      <div
        className="relative w-full rounded-t-2xl pb-safe slide-up"
        style={{ background: 'var(--card)', border: '1px solid rgba(255,255,255,0.06)', borderBottom: 'none' }}
        onClick={e => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-9 h-1 rounded-full" style={{ background: 'rgba(255,255,255,0.15)' }} />
        </div>
        <div className="px-5 pb-1">
          <span className="text-xs font-medium uppercase tracking-wider text-[var(--text-m)]">Note for {exerciseName}</span>
        </div>
        <div className="px-4 pb-3">
          <textarea
            ref={inputRef}
            value={note}
            onChange={e => setNote(e.target.value)}
            placeholder="e.g. Use wide grip, lean back slightly"
            rows={3}
            className="input w-full resize-none"
            style={{ fontSize: 15 }}
          />
        </div>
        <div className="px-4 pb-4 flex gap-2">
          {initialNote && (
            <button
              onClick={() => onSave('')}
              className="btn flex-1"
              style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}
            >
              Remove
            </button>
          )}
          <button onClick={() => onSave(note)} className="btn btn-primary flex-1">
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
