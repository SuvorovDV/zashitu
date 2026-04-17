export default function Mascot({ state = 'idle', size = 96 }) {
  const mouth = {
    happy:  <path d="M 52 78 Q 60 86 68 78" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />,
    verify: <path d="M 52 80 L 68 80"      stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />,
    sad:    <path d="M 52 82 Q 60 76 68 82" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />,
    idle:   <path d="M 52 80 Q 60 82 68 80" fill="none" stroke="var(--ink)" strokeWidth="1.5" strokeLinecap="round" />,
  }[state] ?? null

  return (
    <svg viewBox="0 0 120 120" width={size} height={size} style={{ overflow: 'visible' }} aria-hidden>
      <circle cx="60" cy="64" r="42" fill="var(--surface)" stroke="var(--ink)" strokeWidth="1.5" />
      <path d="M 22 58 Q 28 30 60 26 Q 92 30 98 58 Q 92 40 60 40 Q 28 40 22 58 Z" fill="var(--ink)" />
      <circle cx="48" cy="60" r="2.5" fill="var(--ink)" />
      <circle cx="72" cy="60" r="2.5" fill="var(--ink)" />
      <g fill="none" stroke="var(--ink)" strokeWidth="1.5">
        <circle cx="48" cy="60" r="8" />
        <circle cx="72" cy="60" r="8" />
        <path d="M 56 60 L 64 60" />
      </g>
      {mouth}
      <circle cx="60" cy="92" r="6" fill="var(--ink)" opacity="0.9" />
    </svg>
  )
}
