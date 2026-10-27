import Link from 'next/link'
import { EmptyState, PageHeader, PriorityMark, SegmentedLinks, StatusTag } from '@/components/ui/blocks'
import { IconTasks } from '@/components/ui/icons'
import { prisma, type Prisma, type TaskPriority, type TaskStatus } from '@solident/db'
import { AvatarStack } from '@/components/space/avatar'
import { contextNames, requireMemberPage } from '@/lib/space'
import { priorityRank, TASK_PRIORITIES, TASK_STATUSES, taskPriorityLabel, taskPriorityColor, taskStatusLabel, taskStatusTone } from '@/lib/space-labels'
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

  return (
    <div className="space-y-5">
      <PageHeader
        title="Tâches"
        description="Ce que l’équipe a à faire, projet par projet."
        actions={form.contexts.length > 0 ? <NewTaskButton contexts={form.contexts} people={form.people} defaultContextId={contextId} /> : undefined}
      />

      <div className="flex flex-wrap items-center gap-3">
        <SegmentedLinks
          label="Tâches de qui"
          items={[
            { href: q({ vue: 'moi' }), label: 'Mes tâches', active: view === 'moi' },
            { href: q({ vue: 'toutes' }), label: 'Toute l’équipe', active: view === 'toutes' },
          ]}
        />
        <SegmentedLinks
          label="Statut"
          items={[
            { href: q({ statut: undefined }), label: 'Tous', active: !status },
            ...TASK_STATUSES.map((s) => ({ href: q({ statut: s }), label: taskStatusLabel[s], active: status === s })),
          ]}
        />
      </div>
      <form className="card flex flex-wrap items-center gap-2 p-3 text-sm" action="/espace/taches" data-no-guard>
        <input type="hidden" name="vue" value={view} />
        {status && <input type="hidden" name="statut" value={status} />}
        <select name="contexte" aria-label="Filtrer par projet ou cellule" defaultValue={contextId ?? ''} className="min-h-10 rounded-[10px] border border-navy-100 bg-white px-3">
          <option value="">Tous projets et cellules</option>
          {[...names.entries()].sort((a, b) => a[1].localeCompare(b[1])).map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
        <select name="priorite" aria-label="Filtrer par priorité" defaultValue={priority ?? ''} className="min-h-10 rounded-[10px] border border-navy-100 bg-white px-3">
          <option value="">Toutes priorités</option>
          {TASK_PRIORITIES.map((p: TaskPriority) => (
            <option key={p} value={p}>
              {taskPriorityLabel[p]}
            </option>
          ))}
        </select>
        <label className="flex min-h-10 items-center gap-1.5 px-1 text-ink-600">
          <input type="checkbox" name="archives" value="1" defaultChecked={archived} className="accent-navy-700" /> Archivées
        </label>
        <button type="submit" className="btn btn-ghost ms-auto min-h-10 px-4 py-0 text-sm">
          Appliquer
        </button>
      </form>

      {tasks.length === 0 ? (
        <EmptyState icon={<IconTasks />} title="Aucune tâche ici">
          Aucune tâche ne correspond à ces filtres. Essayez « Toute l’équipe » ou « Tous » les statuts.
        </EmptyState>
      ) : (
        <ul className="card divide-y divide-navy-100">
          {tasks.map((t) => {
            const late = t.dueDate && t.dueDate < now && t.status !== 'termine'
            return (
              <li key={t.id}>
                <Link href={`/espace/taches/${t.id}`} className="flex flex-wrap items-center gap-3 p-4 transition hover:bg-cream-50">
                  <StatusTag tone={taskStatusTone[t.status]} className="w-20 text-center">
                    {taskStatusLabel[t.status]}
                  </StatusTag>
                  <span className="min-w-48 flex-1">
                    <span className="font-semibold">{t.title}</span>
                    <span className="block text-xs text-ink-600">
                      {names.get(t.contextId) ?? '—'}
                      {t._count.comments > 0 && ` · ${t._count.comments} commentaire${t._count.comments > 1 ? 's' : ''}`}
                    </span>
                  </span>
                  <PriorityMark color={taskPriorityColor[t.priority]} label={taskPriorityLabel[t.priority]} />
                  {t.dueDate && <span className={`text-xs ${late ? 'font-bold text-danger' : 'text-ink-600'}`}>{late ? 'En retard · ' : ''}{day(t.dueDate)}</span>}
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
