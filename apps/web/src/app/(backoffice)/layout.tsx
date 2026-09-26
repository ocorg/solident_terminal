import type { Metadata } from 'next'
import { Toaster } from 'sonner'
import { fontVariables } from '../fonts'
import '../globals.css'

export const metadata: Metadata = {
  title: 'Solident · Espace membres',
  robots: { index: false, follow: false },
}

// Back-office (/admin, /connexion, /inscription, password pages): French only, outside /[locale].
export default function BackofficeLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" dir="ltr" className={`${fontVariables} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream-50 font-sans text-navy-900">
        {children}
        <Toaster position="bottom-right" richColors duration={4000} />
      </body>
    </html>
  )
}
