const TONES = {
  neutral: 'text-[#B8AE97] bg-[#221E17] border-[#4A402F]',
  brand:   'text-brand-300 bg-brand-600/15 border-brand-500/25',
  success: 'text-green-300 bg-green-500/10 border-green-500/25',
  warning: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/25',
  danger:  'text-red-300 bg-red-500/10 border-red-500/25',
  info:    'text-blue-300 bg-blue-500/10 border-blue-500/25',
}

export default function Badge({ tone = 'neutral', className = '', children, ...props }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border ${TONES[tone] || TONES.neutral} ${className}`}
      {...props}
    >
      {children}
    </span>
  )
}
