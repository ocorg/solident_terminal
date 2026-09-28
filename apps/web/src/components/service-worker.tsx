'use client'

import { useEffect } from 'react'

/** Registers /sw.js (offline page + phone notifications). Rendered once in each root layout. */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((e) => console.error('Service worker registration failed:', e))
  }, [])
  return null
}
