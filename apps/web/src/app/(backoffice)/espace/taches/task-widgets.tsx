'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { TASK_STATUSES, taskStatusLabel, taskStatusStyle } from '@/lib/space-labels'
import type { TaskStatus } from '@solident/db'
import { addComment, deleteTask, setTaskArchived, setTaskStatus } from './actions'
import { TaskForm } from './task-form'

export function StatusButtons({ id, status, canChange }: { id: string; status: TaskStatus; canChange: boolean }) {
  const router = useRouter()
  const [busy, setBusy] = useState<string | null>(null)
  async function change(s: TaskStatus) {
    setBusy(s)
    const res = await setTaskStatus({ id, status: s })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(`Statut : ${taskStatusLabel[s]}`)
    router.refresh()
  }
  return (
    <div className="flex flex-wrap gap-2">
      {TASK_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          disabled={!canChange || busy !== null || s === status}
          onClick={() => change(s)}
          className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm font-semibold transition active:scale-95 disabled:cursor-default ${
            s === status ? `${taskStatusStyle[s]} ring-2 ring-navy-700` : 'bg-white text-ink-600 shadow-card hover:bg-navy-100 disabled:opacity-50'
          }`}
        >
          {busy === s && <Spinner />}
          {taskStatusLabel[s]}
        </button>
      ))}
    </div>
  )
}

export function CommentForm({ taskId }: { taskId: string }) {
  const router = useRouter()
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await addComment({ taskId, content })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    setContent('')
    toast.success('Commentaire ajouté')
    router.refresh()
  }
  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-2 sm:flex-row">
      <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={2} maxLength={3000} required placeholder="Écrire un commentaire…" className={`${inputClass} flex-1`} />
      <button type="submit" disabled={loading} className="btn btn-primary self-end">
        {loading && <Spinner />} Envoyer
      </button>
    </form>
  )
}

export function ManageTask({
  task,
  contexts,
  people,
}: {
  task: { id: string; title: string; description: string; priority: string; dueDate: string; assigneeIds: string[]; contextId: string; archived: boolean }
  contexts: React.ComponentProps<typeof TaskForm>['contexts']
  people: React.ComponentProps<typeof TaskForm>['people']
}) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)

  async function archive() {
    setBusy('archive')
    const res = await setTaskArchived({ id: task.id, archived: !task.archived })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(task.archived ? 'Tâche désarchivée' : 'Tâche archivée')
    router.refresh()
  }
  async function remove() {
    if (!confirm(`Supprimer définitivement « ${task.title} » et ses commentaires ?`)) return
    setBusy('delete')
    const res = await deleteTask({ id: task.id })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Tâche supprimée')
    router.push('/espace/taches')
    router.refresh()
  }

  if (editing) {
    return (
      <div className="card p-5">
        <TaskForm contexts={contexts} people={people} initial={task} onDone={() => setEditing(false)} />
      </div>
    )
  }
  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={() => setEditing(true)} className="btn btn-ghost px-3 py-1.5 text-sm">
        Modifier
      </button>
      <button type="button" onClick={archive} disabled={busy !== null} className="btn btn-ghost px-3 py-1.5 text-sm">
        {busy === 'archive' && <Spinner />} {task.archived ? 'Désarchiver' : 'Archiver'}
      </button>
      <button type="button" onClick={remove} disabled={busy !== null} className="btn btn-ghost px-3 py-1.5 text-sm text-danger">
        {busy === 'delete' && <Spinner />} Supprimer
      </button>
    </div>
  )
}

export function NewTaskButton(props: Omit<React.ComponentProps<typeof TaskForm>, 'onDone'>) {
  const [open, setOpen] = useState(false)
  if (!open)
    return (
      <button type="button" onClick={() => setOpen(true)} className="btn btn-primary">
        + Nouvelle tâche
      </button>
    )
  return (
    <div className="card w-full p-5">
      <p className="mb-3 font-semibold text-navy-700">Nouvelle tâche</p>
      <TaskForm {...props} onDone={() => setOpen(false)} />
    </div>
  )
}
