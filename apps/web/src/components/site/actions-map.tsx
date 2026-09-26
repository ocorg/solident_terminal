'use client'

import dynamic from 'next/dynamic'
import type { MapPoint } from './actions-map-inner'

// Leaflet touches `window`, so it is never rendered on the server.
const Inner = dynamic(() => import('./actions-map-inner'), {
  ssr: false,
  loading: () => <div className="h-[420px] w-full animate-pulse rounded-xl bg-navy-100" />,
})

export function ActionsMap({ points }: { points: MapPoint[] }) {
  // Map tiles and controls stay left-to-right, even on /ar.
  return (
    <div dir="ltr" className="overflow-hidden rounded-xl shadow-card">
      <Inner points={points} />
    </div>
  )
}
