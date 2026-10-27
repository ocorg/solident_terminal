'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { recordMovement, type MovementInput } from '@/lib/inventory/actions'
import { formatQty, normalizeQty, SOURCES, sourceLabel } from '@/lib/inventory/labels'
import type { BalanceDTO, Person } from '@/lib/inventory/queries'
import { ItemPicker, type PickerItem } from './item-picker'
import { QtyStepper, Sheet, selectClass, useChanged, useSheetDirty } from './ui'

export type MovementKind = 'entree' | 'transfert' | 'sortie'
export type MovementContext = {
  items: PickerItem[]
  balances: BalanceDTO[]
  members: Pick<Person, 'id' | 'name'>[]
  /** Holders shown in the "from" list may include deactivated accounts. */
  holders: Pick<Person, 'id' | 'name'>[]
  me: { id: string; name: string }
  canMoveAny: boolean
  projects: { id: string; name: string }[]
}

const title: Record<MovementKind, string> = { entree: 'Nouvelle entrée (collecte)', transfert: 'Transfert', sortie: 'Consommation ou perte' }

function Choice<T extends string>({ options, value, onChange, label, labelOf }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string; labelOf: (v: T) => string }) {
  return (
    <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`min-h-12 rounded-[8px] border px-2 text-sm font-semibold transition active:scale-[0.98] ${value === o ? 'border-navy-700 bg-navy-700 text-white' : 'border-navy-100 bg-white text-navy-700 hover:bg-navy-100'}`}
        >
          {labelOf(o)}
        </button>
      ))}
    </div>
  )
}

function Label({ children, htmlFor }: { children: React.ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-1 block text-sm font-semibold text-navy-900">
      {children}
    </label>
  )
}

/** Button that opens the movement sheet. */
export function MovementButton({
  kind,
  ctx,
  defaults,
  className = 'btn btn-primary',
  children,
}: {
  kind: MovementKind
  ctx: MovementContext
  defaults?: { itemId?: string; fromHolderId?: string; projectId?: string }
  className?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <button type="button" className={className} onClick={() => setOpen(true)}>
        {children ?? title[kind]}
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={title[kind]}>
        <MovementForm kind={kind} ctx={ctx} defaults={defaults} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  )
}

