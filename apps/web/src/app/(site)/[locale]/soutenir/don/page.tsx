import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import QRCode from 'qrcode'
import { prisma } from '@solident/db'
import { ProgressBar } from '@/components/site/progress-bar'
import { Link } from '@/i18n/navigation'
import { donorWall, sponsorWall } from '@/lib/donations'
import { localized } from '@/lib/localized'
import { ribCompact } from '@/lib/org'
import { DonationForm } from './donation-form'
import { RibCard } from './rib-card'

// Totals also refresh instantly via Pusher and revalidatePath after each confirmation.
export const revalidate = 300

export async function generateMetadata({ params }: PageProps<'/[locale]/soutenir/don'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Donate' })
  return { title: t('title'), description: t('intro') }
}

export default async function DonatePage({ params }: PageProps<'/[locale]/soutenir/don'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Donate')

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
      <header className="mb-10 max-w-3xl">
        <h1 className="font-heading text-4xl font-bold text-navy-900 md:text-5xl">
          {t('title')}
          <span className="text-gold-500">.</span>
        </h1>
        <div className="divider-dot my-5" />
        <p className="text-lg text-ink-600">{t('intro')}</p>
      </header>

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
        {sponsors.tiers.map(({ tier, partners }) => (
          <div key={tier.id} className="mb-6">
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-500">{tier.name}</p>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {partners.map((p) => (
                <SponsorTile key={p.id} partner={p} />
              ))}
            </ul>
          </div>
        ))}
        {sponsors.supporters.length > 0 && (
          <div>
            <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600">{t('supporters')}</p>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
              {sponsors.supporters.map((p) => (
                <SponsorTile key={p.id} partner={p} />
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  )
}

/** Logo if uploaded, otherwise a name placeholder (real logos come later via /admin). */
function SponsorTile({ partner }: { partner: { name: string; logoUrl: string | null; website: string | null } }) {
  const inner = partner.logoUrl ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={partner.logoUrl} alt={partner.name} className="max-h-16 w-auto object-contain" />
  ) : (
    <span className="text-center font-heading font-bold text-navy-700">{partner.name}</span>
  )
  return (
    <li className="card card-hover flex h-24 items-center justify-center p-4">
      {partner.website ? (
        <a href={partner.website} target="_blank" rel="noreferrer">
          {inner}
        </a>
      ) : (
        inner
      )}
    </li>
  )
}
