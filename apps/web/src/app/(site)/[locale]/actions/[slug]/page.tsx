import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'

export const revalidate = 3600

const getAction = (slug: string) =>
  prisma.action.findFirst({ where: { slug, isPublished: true }, include: { programme: true, partners: { include: { partner: true } } } })

export async function generateMetadata({ params }: PageProps<'/[locale]/actions/[slug]'>): Promise<Metadata> {
  const { locale, slug } = await params
  const a = await getAction(slug)
  if (!a) return {}
  return { title: localized(a, 'title', locale), description: localized(a, 'body', locale).slice(0, 160), openGraph: { images: a.coverUrl ? [a.coverUrl] : [] } }
}

export default async function ActionPage({ params }: PageProps<'/[locale]/actions/[slug]'>) {
  const { locale, slug } = await params
  setRequestLocale(locale)
  const a = await getAction(slug)
  if (!a) notFound()
  const t = await getTranslations('Actions')
  const format = await getFormatter()
  const gallery = await prisma.media.findMany({ where: { ownerType: 'action', ownerId: a.id }, orderBy: { order: 'asc' } })
  const opts = { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' } as const

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <Link href="/actions" className="mb-6 inline-block text-sm font-semibold text-navy-700 hover:underline">
        <span className="flip-rtl inline-block">←</span> {t('back')}
      </Link>
      {a.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.coverUrl} alt="" className="mb-6 aspect-video w-full rounded-xl object-cover shadow-card" />
      )}
      <p className="text-sm font-semibold text-gold-500">
        {a.dateEnd && a.dateEnd.getTime() !== a.dateStart.getTime() ? format.dateTimeRange(a.dateStart, a.dateEnd, opts) : format.dateTime(a.dateStart, opts)}
        {a.location && ` · ${a.location}`}
      </p>
      <h1 className="mt-1 font-heading text-3xl font-bold text-navy-900 md:text-4xl">{localized(a, 'title', locale)}</h1>
      <div className="divider-dot my-5" />

      <dl className="mb-6 flex flex-wrap gap-3 text-sm">
        {a.programme && (
          <div className="card px-4 py-2">
            <dt className="inline text-ink-600">{t('programme')} : </dt>
            <dd className="inline font-semibold">
              <Link href={`/programmes/${a.programme.slug}`} className="text-navy-700 hover:underline">
                {localized(a.programme, 'title', locale)}
              </Link>
            </dd>
          </div>
        )}
        {a.partners.length > 0 && (
          <div className="card px-4 py-2">
            <dt className="inline text-ink-600">{t('with')} : </dt>
            <dd className="inline font-semibold">{a.partners.map((p) => p.partner.name).join(', ')}</dd>
          </div>
        )}
        {a.beneficiariesCount && (
          <div className="card px-4 py-2 font-semibold text-navy-700">{t('beneficiaries', { count: format.number(a.beneficiariesCount) })}</div>
        )}
      </dl>

      {localized(a, 'body', locale) && <p className="whitespace-pre-line text-lg text-ink-600">{localized(a, 'body', locale)}</p>}

      {gallery.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 font-heading text-2xl font-bold text-navy-700">{t('gallery')}</h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-3">
            {gallery.map((m) => (
              <li key={m.id}>
                <a href={m.url} target="_blank" rel="noreferrer">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={m.url} alt={localized(m, 'alt', locale)} loading="lazy" className="aspect-square w-full rounded-lg object-cover transition hover:opacity-90" />
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
