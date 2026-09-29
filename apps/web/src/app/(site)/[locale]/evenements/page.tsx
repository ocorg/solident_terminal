import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma, type EventType } from '@solident/db'
import { EventCard } from '@/components/site/event-card'
import { PageHeader } from '@/components/site/page-header'
import { Link } from '@/i18n/navigation'
import { registrationState } from '@/lib/registrations'
import { alternatesFor } from '@/lib/seo'

const TYPES: EventType[] = ['caravane', 'scientifique', 'solifun', 'ambassadeurs', 'autre']

export async function generateMetadata({ params }: PageProps<'/[locale]/evenements'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Events' })
  return { alternates: alternatesFor(locale, '/evenements'), title: t('title'), description: t('intro') }
}

export default async function EventsPage({ params, searchParams }: PageProps<'/[locale]/evenements'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Events')
  const sp = await searchParams
  const type = TYPES.find((x) => x === sp.type)
  const now = new Date()

  const [upcoming, past] = await Promise.all([
    prisma.event.findMany({
      where: { isPublished: true, ...(type && { type }), OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] },
      orderBy: { startsAt: 'asc' },
      include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
    }),
    prisma.event.findMany({
      where: { isPublished: true, ...(type && { type }), OR: [{ endsAt: { lt: now } }, { endsAt: null, startsAt: { lt: now } }] },
      orderBy: { startsAt: 'desc' },
      take: 24,
    }),
  ])

  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${active ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 shadow-card hover:bg-navy-100'}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />

      <nav className="mb-10 flex flex-wrap gap-2" aria-label={t('title')}>
        <Link href="/evenements" className={chip(!type)}>
          {t('all')}
        </Link>
        {TYPES.map((x) => (
          <Link key={x} href={{ pathname: '/evenements', query: { type: x } }} className={chip(type === x)}>
            {t(`types.${x}`)}
          </Link>
        ))}
      </nav>

      <section className="mb-14">
        <h2 className="mb-4 font-heading text-2xl font-bold text-navy-700">{t('upcoming')}</h2>
        {upcoming.length === 0 ? (
          <p className="text-ink-600">{t('noUpcoming')}</p>
        ) : (
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((e) => (
              <EventCard key={e.id} event={e} placesLeft={registrationState(e, e._count.registrations).placesLeft} />
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="mb-4 font-heading text-2xl font-bold text-navy-700">{t('past')}</h2>
        {past.length === 0 ? (
          <p className="text-ink-600">{t('noPast')}</p>
        ) : (
          <ul className="grid gap-5 opacity-90 sm:grid-cols-2 lg:grid-cols-3">
            {past.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
