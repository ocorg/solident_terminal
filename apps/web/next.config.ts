import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // @solident/db ships TypeScript source; let Next compile it.
  transpilePackages: ['@solident/db'],
}

export default nextConfig