function MovementForm({ kind, ctx, defaults, onDone }: { kind: MovementKind; ctx: MovementContext; defaults?: { itemId?: string; fromHolderId?: string; projectId?: string }; onDone: () => void }) {
  const router = useRouter()
  const [items, setItems] = useState(ctx.items)
  const [itemId, setItemId] = useState<string | null>(defaults?.itemId ?? null)
  const item = items.find((i) => i.id === itemId)
  const [qty, setQty] = useState(item?.category === 'equipement' ? '1' : '')
  const [source, setSource] = useState<(typeof SOURCES)[number]>('don')
  const [outType, setOutType] = useState<'consommation' | 'perte'>('consommation')
  const [toId, setToId] = useState(kind === 'entree' ? ctx.me.id : '')
  const [fromId, setFromId] = useState(defaults?.fromHolderId ?? ctx.me.id)
  const [projectId, setProjectId] = useState(defaults?.projectId ?? '')
  const [estimate, setEstimate] = useState(false)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  useSheetDirty(useChanged({ itemId, qty, source, outType, toId, fromId, projectId, estimate, note }))

  // Who holds the selected item (for "from" choices and the balance hint).
  const holdersOfItem = useMemo(() => {
    if (!itemId) return []
    return ctx.balances
      .filter((b) => b.itemId === itemId && Number(b.qty) > 0)
      .map((b) => ({ ...b, name: ctx.holders.find((h) => h.id === b.holderId)?.name ?? '—' }))
      .sort((a, b) => a.name.localeCompare(b.name, 'fr'))
  }, [ctx.balances, ctx.holders, itemId])
  const fromBalance = holdersOfItem.find((h) => h.holderId === fromId)?.qty ?? '0'
  const qtyOk = normalizeQty(qty) !== null && Number(normalizeQty(qty)) > 0
  const tooMuch = kind !== 'entree' && qtyOk && Number(normalizeQty(qty)) > Number(fromBalance)

  function pickItem(id: string | null) {
    setItemId(id)
    const it = items.find((i) => i.id === id)
    if (it?.category === 'equipement') setQty('1')
    // Logistics: preselect the only holder of an equipment item.
    if (id && kind !== 'entree' && ctx.canMoveAny) {
      const hs = ctx.balances.filter((b) => b.itemId === id && Number(b.qty) > 0)
      if (hs.length === 1) setFromId(hs[0]!.holderId)
    }
  }

  async function submit() {
    if (!itemId || !qtyOk) return
    setBusy(true)
    const common = { itemId, qty, projectId: projectId || null, note, isEstimate: estimate }
    const input: MovementInput =
      kind === 'entree'
        ? { ...common, type: 'entree', toHolderId: toId, source }
        : kind === 'transfert'
          ? { ...common, type: 'transfert', fromHolderId: fromId, toHolderId: toId }
          : { ...common, type: outType, fromHolderId: fromId }
    const res = await recordMovement(input)
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(kind === 'entree' ? 'Collecte enregistrée' : kind === 'transfert' ? 'Transfert enregistré' : 'Sortie enregistrée')
    router.refresh()
    onDone()
  }

  const canChooseFrom = ctx.canMoveAny
  const fromOptions = canChooseFrom ? holdersOfItem : holdersOfItem.filter((h) => h.holderId === ctx.me.id)

  return (
    <div className="space-y-5">
      <div>
        <Label>Article</Label>
        <ItemPicker
          items={kind === 'entree' ? items : items.filter((i) => ctx.balances.some((b) => b.itemId === i.id && Number(b.qty) > 0 && (canChooseFrom || b.holderId === ctx.me.id)))}
          value={itemId}
          onChange={pickItem}
          allowCreate={kind === 'entree'}
          onCreated={(it) => setItems((list) => [...list, it])}
        />
      </div>

      {kind !== 'entree' && itemId && (
        <div>
          <Label htmlFor="mv-from">Détenu par</Label>
          {fromOptions.length ? (
            <select id="mv-from" value={fromId} onChange={(e) => setFromId(e.target.value)} className={selectClass} disabled={!canChooseFrom}>
              {!fromOptions.some((h) => h.holderId === fromId) && <option value="">Choisir…</option>}
              {fromOptions.map((h) => (
                <option key={h.holderId} value={h.holderId}>
                  {h.name} ({formatQty(h.qty)} {item?.unit})
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-[8px] border-s-4 border-danger bg-danger/10 px-3 py-2 text-sm text-danger">Vous ne détenez pas cet article.</p>
          )}
        </div>
      )}

      {kind === 'sortie' && (
        <div>
          <Label>Type</Label>
          <Choice options={['consommation', 'perte'] as const} value={outType} onChange={setOutType} label="Type de sortie" labelOf={(v) => (v === 'consommation' ? 'Consommé' : 'Perdu / cassé')} />
        </div>
      )}

      <div>
        <Label htmlFor="mv-qty">
          Quantité{item && <span className="font-normal text-ink-600"> ({item.unit})</span>}
        </Label>
        <QtyStepper id="mv-qty" value={qty} onChange={setQty} label="Quantité" />
        {kind !== 'entree' && itemId && (
          <p className={`mt-1 text-sm ${tooMuch ? 'font-semibold text-danger' : 'text-ink-600'}`}>
            Disponible : {formatQty(fromBalance)} {item?.unit}
          </p>
        )}
        <label className="mt-2 flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} className="size-5 accent-navy-700" />
          Quantité estimée (affichée avec ≈)
        </label>
      </div>

      {kind === 'entree' && (
        <div>
          <Label>Provenance</Label>
          <Choice options={SOURCES} value={source} onChange={setSource} label="Provenance" labelOf={(s) => sourceLabel[s]} />
        </div>
      )}

      {(kind === 'transfert' || (kind === 'entree' && ctx.canMoveAny)) && (
        <div>
          <Label htmlFor="mv-to">{kind === 'transfert' ? 'Donner à' : 'Détenu par'}</Label>
          <select id="mv-to" value={toId} onChange={(e) => setToId(e.target.value)} className={selectClass}>
            <option value="">Choisir un membre…</option>
            {ctx.members
              .filter((m) => kind === 'entree' || m.id !== fromId)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                  {m.id === ctx.me.id ? ' (moi)' : ''}
                </option>
              ))}
          </select>
        </div>
      )}

      <div>
        <Label htmlFor="mv-project">Projet / activité</Label>
        <select id="mv-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectClass}>
          <option value="">Aucun (stock général)</option>
          {ctx.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      <div>
        <Label htmlFor="mv-note">Note (facultatif)</Label>
        <input id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={kind === 'entree' ? 'Ex. don du cabinet Dr X' : ''} className={`${inputClass} h-12`} />
      </div>

      <div className="sticky bottom-0 -mx-5 border-t border-navy-100 bg-white px-5 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3">
        <button
          type="button"
          onClick={submit}
          disabled={busy || !itemId || !qtyOk || tooMuch || (kind !== 'sortie' && !toId) || (kind !== 'entree' && !fromId)}
          className="btn btn-primary min-h-12 w-full disabled:opacity-60"
        >
          {busy && <Spinner />} Enregistrer
        </button>
      </div>
    </div>
  )
}
