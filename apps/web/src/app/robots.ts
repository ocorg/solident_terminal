import type { MetadataRoute } from 'next'
import { siteUrl } from '@/lib/site-url'

export default function robots(): MetadataRoute.Robots {
  // Preview deployments must never be indexed; only production is.
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    return { rules: { userAgent: '*', disallow: '/' } }
  }
  return {
    rules: { userAgent: '*', allow: '/', disallow: ['/admin', '/api', '/connexion', '/inscription', '/mot-de-passe', '/mot-de-passe-oublie', '/acces-refuse'] },
    sitemap: `${siteUrl()}/sitemap.xml`,
  }
}
