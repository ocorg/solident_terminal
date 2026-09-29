'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { shrinkImage } from '@/components/admin/upload'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { Avatar } from '@/components/space/avatar'
import { isManagementPosition, PROJECT_STATUSES, projectStatusLabel } from '@/lib/space-labels'
import { addPosition, deleteContext, getCoverUploadUrl, removeMember, removePosition, saveCellule, saveProject, setCover, setMember } from './context-actions'

type T = 'project' | 'cellule'
type Position = { id: string; name: string }
type Member = { userId: string; name: string; image: string | null; positionId: string }

/** Members grouped by position; managers can add, move, remove people and edit positions. */
export function MembersManager({ type, contextId, positions, members, people, canManage }: { type: T; contextId: string; positions: Position[]; members: Member[]; people: { id: string; name: string }[]; canManage: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  const [adding, setAdding] = useState({ userId: '', positionId: positions.find((p) => !isManagementPosition(p.name))?.id ?? positions[0]?.id ?? '' })
  const [newPos, setNewPos] = useState('')
  const memberIds = new Set(members.map((m) => m.userId))

  async function act(label: string, fn: () => Promise<{ status: string; message?: string }>, success: string) {
    setBusy(label)
    const res = await fn()
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(success)
    router.refresh()
  }

  return (
    <div className="space-y-4">
      {positions.map((pos) => {
        const inPos = members.filter((m) => m.positionId === pos.id)
        return (
          <div key={pos.id}>
            <div className="mb-2 flex items-center gap-2">
              <p className={`text-sm font-semibold ${isManagementPosition(pos.name) ? 'text-gold-700' : 'text-ink-600'}`}>
                {pos.name} ({inPos.length})
              </p>
              {canManage && inPos.length === 0 && (
                <button type="button" disabled={busy !== null} onClick={() => act(`pos-${pos.id}`, () => removePosition({ type, contextId, positionId: pos.id }), 'Poste supprimé')} className="text-xs text-danger underline">
                  supprimer le poste
                </button>
              )}
            </div>
            <ul className="flex flex-wrap gap-2">
              {inPos.map((m) => (
                <li key={m.userId} className="flex items-center gap-2 rounded-full bg-cream-50 py-1 pe-2 ps-1 text-sm">
                  <Avatar name={m.name} image={m.image} size="sm" />
                  {m.name}
                  {canManage && (
                    <>
                      <select
                        aria-label="Poste"
                        value={m.positionId}
                        disabled={busy !== null}
                        onChange={(e) => act(`m-${m.userId}`, () => setMember({ type, contextId, userId: m.userId, positionId: e.target.value }), 'Poste mis à jour')}
                        className="rounded-md border border-navy-100 bg-white px-1 py-0.5 text-xs"
                      >
                        {positions.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        aria-label={`Retirer ${m.name}`}
                        disabled={busy !== null}
                        onClick={() => confirm(`Retirer ${m.name} ?`) && act(`r-${m.userId}`, () => removeMember({ type, contextId, userId: m.userId }), 'Membre retiré')}
                        className="px-1 text-danger"
                      >
                        {busy === `r-${m.userId}` ? <Spinner /> : '×'}
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )
      })}

      {canManage && (
        <div className="grid gap-3 rounded-xl bg-cream-50 p-4 md:grid-cols-2">
          <form
            className="flex flex-wrap items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!adding.userId) return
              act('add', () => setMember({ type, contextId, ...adding }), 'Membre ajouté')
            }}
          >
            <select value={adding.userId} onChange={(e) => setAdding((a) => ({ ...a, userId: e.target.value }))} className={`${inputClass} flex-1 py-2`} aria-label="Personne">
              <option value="">Ajouter une personne…</option>
              {people.filter((p) => !memberIds.has(p.id)).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <select value={adding.positionId} onChange={(e) => setAdding((a) => ({ ...a, positionId: e.target.value }))} className={`${inputClass} w-40 py-2`} aria-label="Poste">
              {positions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
            <button type="submit" disabled={busy !== null || !adding.userId} className="btn btn-primary px-3 py-2 text-sm">
              {busy === 'add' && <Spinner />} Ajouter
            </button>
          </form>
          <form
            className="flex items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              act('pos', () => addPosition({ type, contextId, name: newPos }), 'Poste ajouté').then(() => setNewPos(''))
            }}
          >
            <input value={newPos} onChange={(e) => setNewPos(e.target.value)} minLength={2} maxLength={60} required placeholder="Nouveau poste (ex. Trésorier du projet)" className={`${inputClass} flex-1 py-2`} />
            <button type="submit" disabled={busy !== null} className="btn btn-ghost px-3 py-2 text-sm">
              + Poste
            </button>
          </form>
          <p className="text-xs text-ink-600 md:col-span-2">Les postes dont le nom ne contient pas « membre » donnent les droits de responsable (gérer les tâches et l’équipe).</p>
        </div>
      )}
    </div>
  )
}

/** Cover image for a project or cellule (managers), resized in the browser. */
export function CoverField({ type, contextId, url, canManage }: { type: T; contextId: string; url: string | null; canManage: boolean }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  async function onFile(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const small = await shrinkImage(file, 1600)
      const res = await getCoverUploadUrl({ type, contextId, contentType: small.type, size: small.size })
      if (res.status === 'error') throw new Error(res.message)
      const put = await fetch(res.data.uploadUrl, { method: 'PUT', body: small, headers: { 'Content-Type': small.type } })
      if (!put.ok) throw new Error('Envoi refusé par le stockage')
      const saved = await setCover({ type, contextId, key: res.data.key })
      if (saved.status === 'error') throw new Error(saved.message)
      toast.success('Image mise à jour')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'L’envoi a échoué.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }
  return (
    <div className="relative h-44 overflow-hidden rounded-xl bg-gradient-to-br from-navy-700 to-navy-900">
      {url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="absolute inset-0 size-full object-cover" />
      )}
      {canManage && (
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="absolute bottom-3 end-3 inline-flex items-center gap-2 rounded-lg bg-white/90 px-3 py-1.5 text-sm font-semibold text-navy-700">
          {busy && <Spinner />} {url ? 'Changer l’image' : 'Ajouter une image'}
        </button>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  )
}

type ProjectValues = { id?: string; name: string; description: string; status: string; startDate: string; endDate: string; parentProjectId: string; isMultiActivite: boolean }

export function ContextEditor({ type, initial, projects = [], onDone, canDelete }: { type: T; initial?: ProjectValues; projects?: { id: string; name: string }[]; onDone?: () => void; canDelete?: boolean }) {
  const router = useRouter()
  const [v, setV] = useState<ProjectValues>(initial ?? { name: '', description: '', status: 'actif', startDate: '', endDate: '', parentProjectId: '', isMultiActivite: false })
  const [loading, setLoading] = useState(false)
  const set = (k: keyof ProjectValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = type === 'project' ? await saveProject({ ...v, status: v.status as 'actif' }) : await saveCellule({ id: v.id, name: v.name, description: v.description })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Enregistré' : type === 'project' ? 'Projet créé' : 'Cellule créée')
    if (!initial) router.push(`/espace/${type === 'project' ? 'projets' : 'cellules'}/${res.data.id}`)
    router.refresh()
    onDone?.()
  }
  async function onDelete() {
    if (!v.id || !confirm(`Supprimer « ${v.name} », ses postes, ses membres et TOUTES ses tâches ?`)) return
    setLoading(true)
    const res = await deleteContext({ type, id: v.id })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Supprimé')
    router.push(`/espace/${type === 'project' ? 'projets' : 'cellules'}`)
    router.refresh()
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="c-name" label="Nom *">
        <input id="c-name" required minLength={2} maxLength={120} value={v.name} onChange={set('name')} className={inputClass} />
      </Field>
      <Field id="c-desc" label="Description">
        <textarea id="c-desc" rows={4} maxLength={5000} value={v.description} onChange={set('description')} className={inputClass} />
      </Field>
      {type === 'project' && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Field id="c-status" label="Statut">
            <select id="c-status" value={v.status} onChange={set('status')} className={inputClass}>
              {PROJECT_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {projectStatusLabel[s]}
                </option>
              ))}
            </select>
          </Field>
          <Field id="c-start" label="Début">
            <input id="c-start" type="date" value={v.startDate} onChange={set('startDate')} className={inputClass} />
          </Field>
          <Field id="c-end" label="Fin">
            <input id="c-end" type="date" value={v.endDate} onChange={set('endDate')} className={inputClass} />
          </Field>
          <Field id="c-parent" label="Projet parent">
            <select id="c-parent" value={v.parentProjectId} onChange={set('parentProjectId')} className={inputClass}>
              <option value="">—</option>
              {projects.filter((p) => p.id !== v.id).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </Field>
          <label className="flex items-center gap-2 text-sm sm:col-span-2">
            <input type="checkbox" checked={v.isMultiActivite} onChange={set('isMultiActivite')} className="size-4 accent-navy-700" />
            Projet multi-activités (regroupe des sous-projets)
          </label>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-48">
          <SubmitButton loading={loading}>{initial ? 'Enregistrer' : 'Créer'}</SubmitButton>
        </div>
        {onDone && (
          <button type="button" onClick={onDone} className="text-sm text-ink-600 underline">
            Annuler
          </button>
        )}
        {canDelete && v.id && (
          <button type="button" onClick={onDelete} className="ms-auto text-sm text-danger underline">
            Supprimer
          </button>
        )}
      </div>
    </form>
  )
}

export function EditToggle({ label, children }: { label: string; children: (close: () => void) => React.ReactNode }) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-ghost px-3 py-1.5 text-sm">
        {label}
      </button>
    )
  return <div className="card w-full p-5">{children(() => setOpen(false))}</div>
}

/** Button that opens the project/cellule editor (serializable props only, usable from server pages). */
export function ContextEditorToggle({ label, ...props }: { label: string } & Omit<React.ComponentProps<typeof ContextEditor>, 'onDone'>) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className={label.startsWith('+') ? 'btn btn-primary' : 'btn btn-ghost px-3 py-1.5 text-sm'}>
        {label}
      </button>
    )
  return (
    <div className="card w-full p-5">
      <ContextEditor {...props} onDone={() => setOpen(false)} />
    </div>
  )
}
