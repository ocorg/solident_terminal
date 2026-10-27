'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { CATEGORIES, categoryLabel, categoryPlural, formatQty } from '@/lib/inventory/labels'
import type { ItemDTO, MovementDTO } from '@/lib/inventory/queries'
import { getItemHistory } from '@/lib/inventory/read-actions'
import { MovementButton, type MovementContext } from './movement-form'
import { MovementList } from './movement-list'
import { ItemThumb, selectClass, Sheet, Tag } from '@/components/ui'

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Items (rows) × holders (columns) with totals, filters, low-stock flag; click → item drawer. */
export function StockView({ items, ctx, canUndo }: { items: ItemDTO[]; ctx: MovementContext; canUndo: boolean }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<string>('')
  const [sub, setSub] = useState('')
  const [onlyLow, setOnlyLow] = useState(false)
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()
  const openId = params.get('article')
  const setOpenId = (id: string | null) => {
    const p = new URLSearchParams(params)
    if (id) p.set('article', id)
    else p.delete('article')
    router.replace(`${pathname}?${p}`, { scroll: false })
  }

  const subs = useMemo(() => [...new Set(items.filter((i) => !cat || i.category === cat).map((i) => i.subcategory).filter(Boolean) as string[])].sort(), [items, cat])
  const shown = items.filter(
    (i) => (!cat || i.category === cat) && (!sub || i.subcategory === sub) && (!onlyLow || i.low) && (!q || fold(`${i.name} ${i.subcategory ?? ''}`).includes(fold(q))),
  )
  const qtyOf = useMemo(() => new Map(ctx.balances.map((b) => [`${b.itemId}:${b.holderId}`, b.qty])), [ctx.balances])
  // Columns: only people who hold at least one of the shown items.
  const columns = ctx.holders.filter((h) => shown.some((i) => qtyOf.has(`${i.id}:${h.id}`)))
  const lowCount = items.filter((i) => i.low).length
  const openItem = items.find((i) => i.id === openId)

  return (
    <div className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto_auto]">
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className={`${inputClass} h-11 py-0`} aria-label="Rechercher un article" />
        <select
          value={cat}
          onChange={(e) => {
            setCat(e.target.value)
            setSub('')
          }}
          className={`${selectClass} h-11`}
          aria-label="Catégorie"
        >
          <option value="">Toutes catégories</option>
          {CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {categoryPlural[c]}
            </option>
          ))}
        </select>
        <select value={sub} onChange={(e) => setSub(e.target.value)} className={`${selectClass} h-11`} aria-label="Sous-catégorie">
          <option value="">Toutes sous-catégories</option>
          {subs.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <label className="flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border border-navy-100 bg-white px-3 text-sm">
          <input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} className="size-4 accent-navy-700" />
          Stock bas ({lowCount})
        </label>
      </div>

      {!shown.length ? (
        <p className="card p-8 text-center text-ink-600">{items.length ? 'Aucun article ne correspond aux filtres.' : 'Le catalogue est vide. Commencez par une « Nouvelle entrée ».'}</p>
      ) : (
        <>
        <ul className="card divide-y divide-navy-100 p-0 sm:hidden">
          {shown.map((i) => {
            const held = columns.map((h) => ({ h, v: qtyOf.get(`${i.id}:${h.id}`) })).filter((x) => x.v)
            return (
              <li key={i.id} className={i.low ? 'shadow-[inset_4px_0_0_var(--color-danger)]' : ''}>
                <button type="button" onClick={() => setOpenId(i.id)} className="flex w-full items-start gap-3 px-3 py-3 text-start transition active:bg-navy-100/60">
                  <ItemThumb url={i.photoUrl} name={i.name} category={i.category} size={40} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-start justify-between gap-2">
                      <span className="font-semibold leading-tight text-navy-900">{i.name}</span>
                      <span className="shrink-0 whitespace-nowrap tabular-nums">
                        <span className="font-bold">{formatQty(i.total, i.estimate)}</span> <span className="text-xs text-ink-600">{i.unit}</span>
                      </span>
                    </span>
                    <span className="mt-0.5 block text-xs text-ink-600">
                      {i.low && (
                        <Tag tone="danger" className="me-1">
                          Bas
                        </Tag>
                      )}
                      {held.length ? held.map(({ h, v }) => `${h.name.split(' ')[0]} ${formatQty(v!)}`).join(' · ') : 'Personne ne le détient'}
                    </span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
        <div className="card hidden overflow-x-auto p-0 sm:block">
          <table className="w-full min-w-[560px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-navy-100 bg-cream-50 text-start text-xs uppercase tracking-wide text-ink-600">
                <th scope="col" className="sticky start-0 z-10 bg-cream-50 px-3 py-2 text-start font-semibold">
                  Article
                </th>
                <th scope="col" className="px-3 py-2 text-end font-semibold">
                  Total
                </th>
                {columns.map((h) => (
                  <th key={h.id} scope="col" className="max-w-28 truncate px-3 py-2 text-end font-semibold" title={h.name}>
                    {h.name.split(' ')[0]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {shown.map((i) => (
                <tr
                  key={i.id}
                  onClick={() => setOpenId(i.id)}
                  className={`cursor-pointer border-b border-navy-100 transition last:border-0 hover:bg-navy-100/40 ${i.low ? 'shadow-[inset_4px_0_0_var(--color-danger)]' : ''}`}
                >
                  <th scope="row" className="sticky start-0 bg-white px-3 py-2 text-start font-normal">
                    <button type="button" className="flex items-center gap-3 text-start" onClick={() => setOpenId(i.id)}>
                      <ItemThumb url={i.photoUrl} name={i.name} category={i.category} size={36} />
                      <span className="min-w-0">
                        <span className="block font-semibold text-navy-900">{i.name}</span>
                        <span className="block text-xs text-ink-600">
                          {categoryLabel[i.category]}
                          {i.subcategory && ` · ${i.subcategory}`}
                          {i.isDemo && ' · démo'}
                        </span>
                      </span>
                    </button>
                  </th>
                  <td className="whitespace-nowrap px-3 py-2 text-end tabular-nums">
                    <span className="font-bold">{formatQty(i.total, i.estimate)}</span> <span className="text-xs text-ink-600">{i.unit}</span>
                    {i.low && (
                      <Tag tone="danger" className="ms-2">
                        Bas
                      </Tag>
                    )}
                  </td>
                  {columns.map((h) => {
                    const v = qtyOf.get(`${i.id}:${h.id}`)
                    return (
                      <td key={h.id} className="px-3 py-2 text-end tabular-nums text-ink-600">
                        {v ? formatQty(v) : <span className="opacity-30">·</span>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </>
      )}

      <Sheet
        open={!!openItem}
        onClose={() => setOpenId(null)}
        title={openItem?.name ?? 'Article'}
        subtitle={openItem ? `${categoryLabel[openItem.category]}${openItem.subcategory ? ` · ${openItem.subcategory}` : ''}` : undefined}
        icon={openItem ? <ItemThumb url={openItem.photoUrl} name={openItem.name} category={openItem.category} size={40} /> : undefined}
      >
        {openItem && <ItemDetail item={openItem} ctx={ctx} canUndo={canUndo} />}
      </Sheet>
    </div>
  )
}

function ItemDetail({ item, ctx, canUndo }: { item: ItemDTO; ctx: MovementContext; canUndo: boolean }) {
  const [history, setHistory] = useState<{ rows: MovementDTO[]; total: number } | null>(null)
  const balances = ctx.balances
    .filter((b) => b.itemId === item.id)
    .map((b) => ({ ...b, name: ctx.holders.find((h) => h.id === b.holderId)?.name ?? '—' }))
    .sort((a, b) => Number(b.qty) - Number(a.qty))

  const total = item.total
  useEffect(() => {
    let alive = true
    getItemHistory({ itemId: item.id }).then((res) => {
      if (!alive) return
      if (res.status === 'error') toast.error(res.message)
      else setHistory(res.data)
    })
    return () => {
      alive = false
    }
    // Reload when the item's stock changes (after a movement from this drawer).
  }, [item.id, total])

  const iHold = balances.some((b) => b.holderId === ctx.me.id)
  return (
    <div className="space-y-5">
      {item.photoUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- R2 image
        <img src={item.photoUrl} alt={`Photo : ${item.name}`} className="aspect-[4/3] w-full rounded-[12px] bg-cream-100 object-cover" />
      )}
      <div className="grid grid-cols-2 gap-2">
        <div className={`rounded-[12px] border-s-4 bg-white p-3 shadow-card ${item.low ? 'border-danger' : 'border-navy-700'}`}>
          <p className="text-xs font-semibold text-ink-600">En stock</p>
          <p className="font-heading text-2xl font-bold text-navy-900">
            {formatQty(item.total, item.estimate)} <span className="text-sm font-semibold text-ink-600">{item.unit}</span>
          </p>
          {item.low && <Tag tone="danger">Stock bas</Tag>}
        </div>
        <div className="rounded-[12px] border-s-4 border-navy-100 bg-white p-3 shadow-card">
          <p className="text-xs font-semibold text-ink-600">Alerte sous</p>
          <p className="font-heading text-2xl font-bold text-navy-900">
            {item.minQty ? formatQty(item.minQty) : '—'} {item.minQty && <span className="text-sm font-semibold text-ink-600">{item.unit}</span>}
          </p>
        </div>
      </div>
      {item.notes && <p className="whitespace-pre-wrap text-sm text-ink-600">{item.notes}</p>}

      <section>
        <h3 className="mb-2 font-heading font-bold">Qui le détient</h3>
        {balances.length ? (
          <ul className="divide-y divide-navy-100 rounded-[10px] border border-navy-100">
            {balances.map((b) => (
              <li key={b.holderId} className="flex items-center justify-between px-3 py-2 text-sm">
                <span>
                  {b.name}
                  {b.holderId === ctx.me.id && ' (moi)'}
                </span>
                <span className="font-semibold tabular-nums">
                  {formatQty(b.qty)} {item.unit}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-ink-600">Personne ne détient cet article.</p>
        )}
      </section>

      <div className={`grid gap-2 ${(iHold || ctx.canMoveAny) && balances.length > 0 ? 'grid-cols-3' : 'grid-cols-1'}`}>
        <MovementButton kind="entree" ctx={ctx} defaults={{ itemId: item.id }} className="!min-h-16 flex-col !gap-1 !px-2 !text-xs">
          Entrée
        </MovementButton>
        {(iHold || ctx.canMoveAny) && balances.length > 0 && (
          <>
            <MovementButton kind="transfert" ctx={ctx} defaults={{ itemId: item.id }} className="!min-h-16 flex-col !gap-1 !px-2 !text-xs">
              Transférer
            </MovementButton>
            <MovementButton kind="sortie" ctx={ctx} defaults={{ itemId: item.id }} className="!min-h-16 flex-col !gap-1 !px-2 !text-xs">
              Sortie
            </MovementButton>
          </>
        )}
      </div>

      <section>
        <h3 className="mb-1 font-heading font-bold">Historique</h3>
        {history ? (
          <>
            <MovementList rows={history.rows} canUndo={canUndo} showItem={false} />
            {history.total > history.rows.length && (
              <a href={`/espace/inventaire?onglet=historique&article=${item.id}`} className="text-sm font-semibold text-navy-700 underline">
                Voir les {history.total} mouvements
              </a>
            )}
          </>
        ) : (
          <p className="flex items-center gap-2 py-4 text-sm text-ink-600">
            <Spinner /> Chargement…
          </p>
        )}
      </section>
    </div>
  )
}
