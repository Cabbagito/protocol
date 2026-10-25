import { useState, useEffect, useRef } from 'react'
import { Sheet, SheetHeader } from '../../components/Sheet'

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
    <Sheet open onClose={onClose} label={`Note for ${exerciseName}`}>
      <SheetHeader eyebrow="Note" title={exerciseName} onClose={onClose} />
      <textarea
        ref={inputRef}
        value={note}
        onChange={e => setNote(e.target.value)}
        aria-label="Note"
        placeholder="e.g. Use wide grip, lean back slightly"
        rows={3}
        className="input w-full resize-none"
        style={{ fontSize: 16, marginTop: 16 }}
      />
      <div className="flex gap-2" style={{ marginTop: 14 }}>
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
    </Sheet>
  )
}
