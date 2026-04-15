import { useId } from 'react'

/**
 * Нативный <select> в янтарной теме. options = [{value, label}] | children <option>.
 */
export default function Select({
  label,
  error,
  hint,
  options,
  className = '',
  id,
  children,
  ...props
}) {
  const reactId = useId()
  const inputId = id || `sel-${reactId}`
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#B8AE97]">
          {label}
        </label>
      )}
      <div className="relative">
        <select
          id={inputId}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          className={`w-full appearance-none px-3.5 pr-10 py-2.5 rounded-xl text-sm bg-[#0F0E0B] border text-white focus-visible:outline-none focus-visible:ring-2 transition-colors duration-150 ${
            error
              ? 'border-red-500/50 focus-visible:ring-red-500/40'
              : 'border-[#2E2820] hover:border-[#4A402F] focus-visible:ring-brand-500 focus-visible:border-brand-500'
          }`}
          {...props}
        >
          {options
            ? options.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))
            : children}
        </select>
        <svg
          aria-hidden="true"
          className="w-4 h-4 text-[#7A7362] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-[#7A7362]">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" aria-live="polite" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
