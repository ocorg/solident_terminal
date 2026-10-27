'use client'

import { formatQty } from '@/lib/inventory/labels'
import type { ItemDTO } from '@/lib/inventory/queries'
import { MovementButton, type MovementContext } from './movement-form'
import { ItemThumb, Tag } from '@/components/ui'

/** Big equipment: who holds each one right now, with a one-tap transfer. */
export function EquipmentView({ items, ctx }: { items: ItemDTO[]; ctx: MovementContext }) {
  const equipment = items.filter((i) => i.category === 'equipement')
  if (!equipment.length) return <p className="card p-8 text-center text-ink-600">Aucun équipement dans le catalogue.</p>
  return (
    <ul className="grid gap-3 sm:grid-cols-2">
      {equipment.map((i) => {
        const holders = ctx.balances
          .filter((b) => b.itemId === i.id && Number(b.qty) > 0)
          .map((b) => ({ ...b, name: ctx.holders.find((h) => h.id === b.holderId)?.name ?? '—' }))
        return (
          <li key={i.id} className={`card space-y-3 border-s-4 p-4 ${holders.length ? 'border-navy-700' : 'border-danger'}`}>
            <div className="flex items-center gap-3">
              <ItemThumb url={i.photoUrl} name={i.name} category={i.category} size={48} />
              <div className="min-w-0 flex-1">
                <p className="font-heading font-bold text-navy-900">{i.name}</p>
                <p className="text-xs text-ink-600">
                  {i.subcategory ?? 'Équipement'} · {formatQty(i.total)} au total
                </p>
              </div>
              {!holders.length && <Tag tone="danger">Non attribué</Tag>}
            </div>
            {holders.map((h) => (
              <div key={h.holderId} className="flex items-center justify-between gap-2 rounded-[10px] bg-cream-50 px-3 py-2">
                <span className="min-w-0 truncate text-sm">
                  <span className="text-ink-600">Chez </span>
                  <span className="font-semibold">
                    {h.name}
                    {h.holderId === ctx.me.id && ' (moi)'}
                  </span>
                  {Number(h.qty) !== 1 && <span className="text-ink-600"> × {formatQty(h.qty)}</span>}
                </span>
                {(h.holderId === ctx.me.id || ctx.canMoveAny) && (
                  <MovementButton kind="transfert" ctx={ctx} defaults={{ itemId: i.id, fromHolderId: h.holderId }} variant="primary" className="shrink-0">
                    Transférer
                  </MovementButton>
                )}
              </div>
            ))}
          </li>
        )
      })}
    </ul>
  )
}
