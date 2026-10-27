'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { copyNeeds, removeNeed, setNeed } from '@/lib/inventory/actions'
import { formatQty } from '@/lib/inventory/labels'
import { ItemPicker, type PickerItem } from './item-picker'
import { QtyStepper, selectClass, Sheet, Tag } from './ui'

export type NeedRow = { id: string; itemId: string; itemName: string; unit: string; qtyNeeded: string; collected: string; stock: string; note: string | null }

/** Couvert = enough in total stock; Partiel = some; Manquant = none. */
function status(n: NeedRow) {
  const need = Number(n.qtyNeeded)
  const stock = Number(n.stock)
  if (stock >= need) return { label: 'Couvert', tone: 'success' as const, border: 'border-success' }
  if (stock > 0) return { label: 'Partiel', tone: 'gold' as const, border: 'border-gold-500' }
  return { label: 'Manquant', tone: 'danger' as const, border: 'border-danger' }
}

export function NeedsSection({ projectId, needs, canManage, items, copySources }: { projectId: string; needs: NeedRow[]; canManage: boolean; items: PickerItem[]; copySources: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<NeedRow | 'new' | null>(null)
  const counts = { couvert: 0, partiel: 0, manquant: 0 }
  for (const n of needs) counts[status(n).label.toLowerCase() as keyof typeof counts]++

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-heading text-xl font-bold text-navy-700">Besoins</h2>
          {needs.length > 0 && (
            <p className="text-sm text-ink-600">
              {counts.couvert} couvert(s) · {counts.partiel} partiel(s) · {counts.manquant} manquant(s)
            </p>
          )}
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {copySources.length > 0 && <CopyNeeds projectId={projectId} sources={copySources} />}
            <button type="button" onClick={() => setEditing('new')} className="btn btn-primary min-h-11">
              + Besoin
            </button>
          </div>
        )}
      </div>

      {needs.length ? (
        <ul className="space-y-2">
          {needs.map((n) => {
            const s = status(n)
            return (
              <li key={n.id} className={`card flex flex-wrap items-center gap-3 border-s-4 px-4 py-3 ${s.border}`}>
                <div className="min-w-0 basis-full sm:flex-1 sm:basis-auto">
                  <p className="font-semibold text-navy-900">
                    {n.itemName} <span className="font-normal text-ink-600">· besoin {formatQty(n.qtyNeeded)} {n.unit}</span>
                  </p>
                  <p className="text-sm text-ink-600">
                    Stock total {formatQty(n.stock)} · collecté pour ce projet {formatQty(n.collected)}
                    {n.note && ` · ${n.note}`}
                  </p>
                </div>
                <Tag tone={s.tone}>{s.label}</Tag>
                {canManage && (
                  <button type="button" onClick={() => setEditing(n)} className="ms-auto rounded-[8px] px-2 py-1.5 text-sm font-semibold text-navy-700 hover:bg-navy-100">
                    Modifier
                  </button>
                )}
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="card p-5 text-sm text-ink-600">
          Pas encore de liste de besoins.{canManage && copySources.length > 0 && ' Vous pouvez copier celle d’une caravane précédente.'}
        </p>
      )}

      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'Nouveau besoin' : 'Modifier le besoin'}>
        {editing && <NeedForm projectId={projectId} need={editing === 'new' ? null : editing} items={items} onDone={() => setEditing(null)} />}
      </Sheet>
    </section>
  )
}

function NeedForm({ projectId, need, items, onDone }: { projectId: string; need: NeedRow | null; items: PickerItem[]; onDone: () => void }) {
  const router = useRouter()
  const [itemId, setItemId] = useState<string | null>(need?.itemId ?? null)
  const [qty, setQty] = useState(need?.qtyNeeded ?? '')
  const [note, setNote] = useState(need?.note ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  async function save() {
    if (!itemId) return
    setBusy('save')
    const res = await setNeed({ projectId, itemId, qtyNeeded: qty, note })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Besoin enregistré')
    router.refresh()
    onDone()
  }
  async function remove() {
    if (!need) return
    setBusy('remove')
    const res = await removeNeed({ id: need.id })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Besoin retiré')
    router.refresh()
    onDone()
  }
  return (
    <div className="space-y-4">
      <div>
        <p className="mb-1 text-sm font-semibold">Article</p>
        {need ? <p className="font-semibold">{need.itemName}</p> : <ItemPicker items={items} value={itemId} onChange={setItemId} />}
      </div>
      <div>
        <label htmlFor="need-qty" className="mb-1 block text-sm font-semibold">
          Quantité nécessaire
        </label>
        <QtyStepper id="need-qty" value={qty} onChange={setQty} label="Quantité nécessaire" />
      </div>
      <div>
        <label htmlFor="need-note" className="mb-1 block text-sm font-semibold">
          Note (facultatif)
        </label>
        <input id="need-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={`${inputClass} h-12`} />
      </div>
      <div className="flex gap-2">
        {need && (
          <button type="button" onClick={remove} disabled={!!busy} className="btn btn-ghost min-h-12 text-danger">
            {busy === 'remove' && <Spinner />} Retirer
          </button>
        )}
        <button type="button" onClick={save} disabled={!!busy || !itemId || !qty} className="btn btn-primary min-h-12 flex-1 disabled:opacity-60">
          {busy === 'save' && <Spinner />} Enregistrer
        </button>
      </div>
    </div>
  )
}

function CopyNeeds({ projectId, sources }: { projectId: string; sources: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(sources[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  async function copy() {
    setBusy(true)
    const res = await copyNeeds({ fromProjectId: from, toProjectId: projectId })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(`${res.data.added} besoin(s) copié(s)${res.data.skipped ? `, ${res.data.skipped} déjà présent(s)` : ''}`)
    setOpen(false)
    router.refresh()
  }
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost min-h-11">
        Copier d’un autre projet
      </button>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Copier les besoins"
        footer={
          <button type="button" onClick={copy} disabled={busy || !from} className="btn btn-primary min-h-12 w-full disabled:opacity-60">
            {busy && <Spinner />} Copier
          </button>
        }
      >
        <label htmlFor="copy-from" className="mb-1 block text-sm font-semibold">
          Reprendre la liste de
        </label>
        <select id="copy-from" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass}>
          {sources.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <p className="mt-3 text-sm text-ink-600">Les articles déjà présents dans cette liste sont gardés tels quels ; les autres sont ajoutés avec les mêmes quantités.</p>
      </Sheet>
    </>
  )
}
