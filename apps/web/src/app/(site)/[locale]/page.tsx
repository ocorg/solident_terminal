import { getFormatter, getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { BrushRing, SmileDivider } from '@/components/motion/brush-ring'
import { CountUp } from '@/components/motion/count-up'
import { ProgressBar } from '@/components/site/progress-bar'
import { Link } from '@/i18n/navigation'
import { getFundraising } from '@/lib/fundraising'
import { localized } from '@/lib/localized'
import { jsonLd, ngoJsonLd } from '@/lib/seo'

// Rebuilt at most every 5 minutes; the donation bar itself updates live via Pusher.
export const revalidate = 300

// Home = who we are first (association, mission, impact, actions); ways to help come last.
// Motion: brushstroke + smile draw on load, sections rise in on scroll, counters count up — all off with "reduce motion".
export default async function HomePage({ params }: PageProps<'/[locale]'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Home')
  const about = await getTranslations('About')
  const format = await getFormatter()
  const meta = await getTranslations('Metadata')

  const [stats, nextEvent, campaign, programmes, actions, partners, fundraising] = await Promise.all([
    prisma.impactStat.findMany({ orderBy: { order: 'asc' } }),
    prisma.event.findFirst({ where: { isPublished: true, startsAt: { gte: new Date() } }, orderBy: { startsAt: 'asc' } }),
    prisma.campaign.findFirst({ where: { isActive: true }, orderBy: { startsOn: 'asc' } }),
    prisma.programme.findMany({ where: { isActive: true }, orderBy: { order: 'asc' } }),
    prisma.action.findMany({ where: { isPublished: true }, orderBy: { dateStart: 'desc' }, take: 3 }),
    prisma.partner.findMany({ where: { isVisible: true }, orderBy: [{ order: 'asc' }, { name: 'asc' }], select: { id: true, name: true, logoUrl: true } }),
    getFundraising(),
  ])
  const actionDate = (d: Date) => format.dateTime(d, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const daysLeft = nextEvent ? Math.max(0, Math.ceil((nextEvent.startsAt.getTime() - Date.now()) / 86_400_000)) : null
  const heroStat = stats[0]

  const ways = [
    { href: '/soutenir/sponsoring', title: t('joinSponsorTitle'), text: t('joinSponsorText') },
    { href: '/soutenir/benevolat', title: t('joinVolunteerTitle'), text: t('joinVolunteerText') },
    fundraising.open
      ? { href: '/soutenir/don', title: t('joinDonateTitle'), text: t('joinDonateText') }
      : { href: '/contact', title: t('joinContactTitle'), text: t('joinContactText') },
  ]

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(ngoJsonLd(locale, meta('description')))} />
      {/* ───────── Hero: who we are ───────── */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute -end-40 -top-40 size-[40rem] rounded-full bg-[radial-gradient(closest-side,rgb(244_178_35/0.18),transparent)]" aria-hidden />
        <div className="pointer-events-none absolute -bottom-48 -start-40 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(30_84_112/0.10),transparent)]" aria-hidden />
        <div className="relative mx-auto grid max-w-7xl items-center gap-12 px-4 pb-20 pt-12 sm:px-6 md:pt-20 lg:grid-cols-[1.15fr_0.85fr]">
          <div>
            <p className="mb-4 text-sm font-semibold uppercase tracking-[0.14em] text-navy-700">{t('eyebrow')}</p>
            <h1 className="max-w-3xl font-heading text-[2.6rem] font-bold leading-[1.05] tracking-tight text-navy-900 md:text-7xl">
              {t('title')}
              <span className="brand-dot" aria-hidden />
            </h1>
            <SmileDivider className="my-6 h-7 w-40" />
            <p className="max-w-xl text-lg text-ink-600">{t('intro')}</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/qui-sommes-nous" className="btn btn-primary nudge">
                {t('ctaAbout')} <span className="nudge-arrow flip-rtl inline-block">→</span>
              </Link>
              <Link href="/actions" className="btn btn-ghost">
                {t('ctaActions')}
              </Link>
            </div>
          </div>

          {/* Brand composition: the logo inside its hand-painted ring, with live facts floating around */}
          <div className="relative mx-auto aspect-square w-full max-w-[26rem]">
            <BrushRing className="absolute inset-0 size-full" />
            <div className="absolute inset-[18%] flex items-center justify-center rounded-full bg-white shadow-[0_24px_60px_rgba(18,58,79,0.16)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/logo.webp" alt="" width={220} height={228} className="w-[62%]" loading="lazy" decoding="async" />
            </div>
            {heroStat && (
              <p className="float absolute -start-2 top-[12%] rounded-2xl bg-white px-4 py-3 shadow-card sm:-start-6">
                <span className="block font-heading text-2xl font-bold text-navy-700">{format.number(heroStat.value)}</span>
                <span className="text-sm text-ink-600">{localized(heroStat, 'label', locale)}</span>
              </p>
            )}
            {nextEvent && daysLeft !== null && (
              <p className="float absolute -end-2 bottom-[10%] flex items-center gap-3 rounded-2xl bg-navy-900 px-4 py-3 text-white shadow-card [animation-delay:-3s] sm:-end-6">
                <span className="live-dot size-2.5 shrink-0 rounded-full bg-gold-500" aria-hidden />
                <span>
                  <span className="block font-heading text-lg font-bold">{t('countdown', { days: daysLeft })}</span>
                  <span className="block max-w-44 truncate text-sm text-white/80">{localized(nextEvent, 'title', locale)}</span>
                </span>
              </p>
            )}
          </div>
        </div>
      </section>

      {/* ───────── About: story + mission / vision / values ───────── */}
      <section className="bg-white py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-5">
          <div className="lg:col-span-2" data-reveal>
            <h2 className="font-heading text-3xl font-bold text-navy-900">
              {t('aboutTitle')}
              <span className="brand-dot" aria-hidden />
            </h2>
            <p className="mt-5 text-lg text-navy-900">{about('intro')}</p>
            <p className="mt-4 text-ink-600">{about('story')}</p>
            <Link href="/qui-sommes-nous" className="nudge mt-6 inline-flex items-center gap-1 font-semibold text-navy-700 underline decoration-gold-500 decoration-2 underline-offset-4">
              {t('aboutCta')} <span className="nudge-arrow flip-rtl inline-block">→</span>
            </Link>
          </div>
          <ol className="lg:col-span-3">
            {(['mission', 'vision', 'values'] as const).map((k, i) => (
              <li key={k} className="grid grid-cols-[3.5rem_1fr] gap-4 border-t border-navy-100 py-6 first:border-t-0 first:pt-0" data-reveal>
                <span className="font-heading text-4xl font-bold text-gold-600" aria-hidden>
                  0{i + 1}
                </span>
                <div>
                  <h3 className="font-heading text-xl font-bold text-navy-900">{t(`${k}Title`)}</h3>
                  <p className="mt-1 text-ink-600">{t(k)}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ───────── Impact: big numbers that count up ───────── */}
      {stats.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <h2 className="font-heading text-3xl font-bold text-navy-900" data-reveal>
            {t('impactTitle')}
            <span className="brand-dot" aria-hidden />
          </h2>
          <dl className="mt-10 grid grid-cols-2 gap-y-10 md:grid-cols-4">
            {stats.map((s) => (
              <div key={s.key} className="flex flex-col border-s-2 border-gold-500 ps-5" data-reveal>
                <dt className="order-2 mt-1 text-sm text-ink-600">{localized(s, 'label', locale)}</dt>
                <dd className="font-heading text-5xl font-bold tracking-tight text-navy-700 md:text-6xl">
                  <CountUp value={s.value} locale={locale} />
                </dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {/* ───────── What we do: programmes as an editorial list ───────── */}
      {programmes.length > 0 && (
        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
          <div className="mb-8 flex flex-wrap items-end justify-between gap-3" data-reveal>
            <h2 className="font-heading text-3xl font-bold text-navy-900">
              {t('programmesTitle')}
              <span className="brand-dot" aria-hidden />
            </h2>
            <Link href="/programmes" className="nudge text-sm font-semibold text-navy-700 hover:underline">
              {t('seeAll')} <span className="nudge-arrow flip-rtl inline-block">→</span>
            </Link>
          </div>
          <ul className="grid gap-px overflow-hidden rounded-2xl bg-navy-100 sm:grid-cols-2 lg:grid-cols-3">
            {programmes.map((p, i) => (
              <li key={p.id} data-reveal>
                <Link href={`/programmes/${p.slug}`} className="group flex h-full flex-col bg-white p-6 transition hover:bg-navy-900">
                  <span className="font-heading text-sm font-bold text-gold-700 transition group-hover:text-gold-500">{String(i + 1).padStart(2, '0')}</span>
                  <h3 className="mt-3 font-heading text-xl font-bold text-navy-900 transition group-hover:text-white">{localized(p, 'title', locale)}</h3>
                  <p className="mt-2 line-clamp-3 text-sm text-ink-600 transition group-hover:text-white/80">{localized(p, 'summary', locale)}</p>
                </Link>
              </li>
            ))}
            {/* Filler cell so the grid never ends on an empty gap: a link to all programmes */}
            {programmes.length % 3 !== 0 && (
              <li className={programmes.length % 3 === 1 ? 'lg:col-span-2' : ''} data-reveal>
                <Link href="/programmes" className="nudge flex h-full min-h-40 items-center justify-between gap-4 bg-navy-900 p-6 text-white transition hover:bg-navy-700">
                  <span className="font-heading text-xl font-bold">{t('seeAll')}</span>
                  <span className="nudge-arrow flip-rtl inline-flex size-11 items-center justify-center rounded-full bg-gold-500 text-lg text-navy-900" aria-hidden>
                    →
                  </span>
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {/* ───────── Latest actions on the ground ───────── */}
      {actions.length > 0 && (
        <section className="bg-white py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-3" data-reveal>
              <h2 className="font-heading text-3xl font-bold text-navy-900">
                {t('actionsTitle')}
                <span className="brand-dot" aria-hidden />
              </h2>
              <Link href="/actions" className="nudge text-sm font-semibold text-navy-700 hover:underline">
                {t('actionsMap')} <span className="nudge-arrow flip-rtl inline-block">→</span>
              </Link>
            </div>
            <ul className="grid gap-6 md:grid-cols-3">
              {actions.map((a) => (
                <li key={a.id} data-reveal>
                  <Link href={`/actions/${a.slug}`} className="group block h-full">
                    <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-navy-900">
                      {a.coverUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.coverUrl} alt="" className="size-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
                      ) : (
                        // No photo yet: a branded visual instead of a grey box
                        <div className="flex size-full items-center justify-center">
                          <svg viewBox="0 0 400 400" className="size-2/3 opacity-60 transition duration-500 group-hover:rotate-12" aria-hidden>
                            <path d="M318 96 C 372 150, 380 250, 322 316 C 262 384, 146 392, 84 330 C 26 272, 24 166, 84 100 C 128 52, 196 36, 252 52" fill="none" stroke="#F4B223" strokeWidth="14" strokeLinecap="round" />
                          </svg>
                          <span className="absolute font-heading text-5xl font-bold text-white/90">{a.dateStart.getUTCFullYear()}</span>
                        </div>
                      )}
                    </div>
                    <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-gold-700">
                      {actionDate(a.dateStart)}
                      {a.location && ` · ${a.location}`}
                    </p>
                    <h3 className="mt-1 font-heading text-lg font-bold text-navy-900 group-hover:underline group-hover:decoration-gold-500 group-hover:decoration-2 group-hover:underline-offset-4">
                      {localized(a, 'title', locale)}
                    </h3>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      {/* ───────── Next big event, with a live countdown (+ live bar while fundraising is open) ───────── */}
      {nextEvent && (
        <section className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
          <div className="relative overflow-hidden rounded-3xl bg-navy-900 text-white md:flex" data-reveal>
            <BrushRing className="pointer-events-none absolute -end-24 -top-24 size-80 opacity-25" strokeWidth={10} />
            <div className="relative flex-1 p-8 md:p-12">
              <p className="flex items-center gap-2 text-sm font-semibold text-gold-500">
                <span className="live-dot size-2 rounded-full bg-gold-500" aria-hidden />
                {t('nextEvent')}
              </p>
              <h2 className="mt-3 font-heading text-3xl font-bold md:text-4xl">{localized(nextEvent, 'title', locale)}</h2>
              <p className="mt-2 font-medium text-white/80">
                {nextEvent.endsAt
                  ? format.dateTimeRange(nextEvent.startsAt, nextEvent.endsAt, { day: 'numeric', month: 'long', year: 'numeric' })
                  : format.dateTime(nextEvent.startsAt, { day: 'numeric', month: 'long', year: 'numeric' })}
                {nextEvent.location && ` · ${nextEvent.location}`}
              </p>
              <p className="mt-5 line-clamp-4 max-w-2xl text-white/80">{localized(nextEvent, 'body', locale)}</p>
              <div className="mt-8 flex flex-wrap items-center gap-6">
                {daysLeft !== null && (
                  <p className="font-heading text-5xl font-bold text-gold-500">{t('countdown', { days: daysLeft })}</p>
                )}
                <Link href={`/evenements/${nextEvent.slug}`} className="btn btn-cta nudge">
                  {t('nextEventMore')} <span className="nudge-arrow flip-rtl inline-block">→</span>
                </Link>
              </div>
            </div>
            {campaign && fundraising.open && (
              <div className="relative flex flex-col justify-center gap-4 bg-navy-700 p-8 md:w-96">
                <p className="text-sm text-white/80">{localized(campaign, 'title', locale)}</p>
                <ProgressBar campaignId={campaign.id} initial={{ raisedDh: campaign.raisedDh, donorsCount: campaign.donorsCount, goalDh: campaign.goalDh }} dark />
                <Link href="/soutenir/don" className="btn btn-cta mt-2">
                  {t('nextEventCta')}
                </Link>
              </div>
            )}
          </div>
        </section>
      )}

      {/* ───────── Ways to act with us: one lead card, two quieter ones ───────── */}
      <section className="mx-auto max-w-7xl px-4 pb-24 sm:px-6">
        <h2 className="mb-8 font-heading text-3xl font-bold text-navy-900" data-reveal>
          {t('joinTitle')}
          <span className="brand-dot" aria-hidden />
        </h2>
        <ul className="grid gap-4 md:grid-cols-2 md:grid-rows-2">
          {ways.map((w, i) => (
            <li key={w.href} className={i === 0 ? 'md:row-span-2' : ''} data-reveal>
              <Link
                href={w.href}
                className={`nudge flex h-full flex-col justify-between gap-6 rounded-3xl p-8 transition hover:-translate-y-1 ${
                  i === 0 ? 'bg-gold-500 text-navy-900 hover:shadow-[0_20px_50px_rgba(244,178,35,0.35)]' : 'card hover:shadow-card-hover'
                }`}
              >
                <div>
                  <h3 className={`font-heading font-bold ${i === 0 ? 'text-3xl md:text-4xl' : 'text-xl text-navy-900'}`}>{w.title}</h3>
                  <p className={`mt-3 ${i === 0 ? 'max-w-md text-lg text-navy-900' : 'text-ink-600'}`}>{w.text}</p>
                </div>
                <span className={`nudge-arrow flip-rtl inline-flex size-12 items-center justify-center rounded-full text-xl ${i === 0 ? 'bg-navy-900 text-white' : 'bg-navy-100 text-navy-700'}`} aria-hidden>
                  →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* ───────── Partners: a slow, pausable band (logos when uploaded, names until then) ───────── */}
      {partners.length > 0 && (
        <section className="border-t border-navy-100 bg-white py-14">
          <div className="mx-auto mb-8 flex max-w-7xl flex-wrap items-end justify-between gap-3 px-4 sm:px-6">
            <h2 className="font-heading text-2xl font-bold text-navy-900">
              {t('partnersTitle')}
              <span className="brand-dot" aria-hidden />
            </h2>
            <Link href="/partenaires" className="nudge text-sm font-semibold text-navy-700 hover:underline">
              {t('seeAll')} <span className="nudge-arrow flip-rtl inline-block">→</span>
            </Link>
          </div>
          <div dir="ltr" className="marquee overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
            <ul className="marquee-track flex w-max items-center gap-3 px-4">
              {[...partners, ...partners].map((p, i) => {
                const dup = i >= partners.length
                return p.logoUrl ? (
                  <li key={`${p.id}-${i}`} aria-hidden={dup || undefined} className={`flex h-16 w-36 shrink-0 items-center justify-center p-2 grayscale transition hover:grayscale-0 ${dup ? 'marquee-dup' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={p.logoUrl} alt={dup ? '' : p.name} className="max-h-full max-w-full object-contain" loading="lazy" />
                  </li>
                ) : (
                  <li key={`${p.id}-${i}`} aria-hidden={dup || undefined} className={`shrink-0 whitespace-nowrap rounded-full bg-cream-50 px-5 py-2 text-sm font-semibold text-navy-700 ring-1 ring-navy-100 ${dup ? 'marquee-dup' : ''}`}>
                    {p.name}
                  </li>
                )
              })}
            </ul>
          </div>
        </section>
      )}
    </>
  )
}
