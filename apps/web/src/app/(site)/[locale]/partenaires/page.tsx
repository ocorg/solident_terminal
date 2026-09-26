import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma, type PartnerType } from '@solident/db'
import { PageHeader, SectionTitle } from '@/components/site/page-header'
import { Link } from '@/i18n/navigation'

export const revalidate = 3600

const ORDER: PartnerType[] = ['sponsor', 'association', 'universite', 'ecole', 'sport']

export async function generateMetadata({ params }: PageProps<'/[locale]/partenaires'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Partners' })
  return { title: t('title'), description: t('intro') }
}

export default async function PartnersPage({ params }: PageProps<'/[locale]/partenaires'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Partners')
  const partners = await prisma.partner.findMany({
    where: { isVisible: true },
    orderBy: [{ order: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { actions: { where: { action: { isPublished: true } } } } } },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />
      {ORDER.map((type) => {
        const group = partners.filter((p) => p.type === type)
        if (group.length === 0) return null
        return (
          <section key={type} className="mb-12">
            <SectionTitle>{t(`types.${type}`)}</SectionTitle>
            <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
              {group.map((p) => {
                const inner = (
                  <>
                    <div className="flex h-20 items-center justify-center">
                      {p.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.logoUrl} alt={p.name} loading="lazy" className="max-h-full max-w-full object-contain" />
                      ) : (
                        <span className="text-center font-heading text-lg font-bold text-navy-700">{p.name}</span>
                      )}
                    </div>
                    {p.logoUrl && <p className="mt-2 text-center text-sm font-semibold text-navy-900">{p.name}</p>}
                    {p._count.actions > 0 && <p className="mt-1 text-center text-xs text-ink-600">{t('together', { count: p._count.actions })}</p>}
                  </>
                )
                return (
                  <li key={p.id} className="card card-hover p-4">
                    {p.website ? (
                      <a href={p.website} target="_blank" rel="noreferrer" className="block">
                        {inner}
                      </a>
                    ) : (
                      inner
                    )}
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
      <div className="text-center">
        <Link href="/soutenir/sponsoring" className="btn btn-cta">
          {t('cta')}
        </Link>
      </div>
    </div>
  )
}
