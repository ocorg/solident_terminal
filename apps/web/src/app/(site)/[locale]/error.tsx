'use client'

import { useTranslations } from 'next-intl'
import { useEffect } from 'react'
import { Link } from '@/i18n/navigation'

/** Friendly error screen for public pages (keeps header, footer and language). */
export default function SiteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations('Error')
  useEffect(() => console.error(error), [error])
  return (
    <section className="mx-auto max-w-2xl px-4 py-24 text-center sm:px-6">
      <p className="font-heading text-6xl font-bold text-gold-500">Oups</p>
      <h1 className="mt-4 font-heading text-3xl font-bold text-navy-700">{t('title')}</h1>
      <p className="mt-3 text-ink-600">{t('text')}</p>
      <div className="mt-8 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary">
          {t('retry')}
        </button>
        <Link href="/" className="btn btn-ghost">
          {t('home')}
        </Link>
      </div>
      {error.digest && <p className="mt-6 text-xs text-ink-600">Réf. {error.digest}</p>}
    </section>
  )
}
