import type { MetadataRoute } from 'next'
import { prisma } from '@solident/db'
import { routing } from '@/i18n/routing'
import { siteUrl } from '@/lib/site-url'

// Rebuilt hourly: new events/actions appear without a redeploy.
export const revalidate = 3600

const STATIC = ['', '/qui-sommes-nous', '/programmes', '/actions', '/evenements', '/solifun', '/partenaires', '/contact', '/soutenir/don', '/soutenir/sponsoring', '/soutenir/benevolat']

/** Every public page in fr/ar/en, with hreflang alternates so Google serves the right language. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl()
  const [events, actions, programmes] = await Promise.all([
    prisma.event.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    prisma.action.findMany({ where: { isPublished: true }, select: { slug: true, updatedAt: true } }),
    prisma.programme.findMany({ where: { isActive: true }, select: { slug: true, updatedAt: true } }),
  ])
  const paths: { path: string; lastModified?: Date; priority: number }[] = [
    ...STATIC.map((path) => ({ path, priority: path === '' || path === '/soutenir/don' ? 1 : 0.7 })),
    ...events.map((e) => ({ path: `/evenements/${e.slug}`, lastModified: e.updatedAt, priority: 0.6 })),
    ...actions.map((a) => ({ path: `/actions/${a.slug}`, lastModified: a.updatedAt, priority: 0.5 })),
    ...programmes.map((p) => ({ path: `/programmes/${p.slug}`, lastModified: p.updatedAt, priority: 0.6 })),
  ]
  return paths.flatMap(({ path, lastModified, priority }) =>
    routing.locales.map((locale) => ({
      url: `${base}/${locale}${path}`,
      lastModified,
      priority,
      alternates: { languages: Object.fromEntries(routing.locales.map((l) => [l, `${base}/${l}${path}`])) },
    })),
  )
}
