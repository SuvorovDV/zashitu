import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

/**
 * Модалка с focus-trap и Escape-закрытием.
 * Использование:
 *   <Modal open={state} onClose={...} title="...">содержимое</Modal>
 */
export function Modal({ open, onClose, title, children, labelledBy, describedBy }) {
  const dialogRef = useRef(null)
  const prevActiveRef = useRef(null)

  useEffect(() => {
    if (!open) return
    prevActiveRef.current = document.activeElement
    const node = dialogRef.current
    // Фокус на первом фокусируемом элементе внутри диалога.
    const focusable = node?.querySelectorAll(
      'button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])'
    )
    focusable?.[0]?.focus()

    function handleKey(e) {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose?.()
        return
      }
      if (e.key !== 'Tab' || !focusable?.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKey)
      document.body.style.overflow = prevOverflow
      prevActiveRef.current?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[90] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div aria-hidden="true" className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md rounded-2xl bg-[#1A1712] border border-[#2E2820] shadow-2xl p-6"
      >
        {title && (
          <h2 id={labelledBy} className="text-white font-semibold text-lg mb-2">
            {title}
          </h2>
        )}
        {children}
      </div>
    </div>,
    document.body,
  )
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  tone = 'danger',
}) {
  const confirmClass =
    tone === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : 'bg-brand-600 hover:bg-brand-500 text-white'
  return (
    <Modal open={open} onClose={onClose} title={title} labelledBy="confirm-title" describedBy="confirm-desc">
      {description && (
        <p id="confirm-desc" className="text-[#B8AE97] text-sm mb-5">
          {description}
        </p>
      )}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-lg text-sm font-medium text-[#B8AE97] hover:text-white hover:bg-[#221E17] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={() => { onConfirm?.(); onClose?.() }}
          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#1A1712] ${confirmClass}`}
        >
          {confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
