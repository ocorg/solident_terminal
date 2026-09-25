import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { hasLocale, NextIntlClientProvider } from 'next-intl'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { Toaster } from 'sonner'
import { SiteFooter } from '@/components/site/footer'
import { SiteHeader } from '@/components/site/header'
import { localeDir, routing } from '@/i18n/routing'
import { fontVariables } from '../../fonts'
import '../../globals.css'

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }))
}

export async function generateMetadata({ params }: LayoutProps<'/[locale]'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Metadata' })
  return {
    title: { default: t('title'), template: `%s · ${t('title')}` },
    description: t('description'),
    alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `/${l}`])) },
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
      <body className="flex min-h-full flex-col bg-cream-50 font-sans text-navy-900">
        <NextIntlClientProvider>
          <a href="#contenu" className="sr-only focus:not-sr-only focus:absolute focus:start-4 focus:top-4 focus:z-50 btn btn-cta">
            {t('skip')}
          </a>
          <SiteHeader />
          <main id="contenu" className="flex-1">
            {children}
          </main>
          <SiteFooter />
          <Toaster position={dir === 'rtl' ? 'bottom-left' : 'bottom-right'} dir={dir} richColors duration={4000} />
        </NextIntlClientProvider>
      </body>
    </html>
  )
}
