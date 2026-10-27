'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { createItem } from '@/lib/inventory/actions'
import { CATEGORIES, categoryLabel } from '@/lib/inventory/labels'
import type { ItemDTO } from '@/lib/inventory/queries'
import { PhotoInput } from './photo-input'
import { ItemThumb, selectClass, useChanged, useSheetDirty } from './ui'

export type PickerItem = Pick<ItemDTO, 'id' | 'name' | 'unit' | 'category' | 'photoUrl' | 'subcategory'>

const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()

/** Search the catalogue; optionally create a new item on the spot (with a photo from the camera). */
export function ItemPicker({
  items,
  value,
  onChange,
  allowCreate = false,
  onCreated,
}: {
  items: PickerItem[]
  value: string | null
  onChange: (id: string | null) => void
  allowCreate?: boolean
  onCreated?: (item: PickerItem) => void
}) {
  const [q, setQ] = useState('')
  const [creating, setCreating] = useState(false)
  const selected = items.find((i) => i.id === value)
  const matches = useMemo(() => {
    const f = fold(q.trim())
    return (f ? items.filter((i) => fold(`${i.name} ${i.subcategory ?? ''}`).includes(f)) : items).slice(0, 8)
  }, [items, q])

  if (selected)
    return (
      <div className="flex items-center gap-3 rounded-[10px] border border-navy-100 bg-white p-2">
        <ItemThumb url={selected.photoUrl} name={selected.name} size={44} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{selected.name}</p>
          <p className="text-xs text-ink-600">
            {categoryLabel[selected.category]} · {selected.unit}
          </p>
        </div>
        <button type="button" onClick={() => onChange(null)} className="rounded-[8px] px-3 py-2 text-sm font-semibold text-navy-700 hover:bg-navy-100">
          Changer
        </button>
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
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un article…" className={`${inputClass} h-12`} aria-label="Rechercher un article" />
      <ul className="max-h-64 divide-y divide-navy-100 overflow-y-auto rounded-[10px] border border-navy-100 bg-white">
        {matches.map((i) => (
          <li key={i.id}>
            <button type="button" onClick={() => onChange(i.id)} className="flex w-full items-center gap-3 px-3 py-2 text-start transition hover:bg-navy-100/60 active:bg-navy-100">
              <ItemThumb url={i.photoUrl} name={i.name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">{i.name}</span>
                <span className="block text-xs text-ink-600">
                  {categoryLabel[i.category]}
                  {i.subcategory && ` · ${i.subcategory}`}
                </span>
              </span>
            </button>
          </li>
        ))}
        {!matches.length && <li className="px-3 py-3 text-sm text-ink-600">Aucun article trouvé.</li>}
      </ul>
      {allowCreate && (
        <button type="button" onClick={() => setCreating(true)} className="w-full rounded-[10px] border border-dashed border-navy-700/40 px-3 py-3 text-sm font-semibold text-navy-700 transition hover:bg-navy-100">
          + Nouvel article{q.trim() && ` « ${q.trim()} »`}
        </button>
      )}
    </div>
  )
}

const UNITS = ['pièces', 'boîtes', 'paquets', 'kits', 'flacons', 'litres', 'ml', 'rouleaux']

export function NewItemForm({ initialName = '', onCancel, onCreated }: { initialName?: string; onCancel: () => void; onCreated: (item: PickerItem) => void }) {
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
    <div className="space-y-3 rounded-[10px] border-s-4 border-gold-500 bg-gold-100/40 p-3">
      <p className="text-sm font-semibold">Nouvel article</p>
      <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nom (ex. Gants nitrile M)" className={`${inputClass} h-12`} aria-label="Nom de l’article" autoFocus />
      <div className="grid grid-cols-3 gap-1" role="radiogroup" aria-label="Catégorie">
        {CATEGORIES.map((c) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={category === c}
            onClick={() => {
              setCategory(c)
              if (c !== 'consommable') setUnit('pièces')
            }}
            className={`min-h-11 rounded-[8px] border px-2 text-sm font-semibold transition ${category === c ? 'border-navy-700 bg-navy-700 text-white' : 'border-navy-100 bg-white text-navy-700 hover:bg-navy-100'}`}
          >
            {categoryLabel[c]}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <select value={unit} onChange={(e) => setUnit(e.target.value)} className={selectClass} aria-label="Unité">
          {UNITS.map((u) => (
            <option key={u}>{u}</option>
          ))}
        </select>
        <input value={subcategory} onChange={(e) => setSubcategory(e.target.value)} placeholder="Sous-catégorie" className={`${inputClass} h-12`} aria-label="Sous-catégorie (facultatif)" />
      </div>
      <PhotoInput onUploaded={(key, url) => setPhoto({ key, url })} />
      <div className="flex gap-2">
        <button type="button" onClick={onCancel} className="btn btn-ghost flex-1">
          Annuler
        </button>
        <button type="button" onClick={save} disabled={busy || name.trim().length < 2} className="btn btn-primary flex-1 disabled:opacity-60">
          {busy && <Spinner />} Créer
        </button>
      </div>
    </div>
  )
}
