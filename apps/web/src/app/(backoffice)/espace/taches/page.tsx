import Link from 'next/link'
import { prisma, type Prisma, type TaskPriority, type TaskStatus } from '@solident/db'
import { AvatarStack } from '@/components/space/avatar'
import { contextNames, requireMemberPage } from '@/lib/space'
import { priorityRank, TASK_PRIORITIES, TASK_STATUSES, taskPriorityLabel, taskStatusLabel, taskStatusStyle } from '@/lib/space-labels'
import { taskFormData } from './data'
import { NewTaskButton } from './task-widgets'

export const metadata = { title: 'Tâches' }
const statusOrder: Record<TaskStatus, number> = { en_cours: 0, bloque: 1, a_faire: 2, termine: 3 }
const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', timeZone: 'Africa/Casablanca' })

export default async function TasksPage({ searchParams }: PageProps<'/espace/taches'>) {
  const user = await requireMemberPage()
  const sp = await searchParams
  const view = sp.vue === 'moi' ? 'moi' : 'toutes'
  const status = TASK_STATUSES.find((s) => s === sp.statut)
  const priority = TASK_PRIORITIES.find((p) => p === sp.priorite)
  const contextId = typeof sp.contexte === 'string' && /^[0-9a-f-]{36}$/.test(sp.contexte) ? sp.contexte : undefined
  const archived = sp.archives === '1'

  const where: Prisma.TaskWhereInput = {
    archived,
    ...(view === 'moi' && { assignees: { some: { userId: user.id } } }),
    ...(status && { status }),
    ...(priority && { priority }),
    ...(contextId && { OR: [{ contextId }, { contexts: { some: { contextId } } }] }),
  }
  const [tasks, names, form] = await Promise.all([
    prisma.task.findMany({ where, take: 300, include: { assignees: { include: { user: { select: { id: true, name: true, image: true } } } }, _count: { select: { comments: true } } } }),
    contextNames(),
    taskFormData(user),
  ])
  const now = new Date()
  tasks.sort((a, b) => statusOrder[a.status] - statusOrder[b.status] || priorityRank[a.priority] - priorityRank[b.priority] || (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))

  const q = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams(Object.entries({ vue: view, statut: status, priorite: priority, contexte: contextId, archives: archived ? '1' : undefined, ...patch }).filter((e): e is [string, string] => !!e[1]))
    return `/espace/taches${p.size ? `?${p}` : ''}`
  }
  const chip = (active: boolean) => `rounded-full px-3 py-1 text-sm font-semibold transition ${active ? 'bg-navy-700 text-white' : 'bg-white text-navy-700 hover:bg-navy-100'}`

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Tâches</h1>
        {form.contexts.length > 0 && <NewTaskButton contexts={form.contexts} people={form.people} defaultContextId={contextId} />}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={q({ vue: 'moi' })} className={chip(view === 'moi')}>
          Mes tâches
        </Link>
        <Link href={q({ vue: 'toutes' })} className={chip(view === 'toutes')}>
          Toutes
        </Link>
        <span className="mx-1 h-5 w-px bg-navy-100" />
        <Link href={q({ statut: undefined })} className={chip(!status)}>
          Tous statuts
        </Link>
        {TASK_STATUSES.map((s) => (
          <Link key={s} href={q({ statut: s })} className={chip(status === s)}>
            {taskStatusLabel[s]}
          </Link>
        ))}
      </div>
      <form className="flex flex-wrap items-center gap-2 text-sm" action="/espace/taches">
        <input type="hidden" name="vue" value={view} />
        {status && <input type="hidden" name="statut" value={status} />}
        <select name="contexte" defaultValue={contextId ?? ''} className="rounded-lg border border-navy-100 bg-white px-2 py-1.5">
          <option value="">Tous projets et cellules</option>
          {[...names.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select name="priorite" defaultValue={priority ?? ''} className="rounded-lg border border-navy-100 bg-white px-2 py-1.5">
          <option value="">Toutes priorités</option>
          {TASK_PRIORITIES.map((p: TaskPriority) => (
            <option key={p} value={p}>
              {taskPriorityLabel[p]}
            </option>
          ))}
        </select>
        <label className="flex items-center gap-1">
          <input type="checkbox" name="archives" value="1" defaultChecked={archived} className="accent-navy-700" /> Archivées
        </label>
        <button type="submit" className="btn btn-ghost px-3 py-1.5 text-sm">
          Filtrer
        </button>
      </form>

      {tasks.length === 0 ? (
        <p className="card p-6 text-ink-600">Aucune tâche ne correspond à ces filtres.</p>
      ) : (
        <ul className="card divide-y divide-navy-100">
          {tasks.map((t) => {
            const late = t.dueDate && t.dueDate < now && t.status !== 'termine'
            return (
              <li key={t.id}>
                <Link href={`/espace/taches/${t.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-cream-50">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${taskStatusStyle[t.status]}`}>{taskStatusLabel[t.status]}</span>
                  <span className="min-w-48 flex-1">
                    <span className="font-semibold">{t.title}</span>
                    <span className="block text-xs text-ink-600">
                      {names.get(t.contextId) ?? '—'}
                      {t._count.comments > 0 && ` · 💬 ${t._count.comments}`}
                    </span>
                  </span>
                  <span className="text-xs">{taskPriorityLabel[t.priority]}</span>
                  {t.dueDate && <span className={`text-xs ${late ? 'font-bold text-danger' : 'text-ink-600'}`}>{day(t.dueDate)}</span>}
                  <AvatarStack people={t.assignees.map((a) => a.user)} />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
