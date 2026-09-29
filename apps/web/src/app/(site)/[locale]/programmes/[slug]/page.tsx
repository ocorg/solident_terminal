import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { EventCard } from '@/components/site/event-card'
import { SectionTitle } from '@/components/site/page-header'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'
import { registrationState } from '@/lib/registrations'
import { alternatesFor } from '@/lib/seo'

export const revalidate = 3600

const getProgramme = (slug: string) => prisma.programme.findFirst({ where: { slug, isActive: true } })

export async function generateMetadata({ params }: PageProps<'/[locale]/programmes/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const p = await getProgramme(slug)
  if (!p) return {}
  return { alternates: alternatesFor(locale, `/programmes/${slug}`), title: localized(p, 'title', locale), description: localized(p, 'summary', locale) }
}

export default async function ProgrammePage({ params }: PageProps<'/[locale]/programmes/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const p = await getProgramme(slug)
  if (!p) notFound()
  const t = await getTranslations('Programmes')
  const format = await getFormatter()
  const now = new Date()

  const [actions, events] = await Promise.all([
    prisma.action.findMany({ where: { programmeId: p.id, isPublished: true }, orderBy: { dateStart: 'desc' } }),
    prisma.event.findMany({
      where: { programmeId: p.id, isPublished: true, OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] },
      orderBy: { startsAt: 'asc' },
      include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
    }),
  ])

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/programmes" className="mb-6 inline-block text-sm font-semibold text-navy-700 hover:underline">
        <span className="flip-rtl inline-block">←</span> {t('back')}
      </Link>
      <header className="mb-10 max-w-3xl">
        <h1 className="font-heading text-4xl font-bold text-navy-900">
          {localized(p, 'title', locale)}
          <span className="brand-dot" aria-hidden />
        </h1>
        <div className="divider-dot my-5" />
        <p className="text-lg text-ink-600">{localized(p, 'summary', locale)}</p>
        {localized(p, 'body', locale) && <p className="mt-4 whitespace-pre-line text-ink-600">{localized(p, 'body', locale)}</p>}
      </header>

      {events.length > 0 && (
        <section className="mb-12">
          <SectionTitle>{t('events')}</SectionTitle>
          <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {events.map((e) => (
              <EventCard key={e.id} event={e} placesLeft={registrationState(e, e._count.registrations).placesLeft} />
            ))}
          </ul>
        </section>
      )}

      <section>
        <SectionTitle>{t('actions')}</SectionTitle>
        {actions.length === 0 ? (
          <p className="text-ink-600">{t('noActions')}</p>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {actions.map((a) => (
              <li key={a.id}>
                <Link href={`/actions/${a.slug}`} className="card card-hover block h-full p-5">
                  <p className="text-sm font-semibold text-gold-700">{format.dateTime(a.dateStart, { month: 'long', year: 'numeric', timeZone: 'UTC' })}</p>
                  <p className="font-heading font-bold text-navy-900">{localized(a, 'title', locale)}</p>
                  {a.location && <p className="text-sm text-ink-600">{a.location}</p>}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
