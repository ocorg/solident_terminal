'use client'

import { useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { recordMovement, type MovementInput } from '@/lib/inventory/actions'
import { formatQty, normalizeQty, SOURCES, sourceLabel } from '@/lib/inventory/labels'
import type { BalanceDTO, Person } from '@/lib/inventory/queries'
import { IconEntry, IconOut, IconTransfer } from '@/components/ui/icons'
import { ItemPicker, type PickerItem } from './item-picker'
import { ActionBar, Btn, Choice, FormSection, QtyStepper, Sheet, SheetFooter, selectClass, useChanged, useSheetClose, useSheetDirty, type BtnVariant } from '@/components/ui'

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

const meta: Record<MovementKind, { title: string; subtitle: string; icon: React.ReactNode; submit: string; done: string }> = {
  entree: { title: 'Nouvelle entrée', subtitle: 'Matériel collecté : don, achat ou emprunt.', icon: <IconEntry />, submit: 'Enregistrer l’entrée', done: 'Collecte enregistrée' },
  transfert: { title: 'Transfert', subtitle: 'Le matériel change de mains entre deux membres.', icon: <IconTransfer />, submit: 'Enregistrer le transfert', done: 'Transfert enregistré' },
  sortie: { title: 'Consommation ou perte', subtitle: 'Du matériel utilisé, perdu ou cassé.', icon: <IconOut />, submit: 'Enregistrer la sortie', done: 'Sortie enregistrée' },
}
export const movementIcon = (kind: MovementKind, className?: string) =>
  kind === 'entree' ? <IconEntry className={className} /> : kind === 'transfert' ? <IconTransfer className={className} /> : <IconOut className={className} />

/** Button that opens the movement panel. */
export function MovementButton({
  kind,
  ctx,
  defaults,
  variant = 'secondary',
  size = 'md',
  className = '',
  children,
}: {
  kind: MovementKind
  ctx: MovementContext
  defaults?: { itemId?: string; fromHolderId?: string; projectId?: string }
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const m = meta[kind]
  return (
    <>
      <Btn variant={variant} size={size} icon={movementIcon(kind, 'size-5')} className={className} onClick={() => setOpen(true)}>
        {children ?? m.title}
      </Btn>
      <Sheet open={open} onClose={() => setOpen(false)} title={m.title} subtitle={m.subtitle} icon={m.icon}>
        <MovementForm kind={kind} ctx={ctx} defaults={defaults} onDone={() => setOpen(false)} />
      </Sheet>
    </>
  )
}

function MovementForm({ kind, ctx, defaults, onDone }: { kind: MovementKind; ctx: MovementContext; defaults?: { itemId?: string; fromHolderId?: string; projectId?: string }; onDone: () => void }) {
  const router = useRouter()
  const close = useSheetClose()
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
  const [creating, setCreating] = useState(false)
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
    // Logistics: preselect the only holder of an item.
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
    toast.success(meta[kind].done)
    router.refresh()
    onDone()
  }

  const canChooseFrom = ctx.canMoveAny
  const fromOptions = canChooseFrom ? holdersOfItem : holdersOfItem.filter((h) => h.holderId === ctx.me.id)
  const missing = !itemId ? 'Choisissez un article' : !qtyOk ? 'Indiquez une quantité' : kind !== 'sortie' && !toId ? 'Choisissez un membre' : null

  const picker = (
    <ItemPicker
      items={kind === 'entree' ? items : items.filter((i) => ctx.balances.some((b) => b.itemId === i.id && Number(b.qty) > 0 && (canChooseFrom || b.holderId === ctx.me.id)))}
      value={itemId}
      onChange={pickItem}
      allowCreate={kind === 'entree'}
      onCreated={(it) => setItems((list) => [...list, it])}
      onCreatingChange={setCreating}
    />
  )
  return (
    <div className="space-y-6">
      {/* Same place in the tree while creating an item, so the picker keeps its state. */}
      <FormSection title={creating ? 'Nouvel article' : 'Article'}>{picker}</FormSection>
      {/* Creating a new item takes over the panel: its own fields and buttons. */}
      {!creating && (
        <>

      {kind !== 'entree' && itemId && (
        <FormSection title="Détenu par" htmlFor="mv-from">
          {fromOptions.length ? (
            <select id="mv-from" value={fromId} onChange={(e) => setFromId(e.target.value)} className={selectClass} disabled={!canChooseFrom}>
              {!fromOptions.some((h) => h.holderId === fromId) && <option value="">Choisir…</option>}
              {fromOptions.map((h) => (
                <option key={h.holderId} value={h.holderId}>
                  {h.name} — {formatQty(h.qty)} {item?.unit}
                </option>
              ))}
            </select>
          ) : (
            <p className="rounded-[10px] border-s-4 border-danger bg-danger/10 px-3 py-2 text-sm text-danger">Vous ne détenez pas cet article.</p>
          )}
        </FormSection>
      )}

      {kind === 'sortie' && (
        <FormSection title="Que s’est-il passé ?">
          <Choice options={['consommation', 'perte'] as const} value={outType} onChange={setOutType} label="Type de sortie" labelOf={(v) => (v === 'consommation' ? 'Consommé' : 'Perdu / cassé')} />
        </FormSection>
      )}

      <FormSection
        title={`Quantité${item ? ` (${item.unit})` : ''}`}
        htmlFor="mv-qty"
        hint={
          kind !== 'entree' && itemId ? (
            <span className={tooMuch ? 'font-semibold text-danger' : ''}>
              Disponible : {formatQty(fromBalance)} {item?.unit}
            </span>
          ) : undefined
        }
      >
        <QtyStepper id="mv-qty" value={qty} onChange={setQty} label="Quantité" />
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input type="checkbox" checked={estimate} onChange={(e) => setEstimate(e.target.checked)} className="size-5 accent-navy-700" />
          Quantité estimée (affichée avec ≈)
        </label>
      </FormSection>

      {kind === 'entree' && (
        <FormSection title="Provenance">
          <Choice options={SOURCES} value={source} onChange={setSource} label="Provenance" labelOf={(s) => sourceLabel[s]} />
        </FormSection>
      )}

      {(kind === 'transfert' || (kind === 'entree' && ctx.canMoveAny)) && (
        <FormSection title={kind === 'transfert' ? 'Donner à' : 'Qui garde ce matériel ?'} htmlFor="mv-to">
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
        </FormSection>
      )}

      <div className="space-y-4 rounded-[12px] bg-white p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-ink-600">Détails facultatifs</p>
        <FormSection title="Projet / activité" htmlFor="mv-project">
          <select id="mv-project" value={projectId} onChange={(e) => setProjectId(e.target.value)} className={selectClass}>
            <option value="">Aucun (stock général)</option>
            {ctx.projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </FormSection>
        <FormSection title="Note" htmlFor="mv-note">
          <input id="mv-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} placeholder={kind === 'entree' ? 'Ex. don du cabinet Dr X' : 'Ex. cassé pendant le transport'} className={`${inputClass} h-12`} />
        </FormSection>
      </div>

      <SheetFooter>
        <ActionBar
          primary={
            <Btn variant="primary" size="lg" icon={movementIcon(kind)} busy={busy} disabled={!!missing || tooMuch || (kind !== 'entree' && !fromId)} onClick={submit} title={missing ?? undefined}>
              {meta[kind].submit}
            </Btn>
          }
          cancel={
            <Btn variant="quiet" onClick={close}>
              Annuler
            </Btn>
          }
        />
      </SheetFooter>
        </>
      )}
    </div>
  )
}
