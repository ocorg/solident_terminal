import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { PageHeader, SectionTitle } from '@/components/site/page-header'
import { VolunteerForm } from './volunteer-form'
import { alternatesFor } from '@/lib/seo'

export async function generateMetadata({ params }: PageProps<'/[locale]/soutenir/benevolat'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Volunteer' })
  return { alternates: alternatesFor(locale, '/soutenir/benevolat'), title: t('title'), description: t('intro') }
}

export default async function BenevolatPage({ params }: PageProps<'/[locale]/soutenir/benevolat'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Volunteer')

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />
      <div className="grid gap-10 lg:grid-cols-5">
        <section className="space-y-6 lg:col-span-2">
          <SectionTitle>{t('profilesTitle')}</SectionTitle>
          <ul className="space-y-3">
            {(['p1', 'p2', 'p3'] as const).map((k) => (
              <li key={k} className="card flex gap-3 p-4 text-ink-600">
                <span className="mt-2 size-2 shrink-0 rounded-full bg-gold-500" />
                {t(k)}
              </li>
            ))}
          </ul>
          <blockquote className="border-s-4 border-gold-500 bg-gold-100 px-5 py-4 font-heading font-semibold text-navy-900">{t('charter')}</blockquote>
        </section>
        <section className="card p-6 md:p-8 lg:col-span-3" aria-labelledby="vol-form">
          <h2 id="vol-form" className="mb-6 font-heading text-2xl font-bold text-navy-700">
            {t('formTitle')}
          </h2>
          <VolunteerForm />
        </section>
      </div>
    </div>
  )
}
