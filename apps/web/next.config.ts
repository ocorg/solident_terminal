import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const nextConfig: NextConfig = {
  // @solident/db ships TypeScript source; let Next compile it.
  transpilePackages: ['@solident/db'],
}

export default createNextIntlPlugin('./src/i18n/request.ts')(nextConfig)
