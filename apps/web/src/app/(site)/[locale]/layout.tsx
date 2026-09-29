import type { Metadata, Viewport } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Toaster } from 'sonner'
import { SiteFooter } from '@/components/site/footer'
import { ServiceWorkerRegister } from '@/components/service-worker'
import { SiteHeader } from '@/components/site/header'
import { getFundraising } from '@/lib/fundraising'
import { alternatesFor } from '@/lib/seo'
import { localeDir, routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/site-url'
import { fontVariables } from '../../fonts'
import '../../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export const viewport: Viewport = { themeColor: '#1E5470' }

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return {
    metadataBase: new URL(siteUrl()),
    title: { default: t('homeTitle'), template: `%s · ${t('title')}` },
    description: t('description'),
    alternates: alternatesFor(locale, ''),
    appleWebApp: { capable: true, title: 'Solident', statusBarStyle: 'default' },
    openGraph: { siteName: 'Association Solident', locale: { fr: 'fr_MA', ar: 'ar_MA', en: 'en_US' }[locale] ?? 'fr_MA', type: 'website' },
  }
}

export default async function SiteLayout({ children, params }: LayoutProps<'/[locale]'>) {
  const { locale } = await params
  if (!hasLocale(routing.locales, locale)) notFound()
  setRequestLocale(locale)
  const dir = localeDir(locale)
  const t = await getTranslations('Nav')

  return (
    <html lang={locale} dir={dir} className={`${fontVariables} h-full antialiased`}>
      <body className="grain flex min-h-full flex-col bg-cream-50 font-sans text-navy-900">
        <NextIntlClientProvider>
          <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 btn btn-cta">
            {t('skip')}
          </a>
          <SiteHeader fundraisingOpen={(await getFundraising()).open} />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <ServiceWorkerRegister />
          <Toaster position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} dir={dir} richColors duration={4000} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
