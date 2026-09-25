import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'

export default async function NotFound() {
  const t = await getTranslations('NotFound')
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="font-heading text-6xl font-bold text-gold-500">404</p>
      <h1 className="mt-4 font-heading text-3xl font-bold text-navy-700">{t('title')}</h1>
      <p className="mt-3 text-ink-600">{t('text')}</p>
      <Link href="/" className="btn btn-primary mt-8">
        {t('back')}
      </Link>
    </section>
  )
}
