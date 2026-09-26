'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { deleteMember, saveMember, type MemberInput } from './actions'

type Values = Omit<MemberInput, 'order'> & { order: string }

export function MemberEditor({ initial, nextOrder, onDone }: { initial?: MemberInput; nextOrder?: number; onDone?: () => void }) {
  const router = useRouter()
  const [v, setV] = useState<Values>({
    fullName: '', roleFr: '', roleAr: '', roleEn: '', phone: '', isPublicContact: false, isBoard: true,
    ...initial,
    order: String(initial?.order ?? nextOrder ?? 0),
  })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const set = (k: keyof Values) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setV((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const res = await saveMember({ ...v, order: Number(v.order) || 0 })
    setSaving(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Membre mis à jour' : 'Membre ajouté')
    router.refresh()
    onDone?.()
  }

  async function onDelete() {
    if (!initial?.id || !confirm(`Supprimer ${initial.fullName} ? Sa photo sera aussi supprimée.`)) return
    setDeleting(true)
    const res = await deleteMember({ id: initial.id })
    setDeleting(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Membre supprimé')
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-xl bg-cream-50 p-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id={`name-${initial?.id ?? 'new'}`} label="Nom complet *">
          <input id={`name-${initial?.id ?? 'new'}`} required minLength={2} maxLength={80} value={v.fullName} onChange={set('fullName')} className={inputClass} />
        </Field>
        <Field id={`phone-${initial?.id ?? 'new'}`} label="Téléphone (affiché si contact public)">
          <input id={`phone-${initial?.id ?? 'new'}`} dir="ltr" value={v.phone ?? ''} onChange={set('phone')} placeholder="+212612345678" className={`${inputClass} text-start`} />
        </Field>
        <Field id={`rfr-${initial?.id ?? 'new'}`} label="Rôle (français) *">
          <input id={`rfr-${initial?.id ?? 'new'}`} required minLength={2} maxLength={120} value={v.roleFr} onChange={set('roleFr')} className={inputClass} />
        </Field>
        <Field id={`rar-${initial?.id ?? 'new'}`} label="Rôle (arabe)">
          <input id={`rar-${initial?.id ?? 'new'}`} dir="rtl" maxLength={120} value={v.roleAr ?? ''} onChange={set('roleAr')} className={inputClass} />
        </Field>
        <Field id={`ren-${initial?.id ?? 'new'}`} label="Rôle (anglais)">
          <input id={`ren-${initial?.id ?? 'new'}`} maxLength={120} value={v.roleEn ?? ''} onChange={set('roleEn')} className={inputClass} />
        </Field>
        <Field id={`order-${initial?.id ?? 'new'}`} label="Ordre d’affichage (petit = en premier)">
          <input id={`order-${initial?.id ?? 'new'}`} type="number" min={0} max={999} value={v.order} onChange={set('order')} className={inputClass} />
        </Field>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.isBoard} onChange={set('isBoard')} className="size-4 accent-navy-700" />
          Membre du bureau (affiché sur « Qui sommes-nous »)
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={v.isPublicContact} onChange={set('isPublicContact')} className="size-4 accent-navy-700" />
          Contact public (téléphone affiché sur Contact et Sponsoring)
        </label>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <SubmitButton loading={saving}>{initial ? 'Enregistrer' : 'Ajouter'}</SubmitButton>
        </div>
        {onDone && (
          <button type="button" onClick={onDone} className="text-sm text-ink-600 underline">
            Annuler
          </button>
        )}
        {initial?.id && (
          <button type="button" onClick={onDelete} disabled={deleting} className="ms-auto inline-flex items-center gap-2 text-sm text-danger underline">
            {deleting && <Spinner />} Supprimer ce membre
          </button>
        )}
      </div>
    </form>
  )
}
