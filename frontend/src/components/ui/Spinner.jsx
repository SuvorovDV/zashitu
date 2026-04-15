const sizeMap = {
  sm: 'w-4 h-4 border-2',
  md: 'w-6 h-6 border-2',
  lg: 'w-10 h-10 border-4',
}

export default function Spinner({ size = 'md', className = '', label = 'Загрузка…' }) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label={label}
      className={`${sizeMap[size]} border-current border-t-transparent rounded-full animate-spin ${className}`}
    >
      <span className="sr-only">{label}</span>
    </div>
  )
}
