// Public origin of the running site. BETTER_AUTH_URL is set for localhost and Production;
// Vercel previews fall back to their own deployment URL (VERCEL_URL is injected by Vercel).
const https = (host?: string) => (host ? `https://${host}` : undefined)

export function siteUrl() {
  return process.env.BETTER_AUTH_URL ?? https(process.env.VERCEL_URL) ?? 'http://localhost:3001'
}

/** This project's own Vercel addresses (deployment, branch and production URLs) — never other *.vercel.app sites. */
export function vercelOrigins() {
  const { VERCEL_URL, VERCEL_BRANCH_URL, VERCEL_PROJECT_PRODUCTION_URL } = process.env
  return [VERCEL_URL, VERCEL_BRANCH_URL, VERCEL_PROJECT_PRODUCTION_URL].map(https).filter((o): o is string => Boolean(o))
}
