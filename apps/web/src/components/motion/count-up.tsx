'use client'

import { useEffect, useRef, useState } from 'react'

/**
 * A number that counts up the first time it scrolls into view.
 * Server-rendered with its final value (SEO, no-JS, screen readers); "reduce motion" keeps it static.
 */
export function CountUp({ value, locale = 'fr', duration = 1400, className }: { value: number; locale?: string; duration?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const [shown, setShown] = useState(value)

  useEffect(() => {
    const el = ref.current
    if (!el || value <= 0 || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    let frame = 0
    const io = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        io.disconnect()
        const start = performance.now()
        const tick = (now: number) => {
          const p = Math.min(1, (now - start) / duration)
          setShown(Math.round(value * (1 - Math.pow(1 - p, 3))))
          if (p < 1) frame = requestAnimationFrame(tick)
        }
        setShown(0)
        frame = requestAnimationFrame(tick)
      },
      { threshold: 0.4 },
    )
    io.observe(el)
    return () => {
      io.disconnect()
      cancelAnimationFrame(frame)
    }
  }, [value, duration])

  return (
    <span ref={ref} className={`tabular-nums ${className ?? ''}`}>
      {/* The final value is what assistive tech reads; the animated digits are hidden from it */}
      <span className="sr-only">{value.toLocaleString(locale)}</span>
      <span aria-hidden>{shown.toLocaleString(locale)}</span>
    </span>
  )
}
