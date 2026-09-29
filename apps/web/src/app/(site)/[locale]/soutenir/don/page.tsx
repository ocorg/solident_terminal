import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import QRCode from 'qrcode'
import { prisma } from '@solident/db'
import { PageHeader } from '@/components/site/page-header'
import { ProgressBar } from '@/components/site/progress-bar'
import { SponsorWall } from '@/components/site/sponsor-wall'
import { Link } from '@/i18n/navigation'
import { donorWall, sponsorWall } from '@/lib/donations'
import { getFundraising } from '@/lib/fundraising'
import { localized } from '@/lib/localized'
import { ribCompact } from '@/lib/org'
import { DonationForm } from './donation-form'
import { RibCard } from './rib-card'
import { alternatesFor } from '@/lib/seo'

// Totals also refresh instantly via Pusher and revalidatePath after each confirmation.
export const revalidate = 300

export async function generateMetadata({ params }: PageProps<'/[locale]/soutenir/don'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Donate' })
  return { alternates: alternatesFor(locale, '/soutenir/don'), title: t('title'), description: (await getFundraising()).open ? t('intro') : t('closedIntro') }
}

export default async function DonatePage({ params }: PageProps<'/[locale]/soutenir/don'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Donate')
  const fundraising = await getFundraising()

  // Closed (no authorization yet, law 18-18): no RIB, no form, no bar; other ways to help instead.
  if (!fundraising.open) {
    const sponsors = await sponsorWall()
    return (
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <PageHeader title={t('title')} intro={t('closedIntro')} />
        <section className="card border-s-4 border-gold-500 p-6 md:p-8">
          <h2 className="mb-2 font-heading text-2xl font-bold text-navy-700">{t('closedTitle')}</h2>
          <p className="mb-6 max-w-3xl text-ink-600">{t('closedText')}</p>
          <div className="flex flex-wrap gap-3">
            <Link href="/soutenir/sponsoring" className="btn btn-primary">
              {t('closedSponsor')}
            </Link>
            <Link href="/soutenir/benevolat" className="btn btn-ghost">
              {t('closedVolunteer')}
            </Link>
            <Link href="/contact" className="btn btn-ghost">
              {t('closedContact')}
            </Link>
          </div>
        </section>
        {(sponsors.tiers.length > 0 || sponsors.supporters.length > 0) && (
          <section className="mt-16">
            <h2 className="mb-6 font-heading text-2xl font-bold text-navy-700">{t('sponsorWallTitle')}</h2>
            <SponsorWall wall={sponsors} />
          </section>
        )}
      </div>
    )
  }

  const campaigns = await prisma.campaign.findMany({ where: { isActive: true }, orderBy: { startsOn: 'asc' } })
  const main = campaigns[0]
  const [names, sponsors, qrSvg] = await Promise.all([
    main ? donorWall(main.id) : Promise.resolve([]),
    sponsorWall(main?.id),
    QRCode.toString(ribCompact, { type: 'svg', margin: 0, color: { dark: '#123A4F', light: '#FFFFFF' } }),
  ])
  const anonymousCount = main ? main.donorsCount - names.length : 0

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />
      {fundraising.authorization && <p className="-mt-6 mb-8 text-sm text-ink-600">{t('authorization', { ref: fundraising.authorization })}</p>}

      {campaigns.length === 0 && <p className="card mb-10 p-6 text-ink-600">{t('noCampaign')}</p>}

      <div className="mb-12 grid gap-6">
        {campaigns.map((c) => (
          <section key={c.id} className="card overflow-hidden md:flex" aria-labelledby={`campaign-${c.id}`}>
            <div className="flex-1 bg-navy-700 p-8 text-white">
              <h2 id={`campaign-${c.id}`} className="mb-2 font-heading text-2xl font-bold">
                {localized(c, 'title', locale)}
              </h2>
              {localized(c, 'summary', locale) && <p className="mb-6 text-white/80">{localized(c, 'summary', locale)}</p>}
              <ProgressBar campaignId={c.id} initial={{ raisedDh: c.raisedDh, donorsCount: c.donorsCount, goalDh: c.goalDh }} dark />
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-10 lg:grid-cols-5">
        <div className="space-y-8 lg:col-span-2">
          <section>
            <h2 className="mb-4 font-heading text-xl font-bold text-navy-700">{t('howTitle')}</h2>
            <ol className="space-y-3">
              {(['step1', 'step2', 'step3'] as const).map((s, i) => (
                <li key={s} className="flex gap-3">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-gold-500 font-bold text-navy-900">{i + 1}</span>
                  <span className="text-ink-600">{t(s)}</span>
                </li>
              ))}
            </ol>
          </section>
          <section>
            <h2 className="mb-4 font-heading text-xl font-bold text-navy-700">{t('ribTitle')}</h2>
            <RibCard qrSvg={qrSvg} />
          </section>
        </div>

        {campaigns.length > 0 && (
          <section className="card p-6 lg:col-span-3 md:p-8" aria-labelledby="declare">
            <h2 id="declare" className="mb-6 font-heading text-2xl font-bold text-navy-700">
              {t('formTitle')}
            </h2>
            <DonationForm campaigns={campaigns.map((c) => ({ id: c.id, title: localized(c, 'title', locale) }))} />
          </section>
        )}
      </div>

      {/* Donor wall: names only, never amounts */}
      <section className="mt-16">
        <h2 className="mb-4 font-heading text-2xl font-bold text-navy-700">{t('donorWallTitle')}</h2>
        {names.length === 0 ? (
          <p className="text-ink-600">{t('donorWallEmpty')}</p>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {names.map((n, i) => (
              <li key={`${n}-${i}`} className="rounded-full bg-white px-4 py-1.5 text-sm font-medium text-navy-700 shadow-card">
                {n}
              </li>
            ))}
          </ul>
        )}
        {anonymousCount > 0 && <p className="mt-3 text-sm text-ink-600">{t('anonymousNote')}</p>}
      </section>

      {/* Sponsor wall: companies grouped by earned tier */}
      <section className="mt-16">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
          <h2 className="font-heading text-2xl font-bold text-navy-700">{t('sponsorWallTitle')}</h2>
          <Link href="/soutenir/sponsoring" className="btn btn-cta">
            {t('becomeSponsor')}
          </Link>
        </div>
        <SponsorWall wall={sponsors} />
      </section>
    </div>
  )
}

