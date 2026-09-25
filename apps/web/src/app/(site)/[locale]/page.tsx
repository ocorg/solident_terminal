import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'

// Rebuilt at most every 5 minutes; live counters come with Pusher in Phase 1.
export const revalidate = 300

export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Home')
  const format = await getFormatter()

  const [stats, nextEvent, campaign] = await Promise.all([
    prisma.impactStat.findMany({ orderBy: { order: 'asc' } }),
    prisma.event.findFirst({ where: { isPublished: true, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } }),
    prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { startsOn: 'asc' } }),
  ])

  return (
    <>
      {/* Hero */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 md:pt-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-700">{t('eyebrow')}</p>
        <h1 className="max-w-3xl font-heading text-4xl font-bold leading-tight text-navy-900 md:text-6xl">
          {t('title')}
          <span className="text-gold-500">.</span>
        </h1>
        <div className="divider-dot my-6" />
        <p className="max-w-2xl text-lg text-ink-600">{t('intro')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/soutenir/don" className="btn btn-cta">
            {t('ctaDonate')}
          </Link>
          <Link href="/soutenir/sponsoring" className="btn btn-primary">
            {t('ctaSponsor')}
          </Link>
          <Link href="/soutenir/benevolat" className="btn btn-ghost">
            {t('ctaVolunteer')}
          </Link>
        </div>
      </section>

      {/* Impact counters */}
      {stats.length > 0 && (
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <h2 className="mb-8 font-heading text-2xl font-bold text-navy-700">{t('impactTitle')}</h2>
            <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {stats.map((s) => (
                <div key={s.key} className="card card-hover p-6">
                  <dt className="order-2 mt-1 text-sm text-ink-600">{localized(s, 'label', locale)}</dt>
                  <dd className="font-heading text-4xl font-bold text-navy-700">{format.number(s.value)}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>
      )}

      {/* Next big event + fundraising goal */}
      {nextEvent && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <div className="card overflow-hidden md:flex">
            <div className="flex-1 p-8">
              <p className="mb-2 text-sm font-semibold text-gold-500">{t('nextEvent')}</p>
              <h2 className="font-heading text-2xl font-bold text-navy-700">{localized(nextEvent, 'title', locale)}</h2>
              <p className="mt-1 text-sm font-medium text-ink-600">
                {nextEvent.endsAt
                  ? format.dateTimeRange(nextEvent.startsAt, nextEvent.endsAt, { day: 'numeric', month: 'long', year: 'numeric' })
                  : format.dateTime(nextEvent.startsAt, { day: 'numeric', month: 'long', year: 'numeric' })}
                {nextEvent.location && ` · ${nextEvent.location}`}
              </p>
              <p className="mt-4 text-ink-600">{localized(nextEvent, 'body', locale)}</p>
            </div>
            {campaign && (
              <div className="flex flex-col justify-center gap-3 bg-navy-700 p-8 text-white md:w-80">
                <p className="text-sm text-white/80">{localized(campaign, 'title', locale)}</p>
                <p className="font-heading text-3xl font-bold">
                  {format.number(campaign.goalDh, { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })}
                </p>
                <Link href="/soutenir/don" className="btn btn-cta mt-2">
                  {t('nextEventCta')}
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Mission / vision / values */}
      <section className="mx-auto grid max-w-7xl gap-6 px-4 pb-20 sm:px-6 md:grid-cols-3">
        {(['mission', 'vision', 'values'] as const).map((k) => (
          <div key={k} className="card p-6">
            <h3 className="mb-2 font-heading text-lg font-bold text-navy-700">{t(`${k}Title`)}</h3>
            <p className="text-ink-600">{t(k)}</p>
          </div>
        ))}
      </section>
    </>
  )
}
