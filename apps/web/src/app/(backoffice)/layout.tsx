import type { Metadata, Viewport } from 'next'
import { Toaster } from 'sonner'
import { ServiceWorkerRegister } from '@/components/service-worker'
import { fontVariables } from '../fonts'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Solident · Espace membres',
  robots: { index: false, follow: false },
  appleWebApp: { capable: true, title: 'Solident', statusBarStyle: 'default' },
}

export const viewport: Viewport = { themeColor: '#1E5470' }

// Back-office (/admin, /connexion, /inscription, password pages): French only, outside /[locale].
export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`${fontVariables} h-full antialiased`}>
      <body className="grain flex min-h-full flex-col bg-cream-50 font-sans text-navy-900">
        {children}
        <ServiceWorkerRegister />
        <Toaster position="bottom-right" richColors duration={4000} />
      </body>
    </html>
  )
}
