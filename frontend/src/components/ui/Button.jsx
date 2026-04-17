import Spinner from './Spinner.jsx'

const variants = {
  primary:   'bg-brand-500 hover:bg-brand-400 text-[#0E0E0C] shadow-lg shadow-brand-900/30 disabled:bg-brand-700 disabled:text-[#0E0E0C]/60 disabled:opacity-60',
  secondary: 'bg-[#23231E] hover:bg-[#33332C] text-[#F5F3EC] border border-[#33332C] hover:border-[#4B4A42] disabled:opacity-40',
  outline:   'border border-brand-500/60 text-brand-300 hover:bg-brand-500 hover:text-[#0E0E0C] hover:border-brand-500 disabled:opacity-40',
  light:     'bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 shadow-sm disabled:opacity-50',
  danger:    'bg-red-600 hover:bg-red-500 text-white shadow-lg shadow-red-900/30 disabled:opacity-60',
  ghost:     'hover:bg-[#23231E] text-[#D2CFC1] hover:text-white disabled:opacity-40',
}

export default function Button({
  variant = 'primary',
  loading = false,
  disabled = false,
  onClick,
  children,
  type = 'button',
  className = '',
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg font-medium transition-all focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 focus:ring-offset-transparent ${variants[variant]} ${className}`}
    >
      {loading && <Spinner size="sm" />}
      {children}
    </button>
  )
}
