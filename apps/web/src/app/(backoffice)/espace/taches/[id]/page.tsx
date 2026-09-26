import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma } from '@solident/db'
import { Avatar } from '@/components/space/avatar'
import { contextNames, requireMemberPage, taskRights } from '@/lib/space'
import { taskPriorityLabel } from '@/lib/space-labels'
import { dateToLocalInput } from '@/lib/tz'
import { taskFormData } from '../data'
import { CommentForm, ManageTask, StatusButtons } from '../task-widgets'

const when = (d: Date) => d.toLocaleString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Africa/Casablanca' })

export default async function TaskPage({ params }: PageProps<'/espace/taches/[id]'>) {
  const user = await requireMemberPage()
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()
  const { task, isManager, isAssignee } = await taskRights(user, id)
  if (!task) notFound()
  const [full, names, form] = await Promise.all([
    prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        assignees: { include: { user: { select: { id: true, name: true, image: true } } } },
        comments: { orderBy: { createdAt: 'asc' }, include: { author: { select: { name: true, image: true } } } },
        createdBy: { select: { name: true } },
        lastUpdatedBy: { select: { name: true } },
      },
    }),
    contextNames(),
    isManager ? taskFormData(user) : Promise.resolve(null),
  ])
  const ctxHref = `/espace/${full.contextType === 'project' ? 'projets' : 'cellules'}/${full.contextId}`

  return (
    <div className="space-y-6">
      <Link href="/espace/taches" className="text-sm font-semibold text-navy-700 hover:underline">
        ← Tâches
      </Link>
      <div className="card space-y-4 p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link href={ctxHref} className="text-sm font-semibold text-gold-500 hover:underline">
              {names.get(full.contextId) ?? '—'}
            </Link>
            <h1 className="font-heading text-2xl font-bold text-navy-900">
              {full.title}
              {full.archived && <span className="ms-2 rounded-full bg-navy-100 px-2 py-0.5 align-middle text-xs text-ink-600">archivée</span>}
            </h1>
          </div>
          {isManager && form && (
            <ManageTask
              contexts={form.contexts.some((c) => c.id === full.contextId) ? form.contexts : [...form.contexts, { type: full.contextType, id: full.contextId, name: names.get(full.contextId) ?? '—', memberIds: [] }]}
              people={form.people}
              task={{
                id: full.id,
                title: full.title,
                description: full.description ?? '',
                priority: full.priority,
                dueDate: full.dueDate ? dateToLocalInput(full.dueDate).slice(0, 10) : '',
                assigneeIds: full.assignees.map((a) => a.userId),
                contextId: full.contextId,
                archived: full.archived,
              }}
            />
          )}
        </div>
        <StatusButtons id={full.id} status={full.status} canChange={isManager || isAssignee} />
        <dl className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-ink-600">Priorité</dt>
            <dd className="font-semibold">{taskPriorityLabel[full.priority]}</dd>
          </div>
          <div>
            <dt className="text-ink-600">Échéance</dt>
            <dd className={`font-semibold ${full.dueDate && full.dueDate < new Date() && full.status !== 'termine' ? 'text-danger' : ''}`}>{full.dueDate ? when(full.dueDate) : '—'}</dd>
          </div>
          <div>
            <dt className="text-ink-600">Créée par</dt>
            <dd className="font-semibold">
              {full.createdBy.name} · {when(full.createdAt)}
            </dd>
          </div>
          <div>
            <dt className="text-ink-600">Dernière modification</dt>
            <dd className="font-semibold">
              {full.lastUpdatedBy?.name ?? '—'} · {when(full.updatedAt)}
            </dd>
          </div>
        </dl>
        {full.description && <p className="whitespace-pre-wrap text-ink-600">{full.description}</p>}
        <div>
          <p className="mb-2 text-sm text-ink-600">Assigné·e·s</p>
          {full.assignees.length === 0 ? (
            <p className="text-sm text-ink-600">Personne pour l’instant.</p>
          ) : (
            <ul className="flex flex-wrap gap-3">
              {full.assignees.map((a) => (
                <li key={a.userId} className="flex items-center gap-2 rounded-full bg-cream-50 py-1 pe-3 ps-1 text-sm">
                  <Avatar name={a.user.name} image={a.user.image} size="sm" /> {a.user.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <h2 className="font-heading text-lg font-bold text-navy-700">Commentaires ({full.comments.length})</h2>
        <ul className="space-y-3">
          {full.comments.map((c) => (
            <li key={c.id} className="card flex gap-3 p-4">
              <Avatar name={c.author.name} image={c.author.image} />
              <div>
                <p className="text-sm">
                  <span className="font-semibold">{c.author.name}</span> <span className="text-ink-600">· {when(c.createdAt)}</span>
                </p>
                <p className="whitespace-pre-wrap text-ink-600">{c.content}</p>
              </div>
            </li>
          ))}
        </ul>
        <CommentForm taskId={full.id} />
      </section>
    </div>
  )
}
