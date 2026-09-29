'use client'

import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import type { MapPoint } from './actions-map-inner'

const Placeholder = () => <div className="h-[420px] w-full animate-pulse rounded-xl bg-navy-100" />

// Leaflet touches `window`, so it is never rendered on the server.
const Inner = dynamic(() => import('./actions-map-inner'), { ssr: false, loading: Placeholder })

export function ActionsMap({ points }: { points: MapPoint[] }) {
  // Leaflet + map tiles are the heaviest part of /actions: only load them when the map is about to scroll into view.
  const ref = useRef<HTMLDivElement>(null)
  const [near, setNear] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => e.isIntersecting && (setNear(true), io.disconnect()), { rootMargin: '300px' })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  // Map tiles and controls stay left-to-right, even on /ar.
  return (
    <div ref={ref} dir="ltr" className="overflow-hidden rounded-xl shadow-card">
      {near ? <Inner points={points} /> : <Placeholder />}
    </div>
  )
}
