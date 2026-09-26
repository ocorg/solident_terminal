'use client'

import 'leaflet/dist/leaflet.css'
import { CircleMarker, MapContainer, Popup, TileLayer } from 'react-leaflet'

export type MapPoint = { slug: string; title: string; date: string; partner: string | null; lat: number; lng: number; href: string; cta: string }

/** Morocco map with a gold pin per caravan (spec §8). Loaded only in the browser (see actions-map.tsx). */
export default function ActionsMapInner({ points }: { points: MapPoint[] }) {
  return (
    <MapContainer center={[33.4, -6.2]} zoom={6} minZoom={4} scrollWheelZoom={false} className="h-[420px] w-full rounded-xl" style={{ zIndex: 0 }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {points.map((p) => (
        <CircleMarker key={p.slug} center={[p.lat, p.lng]} radius={9} pathOptions={{ color: '#123A4F', weight: 2, fillColor: '#F4B223', fillOpacity: 0.95 }}>
          <Popup>
            <div style={{ fontFamily: 'var(--site-font-body)', minWidth: 180 }}>
              <strong style={{ color: '#1E5470' }}>{p.title}</strong>
              <div style={{ color: '#4A5A66', fontSize: 13 }}>{p.date}</div>
              {p.partner && <div style={{ color: '#4A5A66', fontSize: 13 }}>{p.partner}</div>}
              <a href={p.href} style={{ color: '#1E5470', fontWeight: 600, fontSize: 13 }}>
                {p.cta} →
              </a>
            </div>
          </Popup>
        </CircleMarker>
      ))}
    </MapContainer>
  )
}
