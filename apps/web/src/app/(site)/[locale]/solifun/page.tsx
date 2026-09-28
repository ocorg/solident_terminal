import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { EventCard } from '@/components/site/event-card'
import { ProgressBar } from '@/components/site/progress-bar'
import { Link } from '@/i18n/navigation'
import { getFundraising } from '@/lib/fundraising'
import { localized } from '@/lib/localized'
import { org } from '@/lib/org'
import { registrationState } from '@/lib/registrations'

export const revalidate = 300

const activities = [
  { key: 'padel', icon: '🎾' },
  { key: 'velo', icon: '🚴' },
  { key: 'kayak', icon: '🛶' },
  { key: 'foot', icon: '⚽' },
  { key: 'fifa', icon: '🎮' },
  { key: 'voyage', icon: '🧳' },
] as const

export async function generateMetadata({ params }: PageProps<'/[locale]/solifun'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Solifun' })
  return { title: 'Solifun', description: t('intro') }
}

export default async function SolifunPage({ params }: PageProps<'/[locale]/solifun'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Solifun')
  const now = new Date()

  const [events, campaign] = await Promise.all([
    prisma.event.findMany({
      where: { type: 'solifun', isPublished: true, OR: [{ endsAt: { gte: now } }, { endsAt: null, startsAt: { gte: now } }] },
      orderBy: { startsAt: 'asc' },
      include: { _count: { select: { registrations: { where: { status: { not: 'cancelled' } } } } } },
    }),
    prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { startsOn: 'asc' } }),
  ])
  const instagram = org.socials.find((s) => s.handle === '@solifun_')!

  return (
    <>
      {/* Hero: diagonal energetic shape, sky + gold accent */}
      <section className="relative overflow-hidden bg-navy-900 text-white">
        <div className="absolute -end-24 -top-24 size-96 rotate-12 rounded-[3rem] bg-solifun-sky/70" aria-hidden />
        <div className="absolute -bottom-32 end-40 size-72 -rotate-12 rounded-[3rem] bg-gold-500/80" aria-hidden />
        <div className="relative mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <p className="mb-3 font-heading text-lg font-bold text-solifun-sky">Solifun</p>
          <h1 dir="ltr" className="max-w-2xl text-start font-heading text-5xl font-bold leading-tight md:text-7xl">
            {t('slogan')}
            <span className="text-gold-500">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-white/85">{t('intro')}</p>
          <a href={instagram.href} target="_blank" rel="noreferrer" className="btn mt-8 bg-solifun-sky text-white">
            {t('followCta')}
          </a>
        </div>
      </section>

      <div className="mx-auto max-w-6xl px-4 py-14 sm:px-6">
        <section className="mb-14">
          <h2 className="mb-6 font-heading text-2xl font-bold text-navy-700">{t('activitiesTitle')}</h2>
          <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {activities.map((a) => (
              <li key={a.key} className="card card-hover flex flex-col items-center gap-2 p-5 text-center">
                <span className="text-4xl" aria-hidden>
                  {a.icon}
                </span>
                <span className="font-heading font-bold text-navy-900">{t(`activities.${a.key}`)}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="mb-14">
          <h2 className="mb-6 font-heading text-2xl font-bold text-navy-700">{t('eventsTitle')}</h2>
          {events.length === 0 ? (
            <p className="text-ink-600">{t('noEvents')}</p>
          ) : (
            <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {events.map((e) => (
                <EventCard key={e.id} event={e} placesLeft={registrationState(e, e._count.registrations).placesLeft} />
              ))}
            </ul>
          )}
        </section>

        {/* "Where the money goes" strip linking to the funded campaign (spec §8) */}
        <section className="card overflow-hidden md:flex">
          <div className="flex-1 border-s-8 border-solifun-sky p-8">
            <h2 className="mb-2 font-heading text-2xl font-bold text-navy-700">{t('fundsTitle')}</h2>
            <p className="text-ink-600">{t('fundsText')}</p>
          </div>
          {campaign && (await getFundraising()).open && (
            <div className="flex flex-col justify-center gap-4 bg-navy-700 p-8 text-white md:w-96">
              <p className="text-sm text-white/80">{localized(campaign, 'title', locale)}</p>
              <ProgressBar campaignId={campaign.id} initial={{ raisedDh: campaign.raisedDh, donorsCount: campaign.donorsCount, goalDh: campaign.goalDh }} dark />
              <Link href="/soutenir/don" className="btn btn-cta">
                {t('fundsCta')}
              </Link>
            </div>
          )}
        </section>
      </div>
    </>
  )
}
