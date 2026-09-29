import type { Metadata } from 'next'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { ActionsMap } from '@/components/site/actions-map'
import { PageHeader, SectionTitle } from '@/components/site/page-header'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'
import { alternatesFor } from '@/lib/seo'

export const revalidate = 3600

export async function generateMetadata({ params }: PageProps<'/[locale]/actions'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Actions' })
  return { alternates: alternatesFor(locale, '/actions'), title: t('title'), description: t('intro') }
}

export default async function ActionsPage({ params, searchParams }: PageProps<'/[locale]/actions'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Actions')
  const format = await getFormatter()
  const { programme: filter } = await searchParams

  const [actions, programmes] = await Promise.all([
    prisma.action.findMany({
      where: { isPublished: true },
      orderBy: { dateStart: 'desc' },
      include: { programme: true, partners: { include: { partner: { select: { id: true, name: true } } } } },
    }),
    prisma.programme.findMany({ where: { actions: { some: { isPublished: true } } }, orderBy: { order: 'asc' } }),
  ])
  const shown = typeof filter === 'string' ? actions.filter((a) => a.programme?.slug === filter) : actions

  const dayFmt = (a: (typeof actions)[number]) => {
    const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } as const
    return a.dateEnd && a.dateEnd.getTime() !== a.dateStart.getTime() ? format.dateTimeRange(a.dateStart, a.dateEnd, opts) : format.dateTime(a.dateStart, opts)
  }
  const partnerNames = (a: (typeof actions)[number]) => a.partners.map((p) => p.partner.name).join(', ')

  const caravans = actions.filter((a) => a.programme?.slug === 'caravanes')
  const points = caravans
    .filter((a) => a.lat !== null && a.lng !== null)
    .map((a) => ({ slug: a.slug, title: localized(a, 'title', locale), date: dayFmt(a), partner: partnerNames(a) || null, lat: a.lat!, lng: a.lng!, href: `/${locale}/actions/${a.slug}`, cta: t('seeAction') }))
  const totals = [
    { key: 'actions', value: actions.length },
    { key: 'caravans', value: caravans.length },
    { key: 'beneficiaries', value: actions.reduce((s, a) => s + (a.beneficiariesCount ?? 0), 0) },
    { key: 'partners', value: new Set(actions.flatMap((a) => a.partners.map((p) => p.partner.id))).size },
  ] as const

  const byYear = new Map<number, typeof shown>()
  for (const a of shown) byYear.set(a.dateStart.getUTCFullYear(), [...(byYear.get(a.dateStart.getUTCFullYear()) ?? []), a])
  const chip = (active: boolean) =>
    `rounded-full px-4 py-1.5 text-sm font-semibold transition ${active ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 shadow-card hover:bg-navy-100'}`

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />

      <dl className="mb-12 grid grid-cols-2 gap-4 md:grid-cols-4">
        {totals.map((x) => (
          <div key={x.key} className="card p-5">
            <dd className="font-heading text-3xl font-bold text-navy-700">{format.number(x.value)}</dd>
            <dt className="text-sm text-ink-600">{t(`totals.${x.key}`)}</dt>
          </div>
        ))}
      </dl>

      <section className="mb-14">
        <SectionTitle>{t('mapTitle')}</SectionTitle>
        <ActionsMap points={points} />
        {points.length < caravans.length && <p className="mt-2 text-sm text-ink-600">{t('mapNote')}</p>}
      </section>

      <section>
        <SectionTitle>{t('timelineTitle')}</SectionTitle>
        <nav className="mb-8 flex flex-wrap gap-2">
          <Link href="/actions" className={chip(typeof filter !== 'string')}>
            {t('all')}
          </Link>
          {programmes.map((p) => (
            <Link key={p.id} href={{ pathname: '/actions', query: { programme: p.slug } }} className={chip(filter === p.slug)}>
              {localized(p, 'title', locale)}
            </Link>
          ))}
        </nav>
        {[...byYear.entries()].map(([year, list]) => (
          <div key={year} className="mb-10">
            <p className="mb-4 font-heading text-4xl font-bold text-gold-600">{year}</p>
            <ol className="space-y-3 border-s-2 border-gold-500 ps-6">
              {list.map((a) => (
                <li key={a.id} className="relative">
                  <span className="absolute -start-[31px] top-5 size-3 rounded-full bg-gold-500 ring-4 ring-cream-50" aria-hidden />
                  <Link href={`/actions/${a.slug}`} className="card card-hover block p-4">
                    <p className="text-sm font-semibold text-gold-700">{dayFmt(a)}</p>
                    <p className="font-heading font-bold text-navy-900">{localized(a, 'title', locale)}</p>
                    <p className="text-sm text-ink-600">
                      {[a.programme && localized(a.programme, 'title', locale), partnerNames(a) && `${t('with')} ${partnerNames(a)}`, a.beneficiariesCount && t('beneficiaries', { count: a.beneficiariesCount })].filter(Boolean).join(' · ')}
                    </p>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </section>
    </div>
  )
}
