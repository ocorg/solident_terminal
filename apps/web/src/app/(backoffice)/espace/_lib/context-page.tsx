import Link from 'next/link'
import { notFound } from 'next/navigation'
import { prisma, type ContextType } from '@solident/db'
import { AvatarStack } from '@/components/space/avatar'
import { isContextManager, requireMemberPage } from '@/lib/space'
import { priorityRank, projectStatusLabel, projectStatusStyle, taskPriorityLabel, taskStatusLabel, taskStatusStyle } from '@/lib/space-labels'
import { taskFormData } from '../taches/data'
import { NewTaskButton } from '../taches/task-widgets'
import { ContextEditorToggle, CoverField, MembersManager } from './context-widgets'

const day = (d: Date) => d.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })

/** Shared detail page for a project or a cellule. */
export async function ContextPage({ type, id }: { type: ContextType; id: string }) {
  const user = await requireMemberPage()
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound()

  const ctx =
    type === 'project'
      ? await prisma.project.findUnique({
          where: { id },
          include: {
            positions: { orderBy: { name: 'asc' } },
            members: { include: { user: { select: { id: true, name: true, image: true } } } },
            children: { orderBy: { name: 'asc' } },
            parent: { select: { id: true, name: true } },
          },
        })
      : await prisma.cellule.findUnique({
          where: { id },
          include: { positions: { orderBy: { name: 'asc' } }, members: { include: { user: { select: { id: true, name: true, image: true } } } } },
        })
  if (!ctx) notFound()

  const [canManage, tasks, form, allProjects] = await Promise.all([
    isContextManager(user, type, id),
    prisma.task.findMany({
      where: { archived: false, OR: [{ contextType: type, contextId: id }, { contexts: { some: { contextType: type, contextId: id } } }] },
      include: { assignees: { include: { user: { select: { id: true, name: true, image: true } } } } },
    }),
    taskFormData(user),
    type === 'project' ? prisma.project.findMany({ orderBy: { name: 'asc' }, select: { id: true, name: true } }) : Promise.resolve([]),
  ])
  const project = type === 'project' ? (ctx as Extract<typeof ctx, { status: unknown }>) : null
  const open = tasks.filter((t) => t.status !== 'termine').sort((a, b) => priorityRank[a.priority] - priorityRank[b.priority])
  const done = tasks.length - open.length
  const progress = tasks.length ? Math.round((done / tasks.length) * 100) : 0
  const base = type === 'project' ? '/espace/projets' : '/espace/cellules'

  return (
    <div className="space-y-6">
      <Link href={base} className="text-sm font-semibold text-navy-700 hover:underline">
        ← {type === 'project' ? 'Projets' : 'Cellules'}
      </Link>
      <CoverField type={type} contextId={id} url={ctx.imageUrl} canManage={canManage} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-3xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-500">
            {type === 'project' ? 'Projet' : 'Cellule'}
            {project?.parent && (
              <>
                {' · sous-projet de '}
                <Link href={`/espace/projets/${project.parent.id}`} className="underline">
                  {project.parent.name}
                </Link>
              </>
            )}
          </p>
          <h1 className="font-heading text-3xl font-bold text-navy-900">
            {ctx.name}
            {project && <span className={`ms-3 rounded-full px-2 py-0.5 align-middle text-xs font-semibold ${projectStatusStyle[project.status]}`}>{projectStatusLabel[project.status]}</span>}
          </h1>
          {project && (project.startDate || project.endDate) && (
            <p className="text-sm text-ink-600">
              {project.startDate && day(project.startDate)} {project.endDate && `→ ${day(project.endDate)}`}
            </p>
          )}
          {ctx.description && <p className="mt-3 whitespace-pre-wrap text-ink-600">{ctx.description}</p>}
        </div>
        {canManage && (
          <ContextEditorToggle
            label="Modifier"
            type={type}
            projects={allProjects}
            canDelete={user.isSpaceAdmin}
                initial={{
                  id: ctx.id,
                  name: ctx.name,
                  description: ctx.description ?? '',
                  status: project?.status ?? 'actif',
                  startDate: project?.startDate?.toISOString().slice(0, 10) ?? '',
                  endDate: project?.endDate?.toISOString().slice(0, 10) ?? '',
                  parentProjectId: project?.parentProjectId ?? '',
                  isMultiActivite: project?.isMultiActivite ?? false,
                }}
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="space-y-3 lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="font-heading text-xl font-bold text-navy-700">
              Tâches <span className="text-sm font-normal text-ink-600">({done}/{tasks.length} terminées · {progress} %)</span>
            </h2>
            {form.contexts.some((c) => c.id === id) && <NewTaskButton contexts={form.contexts} people={form.people} defaultContextId={id} />}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-navy-100">
            <div className="h-full rounded-full bg-success" style={{ width: `${progress}%` }} />
          </div>
          {open.length === 0 ? (
            <p className="card p-5 text-ink-600">Aucune tâche ouverte.</p>
          ) : (
            <ul className="card divide-y divide-navy-100">
              {open.map((t) => (
                <li key={t.id}>
                  <Link href={`/espace/taches/${t.id}`} className="flex flex-wrap items-center gap-3 p-4 hover:bg-cream-50">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${taskStatusStyle[t.status]}`}>{taskStatusLabel[t.status]}</span>
                    <span className="min-w-40 flex-1 font-semibold">{t.title}</span>
                    <span className="text-xs">{taskPriorityLabel[t.priority]}</span>
                    <AvatarStack people={t.assignees.map((a) => a.user)} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link href={`/espace/taches?vue=toutes&contexte=${id}&statut=termine`} className="text-sm text-navy-700 underline">
            Voir les tâches terminées
          </Link>
        </section>

        <section className="space-y-3">
          <h2 className="font-heading text-xl font-bold text-navy-700">Équipe ({ctx.members.length})</h2>
          <div className="card p-5">
            <MembersManager
              type={type}
              contextId={id}
              canManage={canManage}
              positions={ctx.positions.map((p) => ({ id: p.id, name: p.name }))}
              members={ctx.members.map((m) => ({ userId: m.userId, name: m.user.name, image: m.user.image, positionId: m.positionId }))}
              people={form.people}
            />
          </div>
          {project && project.children.length > 0 && (
            <>
              <h2 className="pt-2 font-heading text-xl font-bold text-navy-700">Sous-projets</h2>
              <ul className="space-y-2">
                {project.children.map((c) => (
                  <li key={c.id}>
                    <Link href={`/espace/projets/${c.id}`} className="card card-hover flex items-center justify-between p-3 text-sm">
                      <span className="font-semibold">{c.name}</span>
                      <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${projectStatusStyle[c.status]}`}>{projectStatusLabel[c.status]}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
