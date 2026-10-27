'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { clearDemoData, setItemArchived, setItemPhoto, updateItem } from '@/lib/inventory/actions'
import { CATEGORIES, categoryLabel, formatQty } from '@/lib/inventory/labels'
import type { ItemDTO } from '@/lib/inventory/queries'
import { IconArchive, IconCheck, IconEdit, IconPlus, IconTrash, IconUndo } from '@/components/ui/icons'
import { NewItemForm } from './item-picker'
import { PhotoInput } from './photo-input'
import { ActionBar, Btn, FormSection, ItemThumb, selectClass, Sheet, SheetFooter, Tag, useChanged, useConfirm, useSheetClose, useSheetDirty } from '@/components/ui'

export function CatalogView({ items, canClearDemo }: { items: ItemDTO[]; canClearDemo: boolean }) {
  const router = useRouter()
  const [editing, setEditing] = useState<ItemDTO | null>(null)
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  const list = items.filter((i) => showArchived || !i.isDeleted)
  const hasDemo = items.some((i) => i.isDemo)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm text-ink-600">
          <input type="checkbox" checked={showArchived} onChange={(e) => setShowArchived(e.target.checked)} className="size-4 accent-navy-700" />
          Afficher les articles archivés
        </label>
        <Btn variant="primary" icon={<IconPlus />} onClick={() => setAdding(true)}>
          Nouvel article
        </Btn>
      </div>

      <ul className="card divide-y divide-navy-100 p-0">
        {list.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => setEditing(i)} className="group flex w-full items-center gap-3 px-4 py-3 text-start transition hover:bg-navy-100/40">
              <ItemThumb url={i.photoUrl} name={i.name} category={i.category} size={44} />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-navy-900">{i.name}</span>
                <span className="block text-xs text-ink-600">
                  {categoryLabel[i.category]}
                  {i.subcategory && ` · ${i.subcategory}`} · en {i.unit}
                  {i.minQty && ` · alerte sous ${formatQty(i.minQty)}`}
                </span>
              </span>
              <span className="hidden gap-1 sm:flex">
                {i.isDemo && <Tag tone="gold">Démo</Tag>}
                {i.isDeleted && <Tag tone="muted">Archivé</Tag>}
                {!i.photoUrl && !i.isDeleted && <Tag tone="muted">Sans photo</Tag>}
              </span>
              <IconEdit className="size-4 shrink-0 text-ink-600 opacity-0 transition group-hover:opacity-100" />
            </button>
          </li>
        ))}
        {!list.length && <li className="p-6 text-center text-ink-600">Catalogue vide.</li>}
      </ul>

      {canClearDemo && hasDemo && <ClearDemo />}

      <Sheet open={adding} onClose={() => setAdding(false)} title="Nouvel article" subtitle="Ajouter un article au catalogue." icon={<IconPlus />}>
        <NewItemForm
          showBack={false}
          onCancel={() => setAdding(false)}
          onCreated={() => {
            setAdding(false)
            router.refresh()
          }}
        />
      </Sheet>
      <Sheet open={!!editing} onClose={() => setEditing(null)} title={editing?.name ?? 'Article'} subtitle="Modifier la fiche de l’article." icon={<IconEdit />}>
        {editing && <EditItem item={editing} onDone={() => setEditing(null)} />}
      </Sheet>
    </div>
  )
}

