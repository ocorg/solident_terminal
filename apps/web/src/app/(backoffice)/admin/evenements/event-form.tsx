'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { saveEvent, type EventInput } from './actions'

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

export const eventTypes = [
  { value: 'solifun', label: 'Solifun' },
  { value: 'caravane', label: 'Caravane' },
  { value: 'scientifique', label: 'Journée scientifique' },
  { value: 'ambassadeurs', label: 'Jeunes ambassadeurs' },
  { value: 'autre', label: 'Autre' },
] as const

const langs = [
  { key: 'Fr', label: 'Français', dir: 'ltr' },
  { key: 'Ar', label: 'العربية', dir: 'rtl' },
  { key: 'En', label: 'English', dir: 'ltr' },
] as const

type Values = Omit<EventInput, 'capacity'> & { capacity: string }

export function EventForm({ initial, programmes }: { initial?: EventInput; programmes: { id: string; title: string }[] }) {
  const router = useRouter()
  const [v, setV] = useState<Values>({
    slug: '', type: 'solifun', programmeId: '', titleFr: '', titleAr: '', titleEn: '', bodyFr: '', bodyAr: '', bodyEn: '',
    startsAt: '', endsAt: '', location: '', registrationOpen: true, isPublished: false,
    ...initial,
    capacity: initial?.capacity ? String(initial.capacity) : '',
  })
  const [lang, setLang] = useState<(typeof langs)[number]['key']>('Fr')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [loading, setLoading] = useState(false)

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setV((f) => ({ ...f, [k]: value, ...(k === 'titleFr' && !slugTouched && { slug: slugify(String(value)) }) }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await saveEvent({ ...v, capacity: v.capacity })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Événement mis à jour' : 'Événement créé. Ajoutez une image de couverture si vous voulez.')
    router.push(initial ? '/admin/evenements' : `/admin/evenements/${res.data.id}`)
    router.refresh()
  }

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
          <Field id={`etitle${l.key}`} label="Titre">
            <input id={`etitle${l.key}`} value={v[`title${l.key}`] ?? ''} onChange={set(`title${l.key}`)} required={l.key === 'Fr'} minLength={l.key === 'Fr' ? 3 : undefined} maxLength={140} className={inputClass} />
          </Field>
          <Field id={`ebody${l.key}`} label="Description">
            <textarea id={`ebody${l.key}`} rows={6} value={v[`body${l.key}`] ?? ''} onChange={set(`body${l.key}`)} maxLength={5000} className={inputClass} />
          </Field>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Field id="etype" label="Type">
          <select id="etype" value={v.type} onChange={set('type')} className={inputClass}>
            {eventTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="eprog" label="Programme (facultatif)">
          <select id="eprog" value={v.programmeId ?? ''} onChange={set('programmeId')} className={inputClass}>
            <option value="">—</option>
            {programmes.map((p) => (
              <option key={p.id} value={p.id}>
                {p.title}
              </option>
            ))}
          </select>
        </Field>
        <Field id="eloc" label="Lieu">
          <input id="eloc" value={v.location ?? ''} onChange={set('location')} maxLength={160} className={inputClass} />
        </Field>
        <Field id="estart" label="Début (heure du Maroc) *">
          <input id="estart" type="datetime-local" required value={v.startsAt} onChange={set('startsAt')} className={inputClass} />
        </Field>
        <Field id="eend" label="Fin (facultatif)">
          <input id="eend" type="datetime-local" value={v.endsAt ?? ''} onChange={set('endsAt')} className={inputClass} />
        </Field>
        <Field id="ecap" label="Nombre de places (vide = illimité)">
          <input id="ecap" type="number" min={1} value={v.capacity} onChange={set('capacity')} className={inputClass} />
        </Field>
        <Field id="eslug" label="Slug (adresse)">
          <input id="eslug" required value={v.slug} onChange={(e) => (setSlugTouched(true), set('slug')(e))} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.isPublished} onChange={set('isPublished')} className="size-4 accent-navy-700" />
          Publié (visible sur le site)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.registrationOpen} onChange={set('registrationOpen')} className="size-4 accent-navy-700" />
          Inscriptions ouvertes (se ferment seules quand c’est complet)
        </label>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-60">
          <SubmitButton loading={loading}>{initial ? 'Enregistrer' : 'Créer l’événement'}</SubmitButton>
        </div>
        <button type="button" onClick={() => router.push('/admin/evenements')} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}
