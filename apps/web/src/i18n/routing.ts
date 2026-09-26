import { defineRouting } from 'next-intl/routing'

// docs/SPEC.md §3–4: /fr /ar /en, French by default; slugs stay French in every language.
export const routing = defineRouting({
  locales: ['fr', 'ar', 'en'],
  defaultLocale: 'fr',
  localePrefix: 'always',
})

export type Locale = (typeof routing.locales)[number]

export const localeDir = (locale: string) => (locale === 'ar' ? 'rtl' : 'ltr')
