import { getTranslations } from 'next-intl/server'
import type { sponsorWall } from '@/lib/donations'

type Wall = Awaited<ReturnType<typeof sponsorWall>>
type P = Wall['supporters'][number]

/** Companies grouped by earned tier (see lib/donations sponsorWall). Renders nothing when empty. */
export async function SponsorWall({ wall }: { wall: Wall }) {
  const t = await getTranslations('Donate')
  if (wall.tiers.length === 0 && wall.supporters.length === 0) return null
  return (
    <div className="space-y-6">
      {wall.tiers.map(({ tier, partners }) => (
        <div key={tier.id}>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-gold-700">{tier.name}</p>
          <Grid partners={partners} />
        </div>
      ))}
      {wall.supporters.length > 0 && (
        <div>
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-ink-600">{t('supporters')}</p>
          <Grid partners={wall.supporters} />
        </div>
      )}
    </div>
  )
}

function Grid({ partners }: { partners: P[] }) {
  return (
    <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
      {partners.map((p) => (
        <li key={p.id} className="card card-hover flex h-24 items-center justify-center p-4">
          {p.website ? (
            <a href={p.website} target="_blank" rel="noreferrer">
              <Logo p={p} />
            </a>
          ) : (
            <Logo p={p} />
          )}
        </li>
      ))}
    </ul>
  )
}

/** Logo if uploaded, otherwise the name as a placeholder (real logos come later via /admin). */
function Logo({ p }: { p: P }) {
  // eslint-disable-next-line @next/next/no-img-element
  if (p.logoUrl) return <img src={p.logoUrl} alt={p.name} className="max-h-16 w-auto object-contain" />
  return <span className="text-center font-heading font-bold text-navy-700">{p.name}</span>
}
