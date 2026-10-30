import type { Metadata, Viewport } from 'next'
import { fontVariables } from '../fonts'
import '../globals.css'

// Root layout of the hibernation page: nothing else loaded (no guard, no service worker, no toasts).
export const metadata: Metadata = {
  title: 'Projet en veille | Association Solident',
  description: 'La plateforme Solident est en veille.',
  robots: { index: false, follow: false },
}

export const viewport: Viewport = { themeColor: '#123a4f' }

export default function SleepLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`${fontVariables} h-full antialiased`}>
      <body className="min-h-full bg-navy-900 font-sans text-white">{children}</body>
    </html>
  )
}
