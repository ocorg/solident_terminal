import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { InquiryForm } from '@/components/site/inquiry-form'
import { PageHeader, SectionTitle } from '@/components/site/page-header'
import { PersonCard } from '@/components/site/person-card'
import { SponsorWall } from '@/components/site/sponsor-wall'
import { sponsorWall } from '@/lib/donations'
import { localized, localizedList } from '@/lib/localized'

export const revalidate = 300

export async function generateMetadata({ params }: PageProps<'/[locale]/soutenir/sponsoring'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Sponsoring' })
  return { title: t('title'), description: t('intro') }
}

const tierAccent: Record<string, string> = {
  diamond: 'from-navy-900 to-navy-700 text-white',
  gold: 'from-gold-500 to-gold-100 text-navy-900',
  silver: 'from-navy-100 to-white text-navy-900',
  bronze: 'from-[#e8c9a8] to-white text-navy-900',
}

export default async function SponsoringPage({ params }: PageProps<'/[locale]/soutenir/sponsoring'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Sponsoring')
  const format = await getFormatter()

  const [tiers, contacts, wall, dossier] = await Promise.all([
    prisma.sponsorTier.findMany({ orderBy: { order: 'asc' } }),
    prisma.teamMember.findMany({ where: { isPublicContact: true }, orderBy: { order: 'asc' } }),
    sponsorWall(),
    prisma.siteSetting.findUnique({ where: { key: 'dossier_url' } }),
  ])
  const money = (n: number) => format.number(n, { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />

      <section className="mb-14">
        <SectionTitle>{t('whyTitle')}</SectionTitle>
        <ul className="grid gap-4 md:grid-cols-3">
          {(['why1', 'why2', 'why3'] as const).map((k) => (
            <li key={k} className="card p-6 text-ink-600">
              <span className="mb-3 block size-2.5 rounded-full bg-gold-500" />
              {t(k)}
            </li>
          ))}
        </ul>
      </section>

      <section className="mb-14">
        <SectionTitle>{t('tiersTitle')}</SectionTitle>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {tiers.map((tier) => (
            <article key={tier.id} className="card card-hover flex flex-col overflow-hidden">
              <div className={`bg-gradient-to-br p-5 ${tierAccent[tier.slug] ?? 'from-navy-100 to-white text-navy-900'}`}>
                <h3 className="font-heading text-2xl font-bold">{tier.name}</h3>
                <p className="text-sm font-semibold opacity-90">{t('from', { amount: money(tier.minDh) })}</p>
              </div>
              <ul className="flex-1 space-y-2 p-5 text-sm text-ink-600">
                {localizedList(tier, 'benefits', locale).map((b) => (
                  <li key={b} className="flex gap-2">
                    <span className="mt-2 size-1.5 shrink-0 rounded-full bg-gold-500" />
                    {b}
                  </li>
                ))}
              </ul>
            </article>
          ))}
        </div>
        <div className="mt-6">
          {dossier ? (
            <a href={dossier.value} target="_blank" rel="noreferrer" className="btn btn-cta">
              {t('dossier')}
            </a>
          ) : (
            <p className="text-sm text-ink-600">{t('dossierSoon')}</p>
          )}
        </div>
      </section>

      <div className="mb-14 grid gap-10 lg:grid-cols-5">
        <section className="card p-6 md:p-8 lg:col-span-3" aria-labelledby="sponsor-form">
          <h2 id="sponsor-form" className="mb-2 font-heading text-2xl font-bold text-navy-700">
            {t('formTitle')}
          </h2>
          <p className="mb-6 text-ink-600">{t('formIntro')}</p>
          <InquiryForm kind="sponsor" tiers={tiers.map((x) => ({ id: x.id, name: x.name }))} />
        </section>
        {contacts.length > 0 && (
          <section className="lg:col-span-2">
            <SectionTitle>{t('contactsTitle')}</SectionTitle>
            <ul className="grid gap-4">
              {contacts.map((c) => (
                <PersonCard key={c.id} name={c.fullName} role={localized(c, 'role', locale)} photoUrl={c.photoUrl} phone={c.phone} />
              ))}
            </ul>
          </section>
        )}
      </div>

      {(wall.tiers.length > 0 || wall.supporters.length > 0) && (
        <section>
          <SectionTitle>{t('wallTitle')}</SectionTitle>
          <SponsorWall wall={wall} />
        </section>
      )}
    </div>
  )
}
