'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { saveAction, type ActionInput } from './actions'

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)
const langs = [
  { key: 'Fr', label: 'Français', dir: 'ltr' },
  { key: 'Ar', label: 'العربية', dir: 'rtl' },
  { key: 'En', label: 'English', dir: 'ltr' },
] as const

type Values = Omit<ActionInput, 'beneficiariesCount'> & { beneficiariesCount: string }

export function ActionForm({
  initial,
  programmes,
  partners,
}: {
  initial?: ActionInput
  programmes: { id: string; title: string }[]
  partners: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [v, setV] = useState<Values>({
    slug: '', programmeId: '', titleFr: '', titleAr: '', titleEn: '', bodyFr: '', bodyAr: '', bodyEn: '',
    dateStart: '', dateEnd: '', location: '', coords: '', partnerIds: [], isPublished: true,
    ...initial,
    beneficiariesCount: initial?.beneficiariesCount ? String(initial.beneficiariesCount) : '',
  })
  const [lang, setLang] = useState<(typeof langs)[number]['key']>('Fr')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [partnerFilter, setPartnerFilter] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setV((f) => ({ ...f, [k]: value, ...(k === 'titleFr' && !slugTouched && { slug: slugify(String(value)) }) }))
  }
  const togglePartner = (id: string) =>
    setV((f) => ({ ...f, partnerIds: f.partnerIds.includes(id) ? f.partnerIds.filter((x) => x !== id) : [...f.partnerIds, id] }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await saveAction(v)
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Action mise à jour' : 'Action créée. Ajoutez maintenant une couverture et des photos.')
    router.push(initial ? '/admin/contenu' : `/admin/contenu/actions/${res.data.id}`)
    router.refresh()
  }

  const shownPartners = partners.filter((p) => p.name.toLowerCase().includes(partnerFilter.toLowerCase()) || v.partnerIds.includes(p.id))

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      <div className="flex gap-1 border-b border-navy-100">
        {langs.map((l) => (
          <button key={l.key} type="button" onClick={() => setLang(l.key)} className={`px-4 py-2 text-sm font-semibold ${lang === l.key ? 'border-b-2 border-gold-500 text-navy-700' : 'text-ink-600'}`}>
            {l.label}
            {l.key === 'Fr' && ' *'}
          </button>
        ))}
      </div>
      {langs.map((l) => (
        <div key={l.key} hidden={lang !== l.key} dir={l.dir} className="space-y-4">
          <Field id={`atitle${l.key}`} label="Titre">
            <input id={`atitle${l.key}`} value={v[`title${l.key}`] ?? ''} onChange={set(`title${l.key}`)} required={l.key === 'Fr'} minLength={l.key === 'Fr' ? 3 : undefined} maxLength={160} className={inputClass} />
          </Field>
          <Field id={`abody${l.key}`} label="Récit (ce qui a été fait, résultats)">
            <textarea id={`abody${l.key}`} rows={6} value={v[`body${l.key}`] ?? ''} onChange={set(`body${l.key}`)} maxLength={8000} className={inputClass} />
          </Field>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="aprog" label="Programme">
          <select id="aprog" value={v.programmeId ?? ''} onChange={set('programmeId')} className={inputClass}>
            <option value="">—</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field id="astart" label="Date de début *">
          <input id="astart" type="date" required value={v.dateStart} onChange={set('dateStart')} className={inputClass} />
        </Field>
        <Field id="aend" label="Date de fin (si plusieurs jours)">
          <input id="aend" type="date" value={v.dateEnd ?? ''} onChange={set('dateEnd')} className={inputClass} />
        </Field>
        <Field id="aloc" label="Lieu">
          <input id="aloc" value={v.location ?? ''} onChange={set('location')} maxLength={160} className={inputClass} />
        </Field>
        <Field id="acoords" label="Coordonnées pour la carte">
          <input id="acoords" dir="ltr" value={v.coords ?? ''} onChange={set('coords')} placeholder="35.0017, -5.9053" className={`${inputClass} text-start`} />
          <p className="text-xs text-ink-600">Google Maps : clic droit sur le lieu → cliquez sur les chiffres pour les copier → collez ici.</p>
        </Field>
        <Field id="abenef" label="Bénéficiaires (nombre)">
          <input id="abenef" type="number" min={0} value={v.beneficiariesCount} onChange={set('beneficiariesCount')} className={inputClass} />
        </Field>
        <Field id="aslug" label="Slug (adresse)">
          <input id="aslug" required value={v.slug} onChange={(e) => (setSlugTouched(true), set('slug')(e))} className={inputClass} />
        </Field>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium text-navy-900">Partenaires de l’action ({v.partnerIds.length})</legend>
        <input value={partnerFilter} onChange={(e) => setPartnerFilter(e.target.value)} placeholder="Filtrer…" className={`${inputClass} max-w-xs py-2`} />
        <div className="grid max-h-56 gap-1 overflow-y-auto rounded-lg border border-navy-100 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {shownPartners.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.partnerIds.includes(p.id)} onChange={() => togglePartner(p.id)} className="size-4 accent-navy-700" />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.isPublished} onChange={set('isPublished')} className="size-4 accent-navy-700" />
        Publiée (visible sur le site, la carte et la frise)
      </label>
      <div className="flex items-center gap-3">
        <div className="w-56">
          <SubmitButton loading={loading}>{initial ? 'Enregistrer' : 'Créer l’action'}</SubmitButton>
        </div>
        <button type="button" onClick={() => router.push('/admin/contenu')} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}
