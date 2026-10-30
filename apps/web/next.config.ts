import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

// Hibernation (30 Oct 2026): with HIBERNATE=1 at build time, every page redirects to the static
// /veille page. Redirects run in Vercel's routing layer (before the proxy and any function), so a
// sleeping project costs almost nothing. The secret link /veille/entrer?cle=… sets a cookie that
// lets its holder through (the owner). Wake up: remove HIBERNATE in Vercel and redeploy.
const HIBERNATE = process.env.HIBERNATE === '1'
const WAKE_KEY = process.env.HIBERNATE_KEY ?? ''
// Kept reachable while sleeping: the page itself, Next assets, brand files, icons, PWA files.
const SLEEP_EXCEPT = String.raw`veille|_next|_vercel|brand|icons|favicon\.ico|icon\.png|apple-icon\.png|robots\.txt|manifest\.webmanifest|sw\.js|offline\.html`

const nextConfig: NextConfig = {
  // @solident/db ships TypeScript source; let Next compile it.
  transpilePackages: ['@solident/db'],
  async redirects() {
    if (!HIBERNATE) return []
    return [
      {
        source: `/:path((?!${SLEEP_EXCEPT}).*)`,
        // The owner's bypass cookie (hex key, so it is safe inside the regex).
        missing: WAKE_KEY ? [{ type: 'cookie', key: 'solident_wake', value: WAKE_KEY }] : undefined,
        destination: '/veille',
        permanent: false,
      },
    ]
  },
  // Baseline security headers (HSTS is added by Vercel on *.vercel.app).
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
      {
        // Service worker (PWA): always fetch the latest version.
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'no-cache, no-store, must-revalidate' },
          { key: 'Content-Type', value: 'application/javascript; charset=utf-8' },
        ],
      },
    ]
  },
}

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig)
