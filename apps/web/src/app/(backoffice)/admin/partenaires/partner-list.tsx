'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { ImageField } from '@/components/admin/image-field'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { savePartner, type PartnerInput } from './actions'

export const partnerTypes = [
  { value: 'sponsor', label: 'Entreprise / sponsor' },
  { value: 'association', label: 'Association' },
  { value: 'ecole', label: 'École' },
  { value: 'universite', label: 'Université / grande école' },
  { value: 'sport', label: 'Club sportif' },
] as const

type Partner = PartnerInput & { id: string; logoUrl: string | null; donations: number; actions: number }

export function PartnerList({ partners }: { partners: Partner[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const [filter, setFilter] = useState('')
  const nextOrder = partners.reduce((m, x) => Math.max(m, x.order), 0) + 1
  const shown = partners.filter((p) => p.name.toLowerCase().includes(filter.toLowerCase()))
  const typeLabel = Object.fromEntries(partnerTypes.map((t) => [t.value, t.label]))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Rechercher un partenaire…" className={`${inputClass} max-w-xs`} />
        {editing !== 'new' && (
          <button type="button" onClick={() => setEditing('new')} className="btn btn-primary">
            + Ajouter un partenaire
          </button>
        )}
      </div>
      {editing === 'new' && (
        <div className="card p-4">
          <p className="mb-3 font-semibold text-navy-700">Nouveau partenaire</p>
          <PartnerEditor nextOrder={nextOrder} onDone={() => setEditing(null)} />
        </div>
      )}
      <ul className="card divide-y divide-navy-100">
        {shown.map((p) => (
          <li key={p.id} className={`p-4 ${p.isVisible ? '' : 'bg-cream-50'}`}>
            <div className="flex flex-wrap items-center gap-4">
              <ImageField entity="partner" id={p.id} url={p.logoUrl} alt={p.name} maxSide={600} />
              <div className="min-w-48 flex-1">
                <p className="font-semibold">
                  {p.name}
                  {!p.isVisible && <span className="ms-2 rounded-full bg-navy-100 px-2 py-0.5 text-xs text-ink-600">masqué</span>}
                </p>
                <p className="text-xs text-ink-600">
                  {typeLabel[p.type]}
                  {p.actions > 0 && ` · ${p.actions} action${p.actions > 1 ? 's' : ''}`}
                  {p.donations > 0 && ` · ${p.donations} don${p.donations > 1 ? 's' : ''} (mur des sponsors)`}
                  {p.website && ` · ${p.website.replace(/^https?:\/\//, '')}`}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(editing === p.id ? null : p.id)} className="btn btn-ghost px-3 py-1.5 text-sm">
                {editing === p.id ? 'Fermer' : 'Modifier'}
              </button>
            </div>
            {editing === p.id && (
              <div className="mt-4">
                <PartnerEditor initial={p} onDone={() => setEditing(null)} />
              </div>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}

function PartnerEditor({ initial, nextOrder, onDone }: { initial?: Partner; nextOrder?: number; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState({
    name: initial?.name ?? '',
    type: initial?.type ?? 'association',
    website: initial?.website ?? '',
    isVisible: initial?.isVisible ?? true,
    order: String(initial?.order ?? nextOrder ?? 0),
  })
  const [saving, setSaving] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setV((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await savePartner({ id: initial?.id, ...v, type: v.type as PartnerInput['type'], order: Number(v.order) || 0 })
    setSaving(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Partenaire mis à jour' : 'Partenaire ajouté. Vous pouvez maintenant ajouter son logo.')
    router.refresh()
    onDone()
  }

  const idp = initial?.id ?? 'new'
  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-cream-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id={`pn-${idp}`} label="Nom *">
          <input id={`pn-${idp}`} required minLength={2} maxLength={120} value={v.name} onChange={set('name')} className={inputClass} />
        </Field>
        <Field id={`pt-${idp}`} label="Type">
          <select id={`pt-${idp}`} value={v.type} onChange={set('type')} className={inputClass}>
            {partnerTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id={`pw-${idp}`} label="Site web">
          <input id={`pw-${idp}`} dir="ltr" value={v.website} onChange={set('website')} placeholder="exemple.ma" className={`${inputClass} text-start`} />
        </Field>
        <Field id={`po-${idp}`} label="Ordre">
          <input id={`po-${idp}`} type="number" min={0} max={999} value={v.order} onChange={set('order')} className={inputClass} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.isVisible} onChange={set('isVisible')} className="size-4 accent-navy-700" />
        Visible sur le site
      </label>
      <div className="flex items-center gap-3">
        <div className="w-48">
          <SubmitButton loading={saving}>{initial ? 'Enregistrer' : 'Ajouter'}</SubmitButton>
        </div>
        <button type="button" onClick={onDone} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}
