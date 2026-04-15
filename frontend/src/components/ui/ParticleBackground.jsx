import { useEffect, useRef, useCallback } from 'react'

const PARTICLE_COUNT = 65
const CONNECTION_DIST = 130
// r,g,b — для rgba() (палитра Янтарь)
const COLORS = [
  '252,211,77',  // brand-300 #FCD34D
  '245,158,11',  // brand-500 #F59E0B
  '217,119,6',   // brand-600 #D97706
  '180,83,9',    // brand-700 #B45309
  '251,191,36',  // brand-400 #FBBF24
]

function mkParticle(w, h) {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    vx: (Math.random() - 0.5) * 0.3,
    vy: Math.random() * 0.22 + 0.06, // падают вниз
    r: Math.random() * 1.8 + 0.5,
    color: COLORS[Math.floor(Math.random() * COLORS.length)],
    alpha: Math.random() * 0.55 + 0.2,
  }
}

export default function ParticleBackground({ className = '' }) {
  const canvasRef = useRef(null)
  const stateRef = useRef({ particles: [], raf: null, w: 0, h: 0 })

  // Уважаем prefers-reduced-motion
  const prefersReduced = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const init = useCallback((w, h) => {
    stateRef.current.w = w
    stateRef.current.h = h
    stateRef.current.particles = Array.from({ length: PARTICLE_COUNT }, () => mkParticle(w, h))
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { particles, w, h } = stateRef.current

    ctx.clearRect(0, 0, w, h)

    // Обновляем позиции
    for (const p of particles) {
      p.x += p.vx
      p.y += p.vy
      // Wrap
      if (p.y > h + 8) { p.y = -8; p.x = Math.random() * w }
      if (p.x < -8) p.x = w + 8
      if (p.x > w + 8) p.x = -8
    }

    // Линии между соседними
    ctx.lineWidth = 0.5
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x
        const dy = particles[i].y - particles[j].y
        const d = Math.sqrt(dx * dx + dy * dy)
        if (d < CONNECTION_DIST) {
          const a = (1 - d / CONNECTION_DIST) * 0.2
          ctx.beginPath()
          ctx.strokeStyle = `rgba(245,158,11,${a})`
          ctx.moveTo(particles[i].x, particles[i].y)
          ctx.lineTo(particles[j].x, particles[j].y)
          ctx.stroke()
        }
      }
    }

    // Частицы с glow
    for (const p of particles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.shadowBlur = 10
      ctx.shadowColor = `rgba(${p.color},0.8)`
      ctx.fillStyle = `rgba(${p.color},${p.alpha})`
      ctx.fill()
    }
    ctx.shadowBlur = 0

    stateRef.current.raf = requestAnimationFrame(draw)
  }, [])

  // Статичный рендер для reduced-motion
  const drawStatic = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    const { particles, w, h } = stateRef.current
    ctx.clearRect(0, 0, w, h)
    for (const p of particles) {
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
      ctx.fillStyle = `rgba(${p.color},${p.alpha * 0.5})`
      ctx.fill()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const onResize = () => {
      const w = canvas.offsetWidth
      const h = canvas.offsetHeight
      canvas.width = w
      canvas.height = h
      init(w, h)
      if (prefersReduced) drawStatic()
    }

    const ro = new ResizeObserver(onResize)
    ro.observe(canvas)
    onResize()

    if (!prefersReduced) {
      draw()
    }

    return () => {
      ro.disconnect()
      if (stateRef.current.raf) cancelAnimationFrame(stateRef.current.raf)
    }
  }, [init, draw, drawStatic, prefersReduced])

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`absolute inset-0 w-full h-full pointer-events-none select-none ${className}`}
      style={{ display: 'block' }}
    />
  )
}
