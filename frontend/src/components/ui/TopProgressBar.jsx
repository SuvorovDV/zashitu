import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { useIsFetching, useIsMutating } from '@tanstack/react-query'

/**
 * Тонкий янтарный прогрессбар вверху страницы с градиентом и свечением.
 * Активен пока есть fetching/mutating React Query запросы
 * или во время перехода между маршрутами.
 */
export default function TopProgressBar() {
  const isFetching = useIsFetching()
  const isMutating = useIsMutating()
  const location = useLocation()

  const [progress, setProgress] = useState(0)
  const [visible, setVisible] = useState(false)
  const trickleRef = useRef(null)
  const hideRef = useRef(null)

  const active = isFetching > 0 || isMutating > 0

  useEffect(() => {
    setVisible(true)
    setProgress(18)
    const t = setTimeout(() => setProgress(58), 90)
    const t2 = setTimeout(() => {
      if (isFetching === 0 && isMutating === 0) {
        setProgress(100)
        const hide = setTimeout(() => {
          setVisible(false)
          setProgress(0)
        }, 260)
        return () => clearTimeout(hide)
      }
    }, 260)
    return () => { clearTimeout(t); clearTimeout(t2) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname])

  useEffect(() => {
    if (active) {
      if (hideRef.current) { clearTimeout(hideRef.current); hideRef.current = null }
      setVisible(true)
      setProgress((p) => (p < 10 ? 18 : p))
      if (trickleRef.current) clearInterval(trickleRef.current)
      trickleRef.current = setInterval(() => {
        setProgress((p) => (p < 88 ? p + Math.max(1, (92 - p) * 0.08) : p))
      }, 200)
    } else {
      if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null }
      if (visible) {
        setProgress(100)
        hideRef.current = setTimeout(() => {
          setVisible(false)
          setProgress(0)
        }, 280)
      }
    }
    return () => {
      if (trickleRef.current) { clearInterval(trickleRef.current); trickleRef.current = null }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  return (
    <>
      {/* Track — мягкая подложка, видна только при активности */}
      <div
        aria-hidden="true"
        className="fixed top-0 left-0 right-0 z-[100] pointer-events-none"
        style={{
          height: '3px',
          background: 'linear-gradient(90deg, rgba(245,158,11,0.04) 0%, rgba(245,158,11,0.10) 50%, rgba(245,158,11,0.04) 100%)',
          opacity: visible ? 1 : 0,
          transition: 'opacity 300ms ease-out',
        }}
      />
      {/* Bar */}
      <div
        aria-hidden="true"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress)}
        className="fixed top-0 left-0 z-[101] pointer-events-none"
        style={{
          height: '3px',
          width: `${progress}%`,
          background: 'linear-gradient(90deg, #B45309 0%, #F59E0B 50%, #FCD34D 100%)',
          boxShadow: '0 0 10px rgba(245,158,11,0.8), 0 0 4px rgba(252,211,77,0.9)',
          opacity: visible ? 1 : 0,
          transition: 'width 240ms cubic-bezier(0.4, 0, 0.2, 1), opacity 300ms ease-out',
          borderTopRightRadius: '2px',
          borderBottomRightRadius: '2px',
        }}
      >
        {/* Бегущий блик на конце — чуть-чуть оживляет */}
        <div
          className="absolute top-0 right-0 h-full w-10"
          style={{
            background: 'linear-gradient(90deg, transparent 0%, rgba(253,230,138,0.9) 70%, #FDE68A 100%)',
            filter: 'blur(2px)',
          }}
        />
      </div>
    </>
  )
}
