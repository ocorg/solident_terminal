'use client'

import { useLocale, useTranslations } from 'next-intl'
import { Link, usePathname } from '@/i18n/navigation'
import { routing } from '@/i18n/routing'

const labels: Record<string, { short: string; name: string }> = {
  fr: { short: 'FR', name: 'Français' },
  ar: { short: 'ع', name: 'العربية' },
  en: { short: 'EN', name: 'English' },
}

/** FR / ع / EN — keeps the visitor on the same page in the other language. */
export function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher')
  const locale = useLocale()
  const pathname = usePathname()

  return (
    <nav aria-label={t('label')} className="flex items-center rounded-[10px] border border-navy-100 bg-white/60 p-0.5">
      {routing.locales.map((l) => (
        <Link
          key={l}
          href={pathname}
          locale={l}
          lang={l}
          hrefLang={l}
          aria-label={labels[l].name}
          aria-current={l === locale ? 'true' : undefined}
          className={`min-w-9 rounded-lg px-2 py-1 text-center text-sm font-semibold transition ${
            l === locale ? 'bg-navy-700 text-white' : 'text-navy-700 hover:bg-navy-100'
          }`}
        >
          {labels[l].short}
        </Link>
      ))}
    </nav>
  )
}
