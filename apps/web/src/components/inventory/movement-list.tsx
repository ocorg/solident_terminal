'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { undoMovement } from '@/lib/inventory/actions'
import { formatQty, movementLabel, movementTone, sourceLabel } from '@/lib/inventory/labels'
import type { MovementDTO } from '@/lib/inventory/queries'
import { IconUndo } from '@/components/ui/icons'
import { Btn, Tag, useConfirm } from '@/components/ui'

const when = (iso: string) => new Date(iso).toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })

function who(m: MovementDTO) {
  if (m.type === 'transfert' || (m.from && m.to)) return `${m.from?.name ?? '—'} → ${m.to?.name ?? '—'}`
  return m.to?.name ?? m.from?.name ?? '—'
}

/** Ledger rows (newest first). Logistics can undo a movement (writes its reverse). */
export function MovementList({ rows, canUndo, showItem = true }: { rows: MovementDTO[]; canUndo: boolean; showItem?: boolean }) {
  if (!rows.length) return <p className="py-6 text-center text-sm text-ink-600">Aucun mouvement.</p>
  return (
    <ul className="divide-y divide-navy-100">
      {rows.map((m) => (
        <li key={m.id} className={`flex flex-wrap items-start gap-x-3 gap-y-1 py-3 ${m.reversed || m.reversesId ? 'opacity-70' : ''}`}>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Tag tone={movementTone[m.type]}>{m.reversesId ? `Annulation · ${movementLabel[m.type]}` : movementLabel[m.type]}</Tag>
              {m.source && !m.reversesId && <Tag tone="muted">{sourceLabel[m.source]}</Tag>}
              {m.reversed && <Tag tone="danger">Annulé</Tag>}
              <span className="font-semibold tabular-nums">
                {m.reversesId || m.type === 'consommation' || m.type === 'perte' ? '−' : m.type === 'transfert' ? '' : '+'}
                {formatQty(m.qty, m.isEstimate)} {m.item.unit}
              </span>
              {showItem && <span className="font-medium">{m.item.name}</span>}
            </div>
            <p className="mt-0.5 text-sm text-ink-600">
              {who(m)}
              {m.project && (
                <>
                  {' · '}
                  <Link href={`/espace/projets/${m.project.id}/inventaire`} className="underline decoration-navy-100 underline-offset-2 hover:decoration-navy-700">
                    {m.project.name}
                  </Link>
                </>
              )}
              {m.countId && (
                <>
                  {' · '}
                  <Link href={`/espace/inventaire/comptages/${m.countId}`} className="underline decoration-navy-100 underline-offset-2 hover:decoration-navy-700">
                    inventaire
                  </Link>
                </>
              )}
            </p>
            {m.note && <p className="text-sm text-ink-600">« {m.note} »</p>}
            <p className="text-xs text-ink-600">
              {when(m.createdAt)} · par {m.createdBy}
            </p>
          </div>
          {canUndo && !m.reversed && !m.reversesId && <UndoButton id={m.id} />}
        </li>
      ))}
    </ul>
  )
}

function UndoButton({ id }: { id: string }) {
  const router = useRouter()
  const { ask, dialog } = useConfirm()
  const [busy, setBusy] = useState(false)
  async function undo() {
    const okToGo = await ask({
      title: 'Annuler ce mouvement ?',
      body: 'Un mouvement inverse est enregistré : les quantités reviennent comme avant. Les deux lignes restent visibles dans l’historique.',
      confirm: 'Annuler le mouvement',
      danger: true,
    })
    if (!okToGo) return
    setBusy(true)
    const res = await undoMovement({ id })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Mouvement annulé (mouvement inverse enregistré)')
    router.refresh()
  }
  return (
    <>
      <Btn variant="quiet" size="sm" busy={busy} icon={<IconUndo className="size-4" />} onClick={undo} className="shrink-0">
        Annuler
      </Btn>
      {dialog}
    </>
  )
}
