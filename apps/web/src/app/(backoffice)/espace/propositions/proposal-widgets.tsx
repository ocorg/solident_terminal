'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { reviewProposal, submitProposal, withdrawProposal } from './actions'

export function ProposalForm({ projects, people }: { projects: { id: string; name: string }[]; people: { id: string; name: string }[] }) {
  const router = useRouter()
  const empty = { title: '', description: '', isActivity: false, parentProjectId: '', suggestedChefId: '' }
  const [open, setOpen] = useState(false)
  const [v, setV] = useState(empty)
  const [loading, setLoading] = useState(false)
  const set = (k: keyof typeof v) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await submitProposal(v)
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Proposition envoyée aux administrateurs')
    setV(empty)
    setOpen(false)
    router.refresh()
  }

  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Proposer un projet
      </button>
    )
  return (
    <form onSubmit={onSubmit} className="card w-full space-y-4 p-5">
      <Field id="p-title" label="Titre *">
        <input id="p-title" required minLength={3} maxLength={160} value={v.title} onChange={set('title')} className={inputClass} />
      </Field>
      <Field id="p-desc" label="Description (objectif, public, besoins…)">
        <textarea id="p-desc" rows={4} maxLength={5000} value={v.description} onChange={set('description')} className={inputClass} />
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.isActivity} onChange={set('isActivity')} className="size-4 accent-navy-700" />
        C’est une activité d’un projet existant
      </label>
      <div className="grid gap-4 sm:grid-cols-2">
        {v.isActivity && (
          <Field id="p-parent" label="Projet de rattachement *">
            <select id="p-parent" required value={v.parentProjectId} onChange={set('parentProjectId')} className={inputClass}>
              <option value="">Choisir…</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        <Field id="p-chef" label="Chef·fe de projet suggéré·e">
          <select id="p-chef" value={v.suggestedChefId} onChange={set('suggestedChefId')} className={inputClass}>
            <option value="">—</option>
            {people.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <div className="flex items-center gap-3">
        <div className="w-48">
          <SubmitButton loading={loading}>Envoyer</SubmitButton>
        </div>
        <button type="button" onClick={() => setOpen(false)} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}

export function ReviewButtons({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  async function decide(decision: 'approuve' | 'rejete') {
    setBusy(decision)
    const res = await reviewProposal({ id, decision, notes: notes || undefined })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(decision === 'approuve' ? 'Approuvée : le projet est créé' : 'Proposition rejetée')
    if (decision === 'approuve' && res.data.projectId) router.push(`/espace/projets/${res.data.projectId}`)
    router.refresh()
  }
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} placeholder="Note pour l’auteur·e (facultatif)" className={`${inputClass} flex-1 py-2`} />
      <button type="button" disabled={busy !== null} onClick={() => decide('approuve')} className="btn bg-success px-3 py-2 text-sm text-white">
        {busy === 'approuve' && <Spinner />} Approuver
      </button>
      <button type="button" disabled={busy !== null} onClick={() => decide('rejete')} className="btn btn-ghost px-3 py-2 text-sm text-danger">
        {busy === 'rejete' && <Spinner />} Rejeter
      </button>
    </div>
  )
}

export function WithdrawButton({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Retirer cette proposition ?')) return
        setBusy(true)
        const res = await withdrawProposal({ id })
        setBusy(false)
        if (res.status === 'error') return void toast.error(res.message)
        toast.success('Proposition retirée')
        router.refresh()
      }}
      className="inline-flex items-center gap-1 text-sm text-danger underline"
    >
      {busy && <Spinner />} Retirer
    </button>
  )
}
