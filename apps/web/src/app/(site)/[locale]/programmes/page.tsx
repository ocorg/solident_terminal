import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { PageHeader } from '@/components/site/page-header'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'
import { alternatesFor } from '@/lib/seo'

export const revalidate = 3600

const accents = ['from-navy-700 to-navy-900', 'from-[#2c6e8f] to-navy-700', 'from-solifun-sky to-navy-700', 'from-gold-500 to-[#e0951a]', 'from-[#6d8fa3] to-navy-700']

export async function generateMetadata({ params }: PageProps<'/[locale]/programmes'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Programmes' })
  return { alternates: alternatesFor(locale, '/programmes'), title: t('title'), description: t('intro') }
}

export default async function ProgrammesPage({ params }: PageProps<'/[locale]/programmes'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Programmes')
  const programmes = await prisma.programme.findMany({
    where: { isActive: true },
    orderBy: { order: 'asc' },
    include: { _count: { select: { actions: { where: { isPublished: true } } } } },
  })

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />
      <ul className="grid gap-6 md:grid-cols-2">
        {programmes.map((p, i) => (
          <li key={p.id} className="card card-hover overflow-hidden">
            <Link href={`/programmes/${p.slug}`} className="flex h-full flex-col">
              <div className={`relative h-40 bg-gradient-to-br ${accents[i % accents.length]}`}>
                {p.coverUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.coverUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
                )}
                <span className="absolute bottom-3 start-4 font-heading text-5xl font-bold text-white/30">{String(i + 1).padStart(2, '0')}</span>
              </div>
              <div className="flex flex-1 flex-col p-6">
                <h2 className="font-heading text-2xl font-bold text-navy-900">{localized(p, 'title', locale)}</h2>
                <p className="mt-2 flex-1 text-ink-600">{localized(p, 'summary', locale)}</p>
                <p className="mt-4 text-sm font-semibold text-navy-700">
                  {t('discover')} <span className="flip-rtl inline-block">→</span>
                  {p._count.actions > 0 && <span className="ms-2 font-normal text-ink-600">· {p._count.actions}</span>}
                </p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  )
}