function EditItem({ item, onDone }: { item: ItemDTO; onDone: () => void }) {
  const router = useRouter()
  const close = useSheetClose()
  const { ask, dialog } = useConfirm()
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
    if (!item.isDeleted) {
      const okToGo = await ask({
        title: `Archiver « ${item.name} » ?`,
        body: 'L’article disparaît du stock et des listes de choix. Son historique est conservé, et vous pourrez le restaurer.',
        confirm: 'Archiver',
        danger: true,
      })
      if (!okToGo) return
    }
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

  return (
    <div className="space-y-5">
      <FormSection title="Photo" hint="Enregistrée tout de suite.">
        <PhotoInput onUploaded={(key) => photo(key)} preview={item.photoUrl} />
      </FormSection>
      <FormSection title="Nom" htmlFor="it-name">
        <input id="it-name" value={f.name} onChange={set('name')} className={`${inputClass} h-12`} />
      </FormSection>
      <div className="grid grid-cols-2 gap-3">
        <FormSection title="Catégorie" htmlFor="it-cat">
          <select id="it-cat" value={f.category} onChange={set('category')} className={selectClass}>
            {CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {categoryLabel[c]}
              </option>
            ))}
          </select>
        </FormSection>
        <FormSection title="Sous-catégorie" htmlFor="it-sub">
          <input id="it-sub" value={f.subcategory} onChange={set('subcategory')} className={`${inputClass} h-12`} placeholder="Ex. Daviers" />
        </FormSection>
        <FormSection title="Unité" htmlFor="it-unit">
          <input id="it-unit" value={f.unit} onChange={set('unit')} className={`${inputClass} h-12`} />
        </FormSection>
        <FormSection title="Alerte stock bas" htmlFor="it-min">
          <input id="it-min" inputMode="decimal" value={f.minQty} onChange={set('minQty')} className={`${inputClass} h-12`} placeholder="Aucune" />
        </FormSection>
      </div>
      <FormSection title="Notes" htmlFor="it-notes">
        <textarea id="it-notes" value={f.notes} onChange={set('notes')} rows={3} className={inputClass} placeholder="Ex. modèle, précautions de transport…" />
      </FormSection>
      {dialog}
      <SheetFooter>
        <ActionBar
          primary={
            <Btn variant="primary" size="lg" icon={<IconCheck />} busy={busy === 'save'} disabled={!!busy} onClick={save}>
              Enregistrer
            </Btn>
          }
          cancel={
            <Btn variant="quiet" onClick={close}>
              Annuler
            </Btn>
          }
          danger={
            item.isDeleted ? (
              <Btn variant="quiet" icon={<IconUndo className="size-4" />} busy={busy === 'archive'} disabled={!!busy} onClick={archive}>
                Restaurer
              </Btn>
            ) : (
              <Btn variant="dangerQuiet" icon={<IconArchive className="size-4" />} busy={busy === 'archive'} disabled={!!busy} onClick={archive}>
                Archiver
              </Btn>
            )
          }
        />
      </SheetFooter>
    </div>
  )
}

function ClearDemo() {
  const router = useRouter()
  const { ask, dialog } = useConfirm()
  const [busy, setBusy] = useState(false)
  async function clear() {
    const okToGo = await ask({
      title: 'Supprimer toutes les données de démonstration ?',
      body: 'Action définitive. Tout ce qui est marqué « démo » est supprimé, y compris les essais faits sur des articles ou le projet de démonstration. Les données réelles ne sont pas touchées.',
      confirm: 'Supprimer la démo',
      danger: true,
    })
    if (!okToGo) return
    setBusy(true)
    const res = await clearDemoData()
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    const d = res.data
    toast.success(`Démo supprimée : ${d.items} articles, ${d.movements} mouvements, ${d.counts} inventaires, ${d.projects} projet(s)`)
    router.refresh()
  }
  return (
    <section className="flex flex-col gap-4 rounded-[12px] border border-danger/20 bg-danger/5 p-4 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <h3 className="font-heading font-bold text-navy-900">Données de démonstration</h3>
        <p className="mt-1 text-sm text-ink-600">À supprimer avant de saisir le vrai stock. Les données réelles ne sont pas touchées.</p>
      </div>
      <Btn variant="danger" icon={<IconTrash className="size-4" />} busy={busy} onClick={clear} className="shrink-0">
        Vider les données de démonstration
      </Btn>
      {dialog}
    </section>
  )
}
