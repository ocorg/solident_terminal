import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BilanView } from '@/components/inventory/bilan-view'
import { CountSheet } from '@/components/inventory/count-sheet'
import { loadCount, loadInventory } from '@/lib/inventory/queries'
import { inventoryRights } from '@/lib/inventory/rights'
import { requireMemberPage } from '@/lib/space'

export const metadata: Metadata = { title: 'Inventaire' }

export default async function CountPage({ params }: PageProps<'/espace/inventaire/comptages/[id]'>) {
  const user = await requireMemberPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const count = await loadCount(id)
  if (!count) notFound()

  const back = count.project ? { href: `/espace/projets/${count.project.id}/inventaire`, label: count.project.name } : { href: '/espace/inventaire?onglet=inventaires', label: 'Inventaires' }

  if (count.status === 'valide')
    return (
      <div className="space-y-4">
        <Link href={back.href} className="text-sm font-semibold text-navy-700 hover:underline print:hidden">
          ← {back.label}
        </Link>
        <BilanView count={count} />
      </div>
    )

  const [rights, inv] = await Promise.all([inventoryRights(user, count.project?.id ?? null), loadInventory()])
  return (
    <div className="space-y-4">
      <Link href={back.href} className="text-sm font-semibold text-navy-700 hover:underline">
        ← {back.label}
      </Link>
      <div>
        <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">{count.project ? 'Bilan de projet' : 'Inventaire général'}</p>
        <h1 className="font-heading text-2xl font-bold text-navy-900 sm:text-3xl">
          {count.project ? count.project.name : 'Comptage du stock'}
          <span className="brand-dot" aria-hidden />
        </h1>
        <p className="text-sm text-ink-600">
          Ouvert par {count.createdBy}. Comptez ce que chaque membre détient réellement ; les saisies sont enregistrées automatiquement, même sans réseau.
        </p>
      </div>
      <CountSheet
        count={count}
        me={{ id: user.id }}
        canValidate={rights.canManageProject}
        canRemoveLines={rights.canManageProject || count.createdById === user.id}
        items={inv.items}
        members={inv.members}
      />
    </div>
  )
}
