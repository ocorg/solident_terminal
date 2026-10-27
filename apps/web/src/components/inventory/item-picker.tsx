'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { createItem } from '@/lib/inventory/actions'
import { CATEGORIES, categoryLabel } from '@/lib/inventory/labels'
import type { ItemDTO } from '@/lib/inventory/queries'
import { IconBack, IconCheck, IconPlus } from '@/components/ui/icons'
import { PhotoInput } from './photo-input'
import { ActionBar, Btn, Choice, FormSection, ItemThumb, SheetFooter, selectClass, useChanged, useSheetDirty } from '@/components/ui'

export type PickerItem = Pick<ItemDTO, 'id' | 'name' | 'unit' | 'category' | 'photoUrl' | 'subcategory'>

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/**
 * Search the catalogue; optionally create a new item on the spot (with a photo from the camera).
 * While creating, the picker takes over the panel (`onCreatingChange` lets the parent hide its own fields).
 */
export function ItemPicker({
  items,
  value,
  onChange,
  allowCreate = false,
  onCreated,
  onCreatingChange,
}: {
  items: PickerItem[]
  value: string | null
  onChange: (id: string | null) => void
  allowCreate?: boolean
  onCreated?: (item: PickerItem) => void
  onCreatingChange?: (creating: boolean) => void
}) {
  const [q, setQ] = useState('')
  const [creating, setCreatingState] = useState(false)
  const setCreating = (v: boolean) => {
    setCreatingState(v)
    onCreatingChange?.(v)
  }
  const selected = items.find((i) => i.id === value)
  const matches = useMemo(() => {
    const f = fold(q.trim())
    return (f ? items.filter((i) => fold(`${i.name} ${i.subcategory ?? ''}`).includes(f)) : items).slice(0, 8)
  }, [items, q])

  if (selected)
    return (
      <div className="flex items-center gap-3 rounded-[12px] border border-navy-700/20 bg-white p-3 shadow-sm">
        <ItemThumb url={selected.photoUrl} name={selected.name} category={selected.category} size={52} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight text-navy-900">{selected.name}</p>
          <p className="mt-0.5 text-xs text-ink-600">
            {categoryLabel[selected.category]}
            {selected.subcategory && ` · ${selected.subcategory}`} · en {selected.unit}
          </p>
        </div>
        <Btn variant="quiet" size="sm" onClick={() => onChange(null)}>
          Changer
        </Btn>
      </div>
    )

  if (creating)
    return (
      <NewItemForm
        initialName={q}
        onCancel={() => setCreating(false)}
        onCreated={(item) => {
          onCreated?.(item)
          onChange(item.id)
          setCreating(false)
        }}
      />
    )

  return (
    <div className="space-y-2">
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un article…" className={`${inputClass} h-12`} aria-label="Rechercher un article" data-no-guard />
      <ul className="max-h-64 divide-y divide-navy-100 overflow-y-auto rounded-[12px] border border-navy-100 bg-white">
        {matches.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onChange(i.id)} className="flex w-full items-center gap-3 px-3 py-2.5 text-start transition hover:bg-navy-100/50 active:bg-navy-100">
              <ItemThumb url={i.photoUrl} name={i.name} category={i.category} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-navy-900">{i.name}</span>
                <span className="block text-xs text-ink-600">
                  {categoryLabel[i.category]}
                  {i.subcategory && ` · ${i.subcategory}`}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!matches.length && <li className="px-3 py-4 text-center text-sm text-ink-600">Aucun article trouvé{q.trim() && ` pour « ${q.trim()} »`}.</li>}
      </ul>
      {allowCreate && (
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="flex w-full items-center gap-3 rounded-[12px] border border-dashed border-navy-700/30 px-3 py-3 text-start text-sm font-semibold text-navy-700 transition hover:border-navy-700 hover:bg-navy-100/40"
        >
          <span className="flex size-9 items-center justify-center rounded-[8px] bg-navy-100">
            <IconPlus className="size-4" />
          </span>
          <span>
            Créer un nouvel article{q.trim() && ` « ${q.trim()} »`}
            <span className="block text-xs font-normal text-ink-600">S’il n’existe pas encore dans le catalogue</span>
          </span>
        </button>
      )}
    </div>
  )
}

const UNITS = ['pièces', 'boîtes', 'paquets', 'kits', 'flacons', 'litres', 'ml', 'rouleaux']

/** Create a catalogue item. Its actions go in the panel's bottom bar. */
export function NewItemForm({ initialName = '', onCancel, onCreated, showBack = true }: { initialName?: string; onCancel: () => void; onCreated: (item: PickerItem) => void; showBack?: boolean }) {
  const [name, setName] = useState(initialName)
  const [category, setCategory] = useState<PickerItem['category']>('consommable')
  const [unit, setUnit] = useState('pièces')
  const [subcategory, setSubcategory] = useState('')
  const [photo, setPhoto] = useState<{ key: string; url: string } | null>(null)
  const [busy, setBusy] = useState(false)
  useSheetDirty(useChanged({ name, category, unit, subcategory, photo: photo?.key ?? null }))

  async function save() {
    setBusy(true)
    const res = await createItem({ name, category, unit, subcategory, photoKey: photo?.key ?? null })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(`Article « ${res.data.name} » ajouté au catalogue`)
    onCreated({ ...res.data, photoUrl: photo?.url ?? null, subcategory: subcategory || null })
  }

  return (
    <div className="space-y-5">
      {showBack && (
        <button type="button" onClick={onCancel} className="-ms-2 inline-flex items-center gap-1 rounded-[8px] px-2 py-1.5 text-sm font-semibold text-navy-700 transition hover:bg-navy-100">
          <IconBack className="size-4" /> Retour à la recherche
        </button>
      )}
      <FormSection title="Nom de l’article" htmlFor="new-item-name">
        <input id="new-item-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex. Gants nitrile taille M" className={`${inputClass} h-12`} autoFocus />
      </FormSection>
      <FormSection title="Catégorie">
        <Choice
          options={CATEGORIES}
          value={category}
          onChange={(c) => {
            setCategory(c)
            if (c !== 'consommable') setUnit('pièces')
          }}
          label="Catégorie"
          labelOf={(c) => categoryLabel[c]}
        />
      </FormSection>
      <div className="grid grid-cols-2 gap-3">
        <FormSection title="Unité" htmlFor="new-item-unit">
          <select id="new-item-unit" value={unit} onChange={(e) => setUnit(e.target.value)} className={selectClass}>
            {UNITS.map((u) => (
              <option key={u}>{u}</option>
            ))}
          </select>
        </FormSection>
        <FormSection title="Sous-catégorie" htmlFor="new-item-sub">
          <input id="new-item-sub" value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="Facultatif" className={`${inputClass} h-12`} />
        </FormSection>
      </div>
      <FormSection title="Photo" hint="Facultatif, mais très utile pour les instruments.">
        <PhotoInput onUploaded={(key, url) => setPhoto({ key, url })} />
      </FormSection>
      <SheetFooter>
        <ActionBar
          primary={
            <Btn variant="primary" size="lg" icon={<IconCheck />} busy={busy} disabled={name.trim().length < 2} onClick={save}>
              Créer l’article
            </Btn>
          }
          cancel={
            <Btn variant="quiet" onClick={onCancel}>
              {showBack ? 'Retour' : 'Annuler'}
            </Btn>
          }
        />
      </SheetFooter>
    </div>
  )
}
