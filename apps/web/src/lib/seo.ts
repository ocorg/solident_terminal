import { routing } from '@/i18n/routing'
import { org } from './org'
import { siteUrl } from './site-url'

/**
 * Canonical URL + the same page in the other languages (hreflang), for one public path ('' = home).
 * Each page must declare its own: without it, sub-pages pointed to the home pages as their translations.
 */
export function alternatesFor(locale: string, path: string) {
  return {
    canonical: `/${locale}${path}`,
    languages: {
      ...Object.fromEntries(routing.locales.map((l) => [l, `/${l}${path}`])),
      'x-default': `/${routing.defaultLocale}${path}`,
    },
  }
}

/** schema.org description of the association (Google knowledge panel, rich results). */
export function ngoJsonLd(locale: string, description: string) {
  const base = siteUrl()
  return {
    '@context': 'https://schema.org',
    '@type': 'NGO',
    '@id': `${base}/#organization`,
    name: 'Association Solident',
    alternateName: [org.nameFr, org.nameAr],
    url: `${base}/${locale}`,
    logo: `${base}/icons/icon-512.png`,
    email: org.email,
    description,
    foundingDate: '2024',
    areaServed: { '@type': 'Country', name: 'Morocco' },
    address: { '@type': 'PostalAddress', addressLocality: 'Larache', addressRegion: 'Tanger-Tétouan-Al Hoceïma', addressCountry: 'MA' },
    knowsAbout: ['Santé bucco-dentaire', 'Caravanes dentaires', 'Prévention dentaire'],
    sameAs: org.socials.map((s) => s.href),
  }
}

/** Serialises JSON-LD safely inside a <script> tag. */
export const jsonLd = (data: unknown) => ({ __html: JSON.stringify(data).replace(/</g, '\\u003c') })
