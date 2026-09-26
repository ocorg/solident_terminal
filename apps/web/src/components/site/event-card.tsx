import { getFormatter, getLocale, getTranslations } from 'next-intl/server'
import type { Event } from '@solident/db'
import { Link } from '@/i18n/navigation'
import { localized } from '@/lib/localized'

const typeStyle: Record<string, string> = {
  caravane: 'from-navy-700 to-navy-900',
  scientifique: 'from-[#2c6e8f] to-navy-700',
  solifun: 'from-solifun-sky to-navy-700',
  ambassadeurs: 'from-gold-500 to-[#e0951a]',
  autre: 'from-ink-600 to-navy-900',
}

export async function EventCard({ event, placesLeft }: { event: Event; placesLeft?: number | null }) {
  const t = await getTranslations('Events')
  const format = await getFormatter()
  const locale = await getLocale()
  const day = { day: 'numeric', month: 'long', year: 'numeric' } as const

  return (
    <li className="card card-hover flex flex-col overflow-hidden">
      <Link href={`/evenements/${event.slug}`} className="flex flex-1 flex-col">
        <div className={`relative h-36 bg-gradient-to-br ${typeStyle[event.type]}`}>
          {event.coverUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={event.coverUrl} alt="" className="absolute inset-0 size-full object-cover" loading="lazy" />
          )}
          <span className="absolute start-3 top-3 rounded-full bg-white/90 px-3 py-1 text-xs font-semibold text-navy-900">{t(`types.${event.type}`)}</span>
        </div>
        <div className="flex flex-1 flex-col p-5">
          <p className="text-sm font-semibold text-gold-500">
            {event.endsAt && event.endsAt.toDateString() !== event.startsAt.toDateString()
              ? format.dateTimeRange(event.startsAt, event.endsAt, day)
              : format.dateTime(event.startsAt, { ...day, hour: 'numeric', minute: '2-digit' })}
          </p>
          <h3 className="mt-1 font-heading text-lg font-bold text-navy-900">{localized(event, 'title', locale)}</h3>
          {event.location && <p className="text-sm text-ink-600">{event.location}</p>}
          {event.registrationOpen && placesLeft !== undefined && (
            <p className="mt-auto pt-4 text-sm font-semibold text-success">
              {placesLeft === null ? t('open') : t('placesLeft', { count: placesLeft })}
            </p>
          )}
        </div>
      </Link>
    </li>
  )
}
