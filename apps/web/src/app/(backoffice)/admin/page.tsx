import Link from 'next/link'
import { prisma } from '@solident/db'
import { BrushRing } from '@/components/motion/brush-ring'
import { CountUp } from '@/components/motion/count-up'
import { getFundraising } from '@/lib/fundraising'
import { requireRolePage, STAFF_ROLES } from '@/lib/guards'

const dh = (n: number) => new Intl.NumberFormat('fr-MA').format(n) + ' DH'

type Tile = { href: string; label: string; value: number; hint: string }

// Each role sees its own work queue first; numbers count up, bars grow in (both off with "reduce motion").
export default async function AdminHome() {
  const { user, role } = await requireRolePage(...STAFF_ROLES)
  const is = (...r: string[]) => r.includes(role)
  const money = is('admin', 'treasurer')

  const [campaigns, pendingDonations, pendingUsers, newMessages, newRegistrations, newVolunteers, actionsNoPhoto, fundraising] = await Promise.all([
    prisma.campaign.findMany({ where: { isActive: true }, orderBy: { startsOn: 'asc' } }),
    money ? prisma.donation.aggregate({ where: { status: 'pending' }, _count: true, _sum: { amountDh: true } }) : null,
    is('admin') ? prisma.user.count({ where: { isActive: false } }) : 0,
    is('admin') ? prisma.inquiry.count({ where: { status: 'new' } }) : 0,
    is('admin', 'hr') ? prisma.registration.count({ where: { status: 'new' } }) : 0,
    is('admin', 'hr') ? prisma.volunteerApplication.count({ where: { status: 'new' } }) : 0,
    is('admin', 'media') ? prisma.action.count({ where: { isPublished: true, coverUrl: null } }) : 0,
    getFundraising(),
  ])

  const tiles: Tile[] = [
    ...(pendingDonations ? [{ href: '/admin/dons', label: 'Dons à vérifier', value: pendingDonations._count, hint: `${dh(pendingDonations._sum.amountDh ?? 0)} déclarés` }] : []),
    ...(is('admin') ? [{ href: '/admin/utilisateurs', label: 'Comptes en attente', value: pendingUsers, hint: 'à valider ou refuser' }] : []),
    ...(is('admin') ? [{ href: '/admin/messages', label: 'Nouveaux messages', value: newMessages, hint: 'contact et sponsoring' }] : []),
    ...(is('admin', 'hr') ? [{ href: '/admin/inscriptions', label: 'Nouvelles inscriptions', value: newRegistrations, hint: 'aux événements' }] : []),
    ...(is('admin', 'hr') ? [{ href: '/admin/benevoles', label: 'Candidatures bénévoles', value: newVolunteers, hint: 'à contacter' }] : []),
    ...(is('admin', 'media') ? [{ href: '/admin/contenu', label: 'Actions sans photo', value: actionsNoPhoto, hint: 'ajoutez une photo de couverture' }] : []),
  ]
  const todo = tiles.reduce((n, t) => n + t.value, 0)
  const hour = Number(new Date().toLocaleString('en-GB', { hour: '2-digit', hour12: false, timeZone: 'Africa/Casablanca' }))
  const greeting = hour < 5 || hour >= 18 ? 'Bonsoir' : hour < 12 ? 'Bonjour' : 'Bon après-midi'

  return (
    <div className="space-y-8">
      <div className="relative overflow-hidden rounded-2xl bg-navy-900 p-6 text-white sm:p-8">
        <BrushRing className="pointer-events-none absolute -end-20 -top-24 size-72 opacity-20" strokeWidth={10} />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div>
            <h1 className="font-heading text-3xl font-bold">
              {greeting} {user.name.split(' ')[0]}
              <span className="brand-dot" aria-hidden />
            </h1>
            <p className="mt-2 text-white/80">{todo === 0 ? 'Tout est à jour. Rien n’attend votre action.' : `${todo} élément${todo > 1 ? 's' : ''} attend${todo > 1 ? 'ent' : ''} votre action.`}</p>
          </div>
          {money && (
            <Link href="/admin/campagnes" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold transition hover:bg-white/20">
              <span className={`size-2.5 rounded-full ${fundraising.open ? 'live-dot bg-gold-500' : 'bg-white/50'}`} aria-hidden />
              Collecte publique : {fundraising.open ? 'ouverte' : 'fermée'}
            </Link>
          )}
        </div>
      </div>

      {tiles.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tiles.map((t) => (
            <li key={t.href} data-reveal>
              <Link href={t.href} className={`card card-hover nudge flex h-full flex-col p-5 ${t.value > 0 ? 'border-s-4 border-gold-500' : ''}`}>
                <span className="text-sm text-ink-600">{t.label}</span>
                <CountUp value={t.value} className="font-heading text-4xl font-bold text-navy-700" />
                <span className="mt-auto flex items-center justify-between gap-2 pt-2 text-sm text-ink-600">
                  {t.hint} <span className="nudge-arrow text-navy-700" aria-hidden>→</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-navy-700">Campagnes actives</h2>
        {campaigns.length === 0 && <p className="card p-5 text-ink-600">Aucune campagne active.</p>}
        {campaigns.map((c) => {
          const pct = c.goalDh ? Math.min(100, Math.round((c.raisedDh / c.goalDh) * 100)) : 0
          return (
            <div key={c.id} className="card p-5" data-reveal>
              <div className="mb-3 flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{c.titleFr}</p>
                <p className="text-sm text-ink-600">
                  {dh(c.raisedDh)} / {dh(c.goalDh)} · {c.donorsCount} dons · <strong className="text-navy-700">{pct} %</strong>
                </p>
              </div>
              <div className="h-3 overflow-hidden rounded-full bg-navy-100" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={`${c.titleFr} : ${pct} % de l’objectif`}>
                <div className="grow-x h-full rounded-full bg-gold-500" style={{ width: `${pct}%` }} />
              </div>
            </div>
          )
        })}
      </section>
    </div>
  )
}
