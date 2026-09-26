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

/** Same for JSON list columns (e.g. sponsor_tiers.benefits_*): the locale's list, else the French one. */
export function localizedList<T extends object>(row: T, field: string, locale: Locale | string): string[] {
  const r = row as Record<string, unknown>
  const pick = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [])
  const own = pick(r[`${field}${suffix[locale as Locale] ?? 'Fr'}`])
  return own.length ? own : pick(r[`${field}Fr`])
}
