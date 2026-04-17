import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'

const ToastContext = createContext(null)

let idCounter = 0

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([])
  const timersRef = useRef(new Map())

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const tm = timersRef.current.get(id)
    if (tm) {
      clearTimeout(tm)
      timersRef.current.delete(id)
    }
  }, [])

  const push = useCallback((message, { variant = 'info', duration = 3500 } = {}) => {
    const id = ++idCounter
    setToasts((prev) => [...prev, { id, message, variant }])
    if (duration) {
      const tm = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id))
        timersRef.current.delete(id)
      }, duration)
      timersRef.current.set(id, tm)
    }
    return id
  }, [])

  const api = {
    info: (m, opts) => push(m, { ...opts, variant: 'info' }),
    success: (m, opts) => push(m, { ...opts, variant: 'success' }),
    error: (m, opts) => push(m, { ...opts, variant: 'error' }),
    dismiss,
  }

  useEffect(() => () => {
    timersRef.current.forEach(clearTimeout)
    timersRef.current.clear()
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed top-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            onClick={() => dismiss(t.id)}
            className={`pointer-events-auto cursor-pointer max-w-sm min-w-[240px] rounded-xl px-4 py-3 border shadow-lg text-sm animate-[fadeIn_120ms_ease-out] ${variantClasses(t.variant)}`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function variantClasses(variant) {
  switch (variant) {
    case 'success':
      return 'bg-green-500/10 border-green-500/30 text-green-300'
    case 'error':
      return 'bg-red-500/10 border-red-500/30 text-red-300'
    default:
      return 'bg-[#1A1A16] border-[#33332C] text-[#F5F3EC]'
  }
}

export function useToast() {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>')
  return ctx
}
