/**
 * Card — базовая карточка. Варианты:
 *   solid (дефолт)  — непрозрачный тёплый тёмный фон.
 *   glass           — backdrop-blur, для hero/оверлеев.
 *   raised          — приподнятая (hover-состояние).
 */
export default function Card({
  as: Component = 'div',
  variant = 'solid',
  className = '',
  padded = true,
  children,
  ...props
}) {
  const base =
    variant === 'glass' ? 'card-glass' : variant === 'raised' ? 'card card-hover' : 'card'
  const padding = padded ? 'p-6' : ''
  return (
    <Component className={`rounded-2xl ${base} ${padding} ${className}`} {...props}>
      {children}
    </Component>
  )
}
