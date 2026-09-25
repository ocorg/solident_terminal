import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { sectionKeys } from '@/components/site/nav-items'
import { Link } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

// Temporary page for every section of the site map until its real page exists
// (a real route like app/(site)/[locale]/contact/page.tsx takes priority over this catch-all).
export function generateStaticParams() {
  return routing.locales.flatMap((locale) => Object.keys(sectionKeys).map((path) => ({ locale, slug: path.split('/') })))
}

export async function generateMetadata({ params }: PageProps<'/[locale]/[...slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const key = sectionKeys[slug.join('/')]
  if (!key) return {}
  const t = await getTranslations({ locale, namespace: 'Nav' })
  return { title: t(key) }
}

export default async function SectionPlaceholder({ params }: PageProps<'/[locale]/[...slug]'>) {
  const { locale, slug } = await params
  const key = sectionKeys[slug.join('/')]
  if (!key) notFound()
  setRequestLocale(locale)
  const nav = await getTranslations('Nav')
  const t = await getTranslations('Placeholder')

  return (
    <section className="mx-auto max-w-3xl px-4 py-20 text-center sm:px-6">
      <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-500">{t('soon')}</p>
      <h1 className="font-heading text-4xl font-bold text-navy-700">{nav(key)}</h1>
      <div className="divider-dot mx-auto my-6" />
      <p className="text-ink-600">{t('text')}</p>
      <div className="mt-8 flex justify-center gap-3">
        <Link href="/" className="btn btn-primary">
          {t('back')}
        </Link>
        <a href="https://www.instagram.com/assoc_solident" target="_blank" rel="noreferrer" className="btn btn-ghost">
          Instagram
        </a>
      </div>
    </section>
  )
}
