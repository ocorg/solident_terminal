import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { Link } from '@/i18n/navigation'
import { getFundraising } from '@/lib/fundraising'
import { localized } from '@/lib/localized'
import { registrationState, takenPlaces } from '@/lib/registrations'
import { RegistrationPanel } from './registration-panel'

// Places left also update live via Pusher; this only bounds how stale the first paint can be.
export const revalidate = 60

async function getEvent(slug: string) {
  return prisma.event.findFirst({ where: { slug, isPublished: true }, include: { programme: true } })
}

export async function generateMetadata({ params }: PageProps<'/[locale]/evenements/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const e = await getEvent(slug)
  if (!e) return {}
  return { title: localized(e, 'title', locale), description: localized(e, 'body', locale).slice(0, 160), openGraph: { images: e.coverUrl ? [e.coverUrl] : [] } }
}

export default async function EventPage({ params }: PageProps<'/[locale]/evenements/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const e = await getEvent(slug)
  if (!e) notFound()
  const t = await getTranslations('Events')
  const format = await getFormatter()
  const state = registrationState(e, await takenPlaces(prisma, e.id))
  const long = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: 'numeric', minute: '2-digit' } as const

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <Link href="/evenements" className="mb-6 inline-block text-sm font-semibold text-navy-700 hover:underline">
        <span className="flip-rtl inline-block">←</span> {t('back')}
      </Link>

      <div className="grid gap-10 lg:grid-cols-5">
        <article className="lg:col-span-3">
          {e.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={e.coverUrl} alt="" className="mb-6 aspect-video w-full rounded-xl object-cover shadow-card" />
          )}
          <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-gold-500">{t(`types.${e.type}`)}</p>
          <h1 className="font-heading text-3xl font-bold text-navy-900 md:text-4xl">{localized(e, 'title', locale)}</h1>
          <div className="divider-dot my-5" />
          <dl className="mb-6 grid gap-3 sm:grid-cols-2">
            <div className="card p-4">
              <dt className="text-sm text-ink-600">{t('when')}</dt>
              <dd className="font-semibold">
                {e.endsAt ? format.dateTimeRange(e.startsAt, e.endsAt, long) : format.dateTime(e.startsAt, long)}
              </dd>
            </div>
            {e.location && (
              <div className="card p-4">
                <dt className="text-sm text-ink-600">{t('where')}</dt>
                <dd className="font-semibold">{e.location}</dd>
              </div>
            )}
          </dl>
          {localized(e, 'body', locale) && <p className="whitespace-pre-line text-ink-600">{localized(e, 'body', locale)}</p>}
        </article>

        <aside className="lg:col-span-2">
          {e.registrationOpen || state.placesLeft === 0 ? (
            <RegistrationPanel eventId={e.id} initial={{ open: state.open, placesLeft: state.placesLeft }} />
          ) : e.type === 'caravane' ? (
            <div className="card space-y-4 bg-navy-700 p-6 text-white">
              <p className="font-heading text-xl font-bold">{localized(e, 'title', locale)}</p>
              <Link href={(await getFundraising()).open ? '/soutenir/don' : '/soutenir/sponsoring'} className="btn btn-cta">
                {(await getTranslations('Home'))((await getFundraising()).open ? 'nextEventCta' : 'ctaSponsor')}
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  )
}
