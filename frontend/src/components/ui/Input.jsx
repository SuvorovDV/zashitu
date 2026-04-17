import { useId } from 'react'

export default function Input({
  label,
  error,
  hint,
  className = '',
  id,
  ...props
}) {
  const reactId = useId()
  const inputId = id || `in-${reactId}`
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined
  return (
    <div className={`flex flex-col gap-1.5 ${className}`}>
      {label && (
        <label htmlFor={inputId} className="text-sm font-medium text-[#D2CFC1]">
          {label}
        </label>
      )}
      <input
        id={inputId}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        className={`px-3.5 py-2.5 rounded-xl text-sm bg-[#0E0E0C] border text-white placeholder-[#8F8C7F] focus-visible:outline-none focus-visible:ring-2 transition-colors duration-150 disabled:opacity-50 disabled:cursor-not-allowed ${
          error
            ? 'border-red-500/50 focus-visible:ring-red-500/40'
            : 'border-[#33332C] hover:border-[#4B4A42] focus-visible:ring-brand-500 focus-visible:border-brand-500'
        }`}
        {...props}
      />
      {hint && !error && (
        <p id={`${inputId}-hint`} className="text-xs text-[#8F8C7F]">{hint}</p>
      )}
      {error && (
        <p id={`${inputId}-error`} role="alert" aria-live="polite" className="text-xs text-red-400">
          {error}
        </p>
      )}
    </div>
  )
}
