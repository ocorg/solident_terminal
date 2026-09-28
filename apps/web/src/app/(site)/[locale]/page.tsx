import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { ProgressBar } from '@/components/site/progress-bar'
import { Link } from '@/i18n/navigation'
import { getFundraising } from '@/lib/fundraising'
import { localized } from '@/lib/localized'

// Rebuilt at most every 5 minutes; the donation bar itself updates live via Pusher.
export const revalidate = 300

// Home = who we are first (association, mission, impact, actions); ways to help come last.
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Home')
  const about = await getTranslations('About')
  const format = await getFormatter()

  const [stats, nextEvent, campaign, programmes, actions, partners, fundraising] = await Promise.all([
    prisma.impactStat.findMany({ orderBy: { order: 'asc' } }),
    prisma.event.findFirst({ where: { isPublished: true, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } }),
    prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { startsOn: 'asc' } }),
    prisma.programme.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.action.findMany({ where: { isPublished: true }, orderBy: { dateStart: 'desc' }, take: 3 }),
    prisma.partner.findMany({ where: { isVisible: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true, logoUrl: true } }),
    getFundraising(),
  ])
  const actionDate = (d: Date) => format.dateTime(d, { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const ways = [
    { href: '/soutenir/sponsoring', title: t('joinSponsorTitle'), text: t('joinSponsorText') },
    { href: '/soutenir/benevolat', title: t('joinVolunteerTitle'), text: t('joinVolunteerText') },
    fundraising.open
      ? { href: '/soutenir/don', title: t('joinDonateTitle'), text: t('joinDonateText') }
      : { href: '/contact', title: t('joinContactTitle'), text: t('joinContactText') },
  ]

  return (
    <>
      {/* Hero: who we are */}
      <section className="mx-auto max-w-7xl px-4 pb-16 pt-12 sm:px-6 md:pt-20">
        <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-navy-700">{t('eyebrow')}</p>
        <h1 className="max-w-3xl font-heading text-4xl font-bold leading-tight text-navy-900 md:text-6xl">
          {t('title')}
          <span className="text-gold-500">.</span>
        </h1>
        <div className="divider-dot my-6" />
        <p className="max-w-2xl text-lg text-ink-600">{t('intro')}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/qui-sommes-nous" className="btn btn-primary">
            {t('ctaAbout')}
          </Link>
          <Link href="/actions" className="btn btn-ghost">
            {t('ctaActions')}
          </Link>
        </div>
      </section>

      {/* About: story + mission / vision / values */}
      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-10 px-4 sm:px-6 lg:grid-cols-5">
          <div className="lg:col-span-2">
            <h2 className="mb-4 font-heading text-2xl font-bold text-navy-700">{t('aboutTitle')}</h2>
            <p className="mb-4 text-ink-600">{about('intro')}</p>
            <p className="mb-6 text-ink-600">{about('story')}</p>
            <Link href="/qui-sommes-nous" className="text-sm font-semibold text-navy-700 hover:underline">
              {t('aboutCta')} <span className="flip-rtl inline-block">→</span>
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3 lg:col-span-3 lg:grid-cols-1">
            {(['mission', 'vision', 'values'] as const).map((k) => (
              <div key={k} className="card border-s-4 border-gold-500 p-5">
                <h3 className="mb-1 font-heading text-lg font-bold text-navy-700">{t(`${k}Title`)}</h3>
                <p className="text-ink-600">{t(k)}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Impact counters */}
      {stats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
          <h2 className="mb-8 font-heading text-2xl font-bold text-navy-700">{t('impactTitle')}</h2>
          <dl className="grid grid-cols-2 gap-6 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.key} className="card card-hover flex flex-col p-4 sm:p-6">
                <dt className="order-2 mt-1 text-sm text-ink-600">{localized(s, 'label', locale)}</dt>
                <dd className="font-heading text-4xl font-bold text-navy-700">{format.number(s.value)}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* What we do: programmes */}
      {programmes.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-14 sm:px-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-heading text-2xl font-bold text-navy-700">{t('programmesTitle')}</h2>
            <Link href="/programmes" className="text-sm font-semibold text-navy-700 hover:underline">
              {t('seeAll')} <span className="flip-rtl inline-block">→</span>
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {programmes.map((p, i) => (
              <li key={p.id}>
                <Link href={`/programmes/${p.slug}`} className="card card-hover flex h-full flex-col p-5">
                  <span className="mb-3 flex size-9 items-center justify-center rounded-full bg-gold-100 font-heading font-bold text-navy-700">{i + 1}</span>
                  <h3 className="mb-1 font-heading font-bold text-navy-900">{localized(p, 'title', locale)}</h3>
                  <p className="line-clamp-4 text-sm text-ink-600">{localized(p, 'summary', locale)}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Latest actions on the ground */}
      {actions.length > 0 && (
        <section className="bg-white py-14">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-heading text-2xl font-bold text-navy-700">{t('actionsTitle')}</h2>
              <Link href="/actions" className="text-sm font-semibold text-navy-700 hover:underline">
                {t('actionsMap')} <span className="flip-rtl inline-block">→</span>
              </Link>
            </div>
            <ul className="grid gap-6 md:grid-cols-3">
              {actions.map((a) => (
                <li key={a.id}>
                  <Link href={`/actions/${a.slug}`} className="card card-hover block h-full overflow-hidden">
                    {a.coverUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.coverUrl} alt="" className="aspect-[16/9] w-full object-cover" loading="lazy" />
                    ) : (
                      <div className="aspect-[16/9] w-full bg-navy-100" />
                    )}
                    <div className="p-5">
                      <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gold-500">
                        {actionDate(a.dateStart)}
                        {a.location && ` · ${a.location}`}
                      </p>
                      <h3 className="font-heading font-bold text-navy-900">{localized(a, 'title', locale)}</h3>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* Next big event (+ live bar only while public fundraising is open) */}
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
              <p className="mt-4 line-clamp-4 text-ink-600">{localized(nextEvent, 'body', locale)}</p>
              <Link href={`/evenements/${nextEvent.slug}`} className="mt-5 inline-block text-sm font-semibold text-navy-700 hover:underline">
                {t('nextEventMore')} <span className="flip-rtl inline-block">→</span>
              </Link>
            </div>
            {campaign && fundraising.open && (
              <div className="flex flex-col justify-center gap-4 bg-navy-700 p-8 text-white md:w-96">
                <p className="text-sm text-white/80">{localized(campaign, 'title', locale)}</p>
                <ProgressBar campaignId={campaign.id} initial={{ raisedDh: campaign.raisedDh, donorsCount: campaign.donorsCount, goalDh: campaign.goalDh }} dark />
                <Link href="/soutenir/don" className="btn btn-cta mt-2">
                  {t('nextEventCta')}
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Ways to act with us */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        <h2 className="mb-6 font-heading text-2xl font-bold text-navy-700">{t('joinTitle')}</h2>
        <ul className="grid gap-4 md:grid-cols-3">
          {ways.map((w) => (
            <li key={w.href}>
              <Link href={w.href} className="card card-hover flex h-full flex-col p-6">
                <h3 className="mb-2 font-heading text-lg font-bold text-navy-700">
                  {w.title} <span className="flip-rtl inline-block text-gold-500">→</span>
                </h3>
                <p className="text-ink-600">{w.text}</p>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Partner strip: logos when uploaded (/admin/partenaires), names until then */}
      {partners.length > 0 && (
        <section className="border-t border-navy-100 bg-white py-12">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
              <h2 className="font-heading text-xl font-bold text-navy-700">{t('partnersTitle')}</h2>
              <Link href="/partenaires" className="text-sm font-semibold text-navy-700 hover:underline">
                {t('seeAll')} <span className="flip-rtl inline-block">→</span>
              </Link>
            </div>
            <ul className="flex flex-wrap items-center gap-3">
              {partners.map((p) =>
                p.logoUrl ? (
                  <li key={p.id} className="flex h-16 w-32 items-center justify-center rounded-lg p-2 grayscale transition hover:grayscale-0">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.logoUrl} alt={p.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                  </li>
                ) : (
                  <li key={p.id} className="rounded-full bg-cream-50 px-4 py-1.5 text-sm font-medium text-navy-700 ring-1 ring-navy-100">
                    {p.name}
                  </li>
                ),
              )}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
