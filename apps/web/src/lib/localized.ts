import type { Locale } from '@/i18n/routing'

const suffix = { fr: 'Fr', ar: 'Ar', en: 'En' } as const

/**
 * Reads a translated DB column (titleFr / titleAr / titleEn) for the current locale,
 * falling back to French when the translation is empty (spec §7).
 */
export function localized<T extends object>(row: T, field: string, locale: Locale | string): string {
  const r = row as Record<string, unknown>
  const own = r[`${field}${suffix[locale as Locale] ?? 'Fr'}`]
  return (typeof own === 'string' && own.trim() ? own : (r[`${field}Fr`] as string | null)) ?? ''
}
