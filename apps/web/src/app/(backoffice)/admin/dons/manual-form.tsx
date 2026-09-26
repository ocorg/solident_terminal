'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { addManual } from './actions'

type Option = { id: string; label: string }

export function ManualDonationForm({ campaigns, partners }: { campaigns: Option[]; partners: Option[] }) {
  const router = useRouter()
  const empty = { campaignId: campaigns[0]?.id ?? '', amount: '', kind: 'person' as 'person' | 'partner', donorName: '', partnerId: '', showOnWall: false, note: '' }
  const [form, setForm] = useState(empty)
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await addManual({
      campaignId: form.campaignId,
      amountDh: Number(form.amount),
      donorName: form.kind === 'person' ? form.donorName.trim() || undefined : undefined,
      partnerId: form.kind === 'partner' ? form.partnerId : '',
      showOnWall: form.kind === 'person' && form.showOnWall,
      note: form.note.trim() || undefined,
    })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Don ajouté et confirmé')
    setForm(empty)
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Ajouter un virement reçu
      </button>
    )
  }

  return (
    <form onSubmit={onSubmit} className="card space-y-4 p-5">
      <p className="font-semibold text-navy-700">Virement vu sur le relevé, sans déclaration (ajouté directement comme confirmé)</p>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="m-campaign" label="Campagne">
          <select id="m-campaign" value={form.campaignId} onChange={set('campaignId')} className={inputClass} required>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
        </Field>
        <Field id="m-amount" label="Montant (DH)">
          <input id="m-amount" type="number" min={1} step={1} required value={form.amount} onChange={set('amount')} className={inputClass} />
        </Field>
        <Field id="m-kind" label="De la part de">
          <select id="m-kind" value={form.kind} onChange={set('kind')} className={inputClass}>
            <option value="person">Un particulier</option>
            <option value="partner">Une entreprise / organisation (mur des sponsors)</option>
          </select>
        </Field>
      </div>
      {form.kind === 'person' ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="m-name" label="Nom (facultatif)">
            <input id="m-name" value={form.donorName} onChange={set('donorName')} maxLength={120} className={inputClass} />
          </Field>
          <label className="flex items-center gap-3 self-end pb-3 text-sm">
            <input type="checkbox" checked={form.showOnWall} onChange={set('showOnWall')} className="size-4 accent-navy-700" />
            Afficher le nom sur le mur des donateurs
          </label>
        </div>
      ) : (
        <Field id="m-partner" label="Partenaire">
          <select id="m-partner" value={form.partnerId} onChange={set('partnerId')} className={inputClass} required>
            <option value="">Choisir…</option>
            {partners.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <p className="text-xs text-ink-600">Le palier (Diamond, Gold…) est calculé automatiquement d’après le total confirmé du partenaire.</p>
        </Field>
      )}
      <Field id="m-note" label="Note interne (facultatif)">
        <input id="m-note" value={form.note} onChange={set('note')} maxLength={500} placeholder="ex. référence du relevé" className={inputClass} />
      </Field>
      <div className="flex gap-3">
        <div className="w-56">
          <SubmitButton loading={loading}>Ajouter le don</SubmitButton>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}
