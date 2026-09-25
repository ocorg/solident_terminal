import type { Metadata } from 'next'
import { Montserrat, Poppins } from 'next/font/google'
import { Toaster } from 'sonner'
import './globals.css'

const poppins = Poppins({ variable: '--font-poppins', subsets: ['latin'], weight: ['600', '700'] })
const montserrat = Montserrat({ variable: '--font-montserrat', subsets: ['latin'], weight: ['400', '500', '600'] })

export const metadata: Metadata = {
  title: 'Association Solident',
  description: 'Bridge de Solidarité des Médecins Dentistes',
}

// Locale routing (/fr /ar /en, RTL) arrives in Phase 0 step 9; French until then.
export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="fr" className={`${poppins.variable} ${montserrat.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cream-50 font-sans text-navy-900">
        {children}
        <Toaster position="bottom-right" richColors duration={4000} />
      </body>
    </html>
  )
}
