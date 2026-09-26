import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { PageHeader, SectionTitle } from '@/components/site/page-header'
import { PersonCard } from '@/components/site/person-card'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'

export const revalidate = 3600

export async function generateMetadata({ params }: PageProps<'/[locale]/qui-sommes-nous'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'About' })
  return { title: t('title'), description: t('intro') }
}

export default async function AboutPage({ params }: PageProps<'/[locale]/qui-sommes-nous'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('About')
  const home = await getTranslations('Home')
  const format = await getFormatter()

  const [board, stats] = await Promise.all([
    prisma.teamMember.findMany({ where: { isBoard: true }, orderBy: { order: 'asc' } }),
    prisma.impactStat.findMany({ orderBy: { order: 'asc' } }),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />

      <div className="mb-14 grid gap-10 lg:grid-cols-2">
        <section>
          <SectionTitle>{t('storyTitle')}</SectionTitle>
          <p className="text-ink-600">{t('story')}</p>
        </section>
        {stats.length > 0 && (
          <dl className="grid grid-cols-2 gap-4">
            {stats.map((s) => (
              <div key={s.key} className="card p-5">
                <dd className="font-heading text-3xl font-bold text-navy-700">{format.number(s.value)}</dd>
                <dt className="text-sm text-ink-600">{localized(s, 'label', locale)}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>

      <section className="mb-14 grid gap-5 md:grid-cols-3">
        {(['mission', 'vision', 'values'] as const).map((k) => (
          <div key={k} className="card p-6">
            <h2 className="mb-2 font-heading text-lg font-bold text-navy-700">{home(`${k}Title`)}</h2>
            <p className="text-ink-600">{home(k)}</p>
          </div>
        ))}
      </section>

      <section className="mb-14 grid gap-10 lg:grid-cols-2">
        <div>
          <SectionTitle>{t('charterTitle')}</SectionTitle>
          <p className="mb-5 text-ink-600">{t('charter')}</p>
          <blockquote className="border-s-4 border-gold-500 bg-gold-100 px-5 py-4 font-heading text-lg font-semibold text-navy-900">
            « {t('motto')} »
          </blockquote>
        </div>
        <div>
          <SectionTitle>{t('governanceTitle')}</SectionTitle>
          <ul className="space-y-3">
            {(['gov1', 'gov2', 'gov3'] as const).map((k) => (
              <li key={k} className="flex gap-3 text-ink-600">
                <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-navy-700" />
                {t(k)}
              </li>
            ))}
          </ul>
        </div>
      </section>

      {board.length > 0 && (
        <section className="mb-14">
          <SectionTitle>{t('boardTitle')}</SectionTitle>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {board.map((m) => (
              <PersonCard key={m.id} name={m.fullName} role={localized(m, 'role', locale)} photoUrl={m.photoUrl} />
            ))}
          </ul>
        </section>
      )}

      <section className="card flex flex-col items-start justify-between gap-4 bg-navy-700 p-8 text-white md:flex-row md:items-center">
        <div>
          <h2 className="font-heading text-2xl font-bold">{t('joinTitle')}</h2>
          <p className="text-white/80">{t('joinText')}</p>
        </div>
        <Link href="/soutenir/benevolat" className="btn btn-cta shrink-0">
          {t('joinCta')}
        </Link>
      </section>
    </div>
  )
}
