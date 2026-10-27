'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { clearDemoData, setItemArchived, setItemPhoto, updateItem } from '@/lib/inventory/actions'
import { CATEGORIES, categoryLabel, formatQty } from '@/lib/inventory/labels'
import type { ItemDTO } from '@/lib/inventory/queries'
import { NewItemForm } from './item-picker'
import { PhotoInput } from './photo-input'
import { ItemThumb, selectClass, Sheet, Tag, useChanged, useSheetDirty } from './ui'

export function CatalogView({ items, canClearDemo }: { items: ItemDTO[]; canClearDemo: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<ItemDTO | null>(null)
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const list = items.filter((i) => showArchived || !i.isDeleted)
  const hasDemo = items.some((i) => i.isDemo)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-navy-700" />
          Afficher les articles archivés
        </label>
        <button type="button" onClick={() => setAdding(true)} className="btn btn-primary min-h-11">
          + Nouvel article
        </button>
      </div>

      <ul className="card divide-y divide-navy-100 p-0">
        {list.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => setEditing(i)} className="flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-navy-100/40">
              <ItemThumb url={i.photoUrl} name={i.name} size={40} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-navy-900">{i.name}</span>
                <span className="block text-xs text-ink-600">
                  {categoryLabel[i.category]}
                  {i.subcategory && ` · ${i.subcategory}`} · {i.unit}
                  {i.minQty && ` · seuil ${formatQty(i.minQty)}`}
                </span>
              </span>
              {i.isDemo && <Tag tone="gold">Démo</Tag>}
              {i.isDeleted && <Tag tone="muted">Archivé</Tag>}
              {!i.photoUrl && !i.isDeleted && <Tag tone="muted">Sans photo</Tag>}
            </button>
          </li>
        ))}
        {!list.length && <li className="p-6 text-center text-ink-600">Catalogue vide.</li>}
      </ul>

      {canClearDemo && hasDemo && <ClearDemo />}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Nouvel article">
        {adding && (
          <NewItemForm
            onCancel={() => setAdding(false)}
            onCreated={() => {
              setAdding(false)
              router.refresh()
            }}
          />
        )}
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing ? `Modifier · ${editing.name}` : 'Modifier'}>
        {editing && <EditItem item={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function EditItem({ item, onDone }: { item: ItemDTO; onDone: () => void }) {
  const router = useRouter()
  const [f, setF] = useState({ name: item.name, category: item.category, subcategory: item.subcategory ?? '', unit: item.unit, minQty: item.minQty ?? '', notes: item.notes ?? '' })
  const [busy, setBusy] = useState<string | null>(null)
  useSheetDirty(useChanged(f))
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  async function save() {
    setBusy('save')
    const res = await updateItem({ id: item.id, ...f, minQty: f.minQty.replace(',', '.') })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Article enregistré')
    router.refresh()
    onDone()
  }
  async function archive() {
    setBusy('archive')
    const res = await setItemArchived({ id: item.id, archived: !item.isDeleted })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(item.isDeleted ? 'Article restauré' : 'Article archivé')
    router.refresh()
    onDone()
  }
  async function photo(key: string) {
    const res = await setItemPhoto({ id: item.id, key })
    if (res.status === 'error') return void toast.error(res.message)
    router.refresh()
  }

  const field = 'mb-1 block text-sm font-semibold'
  return (
    <div className="space-y-4">
      <PhotoInput onUploaded={(key) => photo(key)} preview={item.photoUrl} />
      <div>
        <label htmlFor="it-name" className={field}>
          Nom
        </label>
        <input id="it-name" value={f.name} onChange={set('name')} className={`${inputClass} h-12`} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="it-cat" className={field}>
            Catégorie
          </label>
          <select id="it-cat" value={f.category} onChange={set('category')} className={selectClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="it-sub" className={field}>
            Sous-catégorie
          </label>
          <input id="it-sub" value={f.subcategory} onChange={set('subcategory')} className={`${inputClass} h-12`} placeholder="Ex. Daviers" />
        </div>
        <div>
          <label htmlFor="it-unit" className={field}>
            Unité
          </label>
          <input id="it-unit" value={f.unit} onChange={set('unit')} className={`${inputClass} h-12`} />
        </div>
        <div>
          <label htmlFor="it-min" className={field}>
            Seuil stock bas
          </label>
          <input id="it-min" inputMode="decimal" value={f.minQty} onChange={set('minQty')} className={`${inputClass} h-12`} placeholder="Aucun" />
        </div>
      </div>
      <div>
        <label htmlFor="it-notes" className={field}>
          Notes
        </label>
        <textarea id="it-notes" value={f.notes} onChange={set('notes')} rows={3} className={inputClass} />
      </div>
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={save} disabled={!!busy} className="btn btn-primary min-h-11 flex-1 disabled:opacity-60">
          {busy === 'save' && <Spinner />} Enregistrer
        </button>
        <button type="button" onClick={archive} disabled={!!busy} className="btn btn-ghost min-h-11 disabled:opacity-60">
          {busy === 'archive' && <Spinner />} {item.isDeleted ? 'Restaurer' : 'Archiver'}
        </button>
      </div>
    </div>
  )
}

function ClearDemo() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  async function clear() {
    setBusy(true)
    const res = await clearDemoData()
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    const d = res.data
    toast.success(`Démo supprimée : ${d.items} articles, ${d.movements} mouvements, ${d.counts} inventaires, ${d.projects} projet(s)`)
    setOpen(false)
    router.refresh()
  }
  return (
    <section className="rounded-[12px] border-s-4 border-danger bg-white p-4 shadow-card">
      <h3 className="font-heading font-bold">Données de démonstration</h3>
      <p className="mt-1 text-sm text-ink-600">Supprime définitivement tous les articles, mouvements, besoins et inventaires de démonstration, ainsi que le projet « [Démo] ». Les données réelles ne sont pas touchées.</p>
      <button type="button" onClick={() => setOpen(true)} className="btn mt-3 min-h-11 bg-danger text-white hover:brightness-90">
        Vider les données de démonstration
      </button>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        title="Confirmer la suppression"
        footer={
          <div className="flex gap-2">
            <button type="button" onClick={() => setOpen(false)} disabled={busy} className="btn btn-ghost min-h-11 flex-1">
              Annuler
            </button>
            <button type="button" onClick={clear} disabled={busy} className="btn min-h-11 flex-1 bg-danger text-white hover:brightness-90 disabled:opacity-70">
              {busy && <Spinner />} Supprimer la démo
            </button>
          </div>
        }
      >
        <p>Cette action est définitive. Tout ce qui est marqué « démo » sera supprimé, y compris les essais faits sur des articles ou le projet de démonstration.</p>
      </Sheet>
    </section>
  )
}
