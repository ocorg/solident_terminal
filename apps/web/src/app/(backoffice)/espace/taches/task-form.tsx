'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { TASK_PRIORITIES, taskPriorityLabel } from '@/lib/space-labels'
import { createTask, updateTask } from './actions'

type Ctx = { type: 'project' | 'cellule'; id: string; name: string; memberIds: string[] }
type Person = { id: string; name: string }
type Initial = { id: string; title: string; description: string; priority: string; dueDate: string; assigneeIds: string[]; contextId: string }

export function TaskForm({ contexts, people, initial, defaultContextId, onDone }: { contexts: Ctx[]; people: Person[]; initial?: Initial; defaultContextId?: string; onDone?: () => void }) {
  const router = useRouter()
  const [v, setV] = useState({
    title: initial?.title ?? '',
    description: initial?.description ?? '',
    priority: initial?.priority ?? 'moyen',
    dueDate: initial?.dueDate ?? '',
    contextId: initial?.contextId ?? defaultContextId ?? contexts[0]?.id ?? '',
    assigneeIds: initial?.assigneeIds ?? [],
  })
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(false)
  const ctx = contexts.find((c) => c.id === v.contextId)
  const set = (k: 'title' | 'description' | 'priority' | 'dueDate' | 'contextId') => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setV((f) => ({ ...f, [k]: e.target.value }))
  const toggle = (id: string) => setV((f) => ({ ...f, assigneeIds: f.assigneeIds.includes(id) ? f.assigneeIds.filter((x) => x !== id) : [...f.assigneeIds, id] }))

  // Context members first, then everyone else (filtered)
  const q = filter.toLowerCase()
  const sorted = [...people].sort((a, b) => Number(ctx?.memberIds.includes(b.id)) - Number(ctx?.memberIds.includes(a.id)) || a.name.localeCompare(b.name))
  const shown = sorted.filter((p) => v.assigneeIds.includes(p.id) || (q ? p.name.toLowerCase().includes(q) : ctx?.memberIds.includes(p.id)))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!ctx) return void toast.error('Choisissez un projet ou une cellule.')
    setLoading(true)
    const res = initial
      ? await updateTask({ id: initial.id, title: v.title, description: v.description, priority: v.priority as 'moyen', dueDate: v.dueDate, assigneeIds: v.assigneeIds })
      : await createTask({ contextType: ctx.type, contextId: ctx.id, title: v.title, description: v.description, priority: v.priority as 'moyen', dueDate: v.dueDate, assigneeIds: v.assigneeIds })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(initial ? 'Tâche mise à jour' : 'Tâche créée')
    router.refresh()
    if (onDone) onDone()
    else if (!initial && res.data) router.push(`/espace/taches/${(res.data as { id: string }).id}`)
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="t-title" label="Titre *">
        <input id="t-title" required minLength={2} maxLength={200} value={v.title} onChange={set('title')} className={inputClass} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field id="t-ctx" label="Projet / cellule">
          <select id="t-ctx" value={v.contextId} onChange={set('contextId')} disabled={!!initial} className={inputClass}>
            {(['project', 'cellule'] as const).map((type) => (
              <optgroup key={type} label={type === 'project' ? 'Projets' : 'Cellules'}>
                {contexts.filter((c) => c.type === type).map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
        <Field id="t-prio" label="Priorité">
          <select id="t-prio" value={v.priority} onChange={set('priority')} className={inputClass}>
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {taskPriorityLabel[p]}
              </option>
            ))}
          </select>
        </Field>
        <Field id="t-due" label="Échéance">
          <input id="t-due" type="date" value={v.dueDate} onChange={set('dueDate')} className={inputClass} />
        </Field>
      </div>
      <Field id="t-desc" label="Description">
        <textarea id="t-desc" rows={4} maxLength={5000} value={v.description} onChange={set('description')} className={inputClass} />
      </Field>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Assigné·e·s ({v.assigneeIds.length})</legend>
        <input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Chercher quelqu’un d’autre…" className={`${inputClass} max-w-xs py-2`} />
        <div className="grid max-h-48 gap-1 overflow-y-auto rounded-lg border border-navy-100 p-3 sm:grid-cols-2 lg:grid-cols-3">
          {shown.length === 0 && <p className="text-sm text-ink-600">Aucun membre dans ce contexte : cherchez un nom.</p>}
          {shown.map((p) => (
            <label key={p.id} className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={v.assigneeIds.includes(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-navy-700" />
              {p.name}
            </label>
          ))}
        </div>
      </fieldset>
      <div className="flex items-center gap-3">
        <div className="w-52">
          <SubmitButton loading={loading}>{initial ? 'Enregistrer' : 'Créer la tâche'}</SubmitButton>
        </div>
        {onDone && (
          <button type="button" onClick={onDone} className="text-sm text-ink-600 underline">
            Annuler
          </button>
        )}
      </div>
    </form>
  )
}
