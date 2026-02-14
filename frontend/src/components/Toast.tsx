import { useState, useEffect, useCallback, createContext, useContext } from 'react'

interface Toast {
  id: number
  message: string
  type: 'error' | 'success'
}

interface ToastContextValue {
  showError: (message: string) => void
  showSuccess: (message: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

let nextId = 0

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((message: string, type: 'error' | 'success') => {
    const id = nextId++
    setToasts((prev) => [...prev, { id, message, type }])
  }, [])

  const removeToast = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const showError = useCallback((message: string) => addToast(message, 'error'), [addToast])
  const showSuccess = useCallback((message: string) => addToast(message, 'success'), [addToast])

  return (
    <ToastContext.Provider value={{ showError, showSuccess }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[110] flex flex-col gap-2 w-full max-w-sm px-4">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onDismiss={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function ToastItem({ toast, onDismiss }: { toast: Toast; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onDismiss(toast.id), 4000)
    return () => clearTimeout(timer)
  }, [toast.id, onDismiss])

  return (
    <div
      className={`rounded-lg px-4 py-3 text-sm shadow-lg animate-in fade-in slide-in-from-top ${
        toast.type === 'error'
          ? 'bg-red-900/90 text-red-100 border border-red-700/50'
          : 'bg-green-900/90 text-green-100 border border-green-700/50'
      }`}
      onClick={() => onDismiss(toast.id)}
    >
      {toast.message}
    </div>
  )
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext)
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider')
  }
  return context
}
