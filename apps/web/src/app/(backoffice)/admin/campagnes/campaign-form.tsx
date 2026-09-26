'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { saveCampaign, type CampaignInput } from './actions'

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

type Values = Omit<CampaignInput, 'goalDh'> & { goalDh: string }
const langs = [
  { key: 'Fr', label: 'Français', dir: 'ltr' },
  { key: 'Ar', label: 'العربية', dir: 'rtl' },
  { key: 'En', label: 'English', dir: 'ltr' },
] as const

export function CampaignForm({ initial }: { initial?: CampaignInput }) {
  const router = useRouter()
  const [v, setV] = useState<Values>({
    slug: '', titleFr: '', titleAr: '', titleEn: '', summaryFr: '', summaryAr: '', summaryEn: '',
    startsOn: new Date().toISOString().slice(0, 10), endsOn: '', isActive: true,
    ...initial,
    goalDh: initial ? String(initial.goalDh) : '',
  })
  const [lang, setLang] = useState<(typeof langs)[number]['key']>('Fr')
  const [slugTouched, setSlugTouched] = useState(Boolean(initial))
  const [loading, setLoading] = useState(false)

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const value = e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value
    setV((f) => ({ ...f, [k]: value, ...(k === 'titleFr' && !slugTouched && { slug: slugify(String(value)) }) }))
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await saveCampaign({ ...v, goalDh: Number(v.goalDh) })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Campagne mise à jour' : 'Campagne créée')
    router.push('/admin/campagnes')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-5 p-6">
      {/* Language tabs (spec §7): French is required, AR/EN fall back to French when empty */}
      <div className="flex gap-1 border-b border-navy-100">
        {langs.map((l) => (
          <button
            key={l.key}
            type="button"
            onClick={() => setLang(l.key)}
            className={`px-4 py-2 text-sm font-semibold ${lang === l.key ? 'border-b-2 border-gold-500 text-navy-700' : 'text-ink-600'}`}
          >
            {l.label}
            {l.key === 'Fr' && ' *'}
          </button>
        ))}
      </div>
      {langs.map((l) => (
        <div key={l.key} hidden={lang !== l.key} dir={l.dir} className="space-y-4">
          <Field id={`title${l.key}`} label="Titre">
            <input id={`title${l.key}`} value={v[`title${l.key}`] ?? ''} onChange={set(`title${l.key}`)} required={l.key === 'Fr'} minLength={l.key === 'Fr' ? 3 : undefined} maxLength={120} className={inputClass} />
          </Field>
          <Field id={`summary${l.key}`} label="Résumé (affiché sous la barre de progression)">
            <textarea id={`summary${l.key}`} rows={3} value={v[`summary${l.key}`] ?? ''} onChange={set(`summary${l.key}`)} maxLength={1000} className={inputClass} />
          </Field>
        </div>
      ))}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Field id="goal" label="Objectif (DH)">
          <input id="goal" type="number" min={100} step={1} required value={v.goalDh} onChange={set('goalDh')} className={inputClass} />
        </Field>
        <Field id="starts" label="Début">
          <input id="starts" type="date" required value={v.startsOn} onChange={set('startsOn')} className={inputClass} />
        </Field>
        <Field id="ends" label="Fin (facultatif)">
          <input id="ends" type="date" value={v.endsOn ?? ''} onChange={set('endsOn')} className={inputClass} />
        </Field>
        <Field id="slug" label="Slug (adresse)">
          <input
            id="slug"
            required
            value={v.slug}
            onChange={(e) => {
              setSlugTouched(true)
              set('slug')(e)
            }}
            className={inputClass}
          />
        </Field>
      </div>
      <label className="flex items-center gap-3 text-sm">
        <input type="checkbox" checked={v.isActive} onChange={set('isActive')} className="size-4 accent-navy-700" />
        Active : visible sur le site et ouverte aux dons
      </label>
      <div className="flex items-center gap-3">
        <div className="w-60">
          <SubmitButton loading={loading}>{initial ? 'Enregistrer' : 'Créer la campagne'}</SubmitButton>
        </div>
        <button type="button" onClick={() => router.push('/admin/campagnes')} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}
