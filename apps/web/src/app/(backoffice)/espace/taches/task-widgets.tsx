'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Btn, Sheet, SheetButton } from '@/components/ui'
import { askConfirm } from '@/components/ui/confirm-host'
import { IconArchive, IconEdit, IconPlus, IconTasks, IconTrash, IconUndo } from '@/components/ui/icons'
import { tagTone } from '@/components/ui/tones'
import { TASK_STATUSES, taskStatusLabel, taskStatusTone } from '@/lib/space-labels'
import type { TaskStatus } from '@solident/db'
import { addComment, deleteTask, setTaskArchived, setTaskStatus } from './actions'
import { TaskForm } from './task-form'

/** Status as a segmented control: the current status is filled with its colour. */
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
    <div className="grid grid-cols-2 gap-1 rounded-[12px] bg-navy-100/60 p-1 sm:grid-cols-4" role="radiogroup" aria-label="Statut de la tâche">
      {TASK_STATUSES.map((s) => (
        <button
          key={s}
          type="button"
          role="radio"
          aria-checked={s === status}
          disabled={!canChange || busy !== null}
          onClick={() => s !== status && change(s)}
          className={`min-h-11 rounded-[9px] px-3 text-sm font-semibold transition disabled:cursor-default ${
            s === status ? `${tagTone[taskStatusTone[s]]} shadow-sm ring-1 ring-black/5` : 'text-ink-600 hover:bg-white/70 hover:text-navy-900 disabled:hover:bg-transparent'
          }`}
        >
          {busy === s ? '…' : taskStatusLabel[s]}
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
      <Btn type="submit" variant="primary" busy={loading} className="self-end">
        Envoyer
      </Btn>
    </form>
  )
}

/** Task actions: edit (main), archive (quiet), delete (destructive, kept apart, confirmed). */
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
    const okToGo = await askConfirm({
      title: `Supprimer « ${task.title} » ?`,
      body: 'La tâche et ses commentaires seront supprimés définitivement. Pour la garder sans l’afficher, archivez-la plutôt.',
      confirm: 'Supprimer définitivement',
      danger: true,
    })
    if (!okToGo) return
    setBusy('delete')
    const res = await deleteTask({ id: task.id })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Tâche supprimée')
    router.push('/espace/taches')
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Btn variant="primary" icon={<IconEdit className="size-4" />} onClick={() => setEditing(true)}>
        Modifier
      </Btn>
      <Btn variant="quiet" icon={task.archived ? <IconUndo className="size-4" /> : <IconArchive className="size-4" />} busy={busy === 'archive'} disabled={busy !== null} onClick={archive}>
        {task.archived ? 'Désarchiver' : 'Archiver'}
      </Btn>
      <Btn variant="dangerQuiet" icon={<IconTrash className="size-4" />} busy={busy === 'delete'} disabled={busy !== null} onClick={remove} className="ms-auto">
        Supprimer
      </Btn>
      <Sheet open={editing} onClose={() => setEditing(false)} title="Modifier la tâche" subtitle={task.title} icon={<IconEdit />}>
        <TaskForm contexts={contexts} people={people} initial={task} onDone={() => setEditing(false)} />
      </Sheet>
    </div>
  )
}

export function NewTaskButton(props: Omit<React.ComponentProps<typeof TaskForm>, 'onDone'>) {
  return (
    <SheetButton label="Nouvelle tâche" icon={<IconPlus />} title="Nouvelle tâche" subtitle="Une chose à faire, pour qui, et pour quand." sheetIcon={<IconTasks />}>
      {(close) => <TaskForm {...props} onDone={close} />}
    </SheetButton>
  )
}
