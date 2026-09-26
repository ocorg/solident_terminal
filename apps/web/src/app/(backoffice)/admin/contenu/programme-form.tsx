'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { saveProgramme, type ProgrammeInput } from './actions'

const langs = [
  { key: 'Fr', label: 'Français', dir: 'ltr' },
  { key: 'Ar', label: 'العربية', dir: 'rtl' },
  { key: 'En', label: 'English', dir: 'ltr' },
] as const

export function ProgrammeForm({ initial }: { initial: ProgrammeInput }) {
  const router = useRouter()
  const [v, setV] = useState({ ...initial, order: String(initial.order) })
  const [lang, setLang] = useState<(typeof langs)[number]['key']>('Fr')
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setV((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await saveProgramme({ ...v, order: Number(v.order) || 0 })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Programme mis à jour')
    router.push('/admin/contenu')
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
          <Field id={`ptitle${l.key}`} label="Titre">
            <input id={`ptitle${l.key}`} value={v[`title${l.key}`] ?? ''} onChange={set(`title${l.key}`)} required={l.key === 'Fr'} maxLength={120} className={inputClass} />
          </Field>
          <Field id={`psum${l.key}`} label="Résumé (cartes et accueil)">
            <textarea id={`psum${l.key}`} rows={3} value={v[`summary${l.key}`] ?? ''} onChange={set(`summary${l.key}`)} maxLength={600} className={inputClass} />
          </Field>
          <Field id={`pbody${l.key}`} label="Présentation détaillée">
            <textarea id={`pbody${l.key}`} rows={6} value={v[`body${l.key}`] ?? ''} onChange={set(`body${l.key}`)} maxLength={8000} className={inputClass} />
          </Field>
        </div>
      ))}
      <div className="flex flex-wrap items-end gap-6">
        <Field id="porder" label="Ordre d’affichage">
          <input id="porder" type="number" min={0} max={999} value={v.order} onChange={set('order')} className={`${inputClass} w-32`} />
        </Field>
        <label className="flex items-center gap-2 pb-3 text-sm">
          <input type="checkbox" checked={v.isActive} onChange={set('isActive')} className="size-4 accent-navy-700" />
          Visible sur le site (page Programmes et accueil)
        </label>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-48">
          <SubmitButton loading={loading}>Enregistrer</SubmitButton>
        </div>
        <button type="button" onClick={() => router.push('/admin/contenu')} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}
