'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { rsvpLabel, TEAM_EVENT_TYPES, teamEventTypeLabel } from '@/lib/space-labels'
import type { Rsvp } from '@solident/db'
import { deleteTeamEvent, saveTeamEvent, setRsvp, type TeamEventInput } from './actions'

type Ref = { ref: string; name: string }

export function TeamEventForm({ contexts, people, initial, onDone }: { contexts: Ref[]; people: { id: string; name: string }[]; initial?: TeamEventInput; onDone: () => void }) {
  const router = useRouter()
  const [v, setV] = useState<TeamEventInput>(
    initial ?? { title: '', description: '', type: 'reunion', contextRef: '', startAt: '', endAt: '', location: '', visibility: 'tous', inviteContexts: [], inviteUserIds: [] },
  )
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const set = (k: keyof TeamEventInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setV((f) => ({ ...f, [k]: e.target.value }))
  const toggle = (k: 'inviteContexts' | 'inviteUserIds', id: string) => setV((f) => ({ ...f, [k]: f[k].includes(id) ? f[k].filter((x) => x !== id) : [...f[k], id] }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await saveTeamEvent(v)
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Événement mis à jour' : 'Événement créé, invitations envoyées')
    router.refresh()
    onDone()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="e-title" label="Titre *">
          <input id="e-title" required minLength={2} maxLength={160} value={v.title} onChange={set('title')} className={inputClass} />
        </Field>
        <Field id="e-type" label="Type">
          <select id="e-type" value={v.type} onChange={set('type')} className={inputClass}>
            {TEAM_EVENT_TYPES.map((t) => (
              <option key={t} value={t}>
                {teamEventTypeLabel[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="e-ctx" label="Lié à">
          <select id="e-ctx" value={v.contextRef} onChange={set('contextRef')} className={inputClass}>
            <option value="">Toute l’association</option>
            {contexts.map((c) => (
              <option key={c.ref} value={c.ref}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="e-start" label="Début (heure du Maroc) *">
          <input id="e-start" type="datetime-local" required value={v.startAt} onChange={set('startAt')} className={inputClass} />
        </Field>
        <Field id="e-end" label="Fin">
          <input id="e-end" type="datetime-local" value={v.endAt} onChange={set('endAt')} className={inputClass} />
        </Field>
        <Field id="e-loc" label="Lieu / lien visio">
          <input id="e-loc" maxLength={160} value={v.location ?? ''} onChange={set('location')} className={inputClass} />
        </Field>
      </div>
      <Field id="e-desc" label="Description / ordre du jour">
        <textarea id="e-desc" rows={3} maxLength={3000} value={v.description ?? ''} onChange={set('description')} className={inputClass} />
      </Field>
      <div className="flex flex-wrap gap-6 text-sm">
        {(['tous', 'invites'] as const).map((vis) => (
          <label key={vis} className="flex items-center gap-2">
            <input type="radio" name="vis" checked={v.visibility === vis} onChange={() => setV((f) => ({ ...f, visibility: vis }))} className="accent-navy-700" />
            {vis === 'tous' ? 'Visible par tous les membres' : 'Invités seulement'}
          </label>
        ))}
      </div>
      <fieldset className="grid gap-3 md:grid-cols-2">
        <div>
          <legend className="mb-1 text-sm font-medium">Inviter des équipes entières</legend>
          <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-navy-100 p-3">
            {contexts.map((c) => (
              <label key={c.ref} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={v.inviteContexts.includes(c.ref)} onChange={() => toggle('inviteContexts', c.ref)} className="size-4 accent-navy-700" />
                {c.name}
              </label>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-sm font-medium">…ou des personnes ({v.inviteUserIds.length})</p>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Chercher…" className={`${inputClass} mb-1 py-1.5`} />
          <div className="max-h-32 space-y-1 overflow-y-auto rounded-lg border border-navy-100 p-3">
            {people.filter((p) => v.inviteUserIds.includes(p.id) || (q && p.name.toLowerCase().includes(q.toLowerCase()))).map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={v.inviteUserIds.includes(p.id)} onChange={() => toggle('inviteUserIds', p.id)} className="size-4 accent-navy-700" />
                {p.name}
              </label>
            ))}
          </div>
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <div className="w-52">
          <SubmitButton loading={loading}>{initial ? 'Enregistrer' : 'Créer et inviter'}</SubmitButton>
        </div>
        <button type="button" onClick={onDone} className="text-sm text-ink-600 underline">
          Annuler
        </button>
      </div>
    </form>
  )
}

export function TeamEventFormToggle({ label, ...props }: { label: string } & Omit<React.ComponentProps<typeof TeamEventForm>, 'onDone'>) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={label.startsWith('+') ? 'btn btn-primary' : 'text-sm text-navy-700 underline'}>
        {label}
      </button>
    )
  return (
    <div className="card w-full p-5">
      <TeamEventForm {...props} onDone={() => setOpen(false)} />
    </div>
  )
}

export function RsvpButtons({ eventId, current }: { eventId: string; current: Rsvp | null }) {
  const router = useRouter()
  const [busy, setBusy] = useState<Rsvp | null>(null)
  async function answer(r: Rsvp) {
    setBusy(r)
    const res = await setRsvp({ eventId, rsvp: r })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(`Réponse : ${rsvpLabel[r]}`)
    router.refresh()
  }
  return (
    <div className="flex items-center gap-1">
      <span className="me-1 text-xs text-ink-600">Je viens :</span>
      {(['oui', 'non'] as const).map((r) => (
        <button
          key={r}
          type="button"
          onClick={() => answer(r)}
          disabled={busy !== null || current === r}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition active:scale-95 ${current === r ? (r === 'oui' ? 'bg-success text-white' : 'bg-danger text-white') : 'bg-white text-navy-700 shadow-card hover:bg-navy-100'}`}
        >
          {busy === r && <Spinner />}
          {rsvpLabel[r]}
        </button>
      ))}
    </div>
  )
}

export function DeleteTeamEvent({ id, title }: { id: string; title: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        if (!confirm(`Supprimer « ${title} » ?`)) return
        setBusy(true)
        const res = await deleteTeamEvent({ id })
        setBusy(false)
        if (res.status === 'error') return void toast.error(res.message)
        toast.success('Événement supprimé')
        router.refresh()
      }}
      className="inline-flex items-center gap-1 text-sm text-danger underline"
    >
      {busy && <Spinner />} Supprimer
    </button>
  )
}
