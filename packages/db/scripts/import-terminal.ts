// Phase 4: copy Solident Terminal data from Supabase into Neon (members area of apps/web).
//   pnpm exec tsx scripts/import-terminal.ts            → dry run on dev (reads only, prints the plan)
//   pnpm exec tsx scripts/import-terminal.ts --write    → import into dev
//   DB_ENV_FILE=.env.production … --write              → import into production
// Supabase is only READ. Safe to re-run: existing rows (same id) are skipped.
import '../load-env'
import fs from 'node:fs'
import path from 'node:path'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { Prisma, prisma, type ApprovalStatus, type ContextType, type ProjectStatus, type Rsvp, type TaskPriority, type TaskStatus, type TeamEventType } from '../src/index'

const WRITE = process.argv.includes('--write')
const target = process.env.DB_ENV_FILE ? 'PRODUCTION' : 'dev'

function readEnv(file: string) {
  return Object.fromEntries(
    fs.readFileSync(file, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z0-9_]+=/.test(l)).map((l) => [l.split('=')[0], l.slice(l.indexOf('=') + 1).trim().replace(/^"|"$/g, '')]),
  )
}
const sb = readEnv(path.resolve('../../apps/terminal/.env.local'))
const web = readEnv(path.resolve('../../apps/web/.env.local'))
const SB_URL = sb.NEXT_PUBLIC_SUPABASE_URL
const SB_KEY = sb.SUPABASE_SERVICE_ROLE_KEY
const sbHeaders = { apikey: SB_KEY, Authorization: `Bearer ${SB_KEY}` }

async function rows<T = Record<string, unknown>>(table: string): Promise<T[]> {
  const r = await fetch(`${SB_URL}/rest/v1/${table}?select=*`, { headers: { ...sbHeaders, Range: '0-9999' } })
  if (!r.ok) throw new Error(`${table}: HTTP ${r.status}`)
  return r.json()
}

// ───────────── value maps (Terminal text → enums) ─────────────
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, '').trim().toLowerCase()
function mapper<T extends string>(name: string, table: Record<string, T>, fallback: T) {
  return (v: unknown): T => {
    if (v === null || v === undefined || v === '') return fallback
    const hit = table[norm(String(v))]
    if (!hit) {
      warnings.push(`${name}: unknown value "${v}" → ${fallback}`)
      return fallback
    }
    return hit
  }
}
const warnings: string[] = []
const projectStatus = mapper<ProjectStatus>('project status', { actif: 'actif', 'en pause': 'en_pause', bloque: 'bloque', termine: 'termine' }, 'actif')
const approval = mapper<ApprovalStatus>('approval', { 'en attente': 'en_attente', approuve: 'approuve', rejete: 'rejete' }, 'en_attente')
const taskStatus = mapper<TaskStatus>('task status', { 'a faire': 'a_faire', 'en cours': 'en_cours', bloque: 'bloque', termine: 'termine' }, 'a_faire')
const taskPriority = mapper<TaskPriority>('task priority', { urgent: 'urgent', eleve: 'eleve', moyen: 'moyen', faible: 'faible' }, 'moyen')
const eventType = mapper<TeamEventType>('event type', { activite: 'activite', action: 'action', reunion: 'reunion', evenement: 'evenement' }, 'reunion')
const rsvp = mapper<Rsvp>('rsvp', { oui: 'oui', non: 'non', 'en attente': 'en_attente' }, 'en_attente')
const ctx = (v: unknown): ContextType => (v === 'cellule' ? 'cellule' : 'project')

// ───────────── files: Supabase storage → R2 public bucket ─────────────
const s3 = new S3Client({
  region: 'auto',
  endpoint: `https://${web.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: { accessKeyId: web.R2_ACCESS_KEY_ID, secretAccessKey: web.R2_SECRET_ACCESS_KEY },
  requestChecksumCalculation: 'WHEN_REQUIRED',
})
const fileMap = new Map<string, string>() // "bucket/path" → new R2 URL

async function listAll(bucket: string, prefix = ''): Promise<string[]> {
  const r = await fetch(`${SB_URL}/storage/v1/object/list/${bucket}`, { method: 'POST', headers: { ...sbHeaders, 'Content-Type': 'application/json' }, body: JSON.stringify({ prefix, limit: 1000 }) })
  const items: { name: string; id: string | null }[] = await r.json()
  const out: string[] = []
  for (const it of items) {
    const p = prefix ? `${prefix}/${it.name}` : it.name
    if (it.id === null) out.push(...(await listAll(bucket, p))) // folder
    else if (it.name !== '.emptyFolderPlaceholder') out.push(p)
  }
  return out
}

async function copyFiles() {
  for (const bucket of ['avatars', 'covers', 'Logo_Solident']) {
    for (const p of await listAll(bucket)) {
      const key = `terminal/${bucket.toLowerCase()}/${p}`
      const url = `${web.R2_PUBLIC_URL.replace(/\/+$/, '')}/${key}`
      fileMap.set(`${bucket}/${p}`, url)
      if (!WRITE) continue
      const res = await fetch(`${SB_URL}/storage/v1/object/public/${bucket}/${encodeURI(p)}`)
      if (!res.ok) {
        warnings.push(`file ${bucket}/${p}: HTTP ${res.status}`)
        continue
      }
      const body = Buffer.from(await res.arrayBuffer())
      await s3.send(new PutObjectCommand({ Bucket: web.R2_PUBLIC_BUCKET, Key: key, Body: body, ContentType: res.headers.get('content-type') ?? 'application/octet-stream' }))
    }
  }
}

/** Rewrites a Supabase public storage URL to its R2 copy (drops cache-busting query strings). */
function newUrl(old: unknown): string | null {
  if (typeof old !== 'string' || !old) return null
  const m = old.split('?')[0].match(/\/storage\/v1\/object\/public\/([^/]+)\/(.+)$/)
  if (!m) return old
  const hit = fileMap.get(`${m[1]}/${decodeURI(m[2])}`)
  if (!hit) warnings.push(`no copied file for ${m[1]}/${m[2]}`)
  return hit ?? null
}

// ───────────── import ─────────────
type R = Record<string, any> // eslint-disable-line @typescript-eslint/no-explicit-any

async function main() {
  console.log(`Terminal import → ${target} (${WRITE ? 'WRITE' : 'dry run'})\n`)
  await copyFiles()
  console.log(`files: ${fileMap.size} (${WRITE ? 'copied to R2' : 'would copy'})`)

  const authUsers: { id: string; email: string }[] = (await fetch(`${SB_URL}/auth/v1/admin/users?per_page=1000`, { headers: sbHeaders }).then((r) => r.json())).users
  const emailById = new Map(authUsers.map((u) => [u.id, u.email.toLowerCase()]))
  const [profiles, prefs] = await Promise.all([rows<R>('profiles'), rows<R>('user_email_prefs')])
  const prefBy = new Map(prefs.map((p) => [p.user_id, p.email_enabled]))

  // Users: match by email; otherwise create with the Supabase UUID.
  const idMap = new Map<string, string>()
  const takenUsernames = new Set((await prisma.user.findMany({ where: { username: { not: null } }, select: { username: true } })).map((u) => u.username!))
  let matched = 0
  let created = 0
  for (const p of profiles) {
    const email = emailById.get(p.id)
    if (!email) {
      warnings.push(`profile ${p.full_name} has no auth email, skipped`)
      continue
    }
    const existing = await prisma.user.findUnique({ where: { email } })
    let username: string | null = p.username ? String(p.username).toLowerCase() : null
    if (username && takenUsernames.has(username) && existing?.username !== username) username = `${username}-${p.id.slice(0, 4)}`
    if (username) takenUsernames.add(username)
    if (existing) {
      idMap.set(p.id, existing.id)
      matched++
      if (WRITE)
        await prisma.user.update({
          where: { id: existing.id },
          data: {
            username: existing.username ?? username,
            image: existing.image ?? newUrl(p.avatar_url),
            emailNotifications: prefBy.get(p.id) ?? true,
            // Terminal admins get members-area rights only, never website admin.
            spaceAdmin: existing.spaceAdmin || !!p.is_admin,
          },
        })
    } else {
      idMap.set(p.id, p.id)
      created++
      if (WRITE)
        await prisma.user.create({
          data: {
            id: p.id,
            name: p.full_name || email,
            email,
            emailVerified: true,
            image: newUrl(p.avatar_url),
            role: 'member',
            spaceAdmin: !!p.is_admin,
            isActive: true,
            username,
            emailNotifications: prefBy.get(p.id) ?? true,
          },
        })
    }
  }
  console.log(`users: ${matched} matched to existing website accounts, ${created} ${WRITE ? 'created' : 'to create'}`)
  const uid = (id: unknown) => (typeof id === 'string' ? (idMap.get(id) ?? null) : null)

  const [cellules, cPos, cMem, projects, pPos, pMem, proposals, tasks, assignees, secCtx, comments, events, attendees, invites, notifs, config] = await Promise.all(
    ['cellules', 'cellule_positions', 'cellule_members', 'projects', 'project_positions', 'project_members', 'project_proposals', 'tasks', 'task_assignees', 'task_secondary_contexts', 'comments', 'events', 'event_attendees', 'event_context_invites', 'notifications', 'app_config'].map((t) => rows<R>(t)),
  )

  const plan: [string, number, () => Promise<unknown>][] = [
    ['cellules', cellules.length, () => prisma.cellule.createMany({ skipDuplicates: true, data: cellules.map((c) => ({ id: c.id, name: c.name, description: c.description, imageUrl: newUrl(c.image_url) })) })],
    ['cellule_positions', cPos.length, () => prisma.cellulePosition.createMany({ skipDuplicates: true, data: cPos.map((x) => ({ id: x.id, celluleId: x.cellule_id, name: x.position_name })) })],
    ['cellule_members', cMem.length, () => prisma.celluleMember.createMany({ skipDuplicates: true, data: cMem.filter((x) => uid(x.user_id)).map((x) => ({ id: x.id, celluleId: x.cellule_id, userId: uid(x.user_id)!, positionId: x.position_id })) })],
    [
      'projects',
      projects.length,
      async () => {
        await prisma.project.createMany({
          skipDuplicates: true,
          data: projects.map((p) => ({
            id: p.id, name: p.name, description: p.description, status: projectStatus(p.status), approvalStatus: approval(p.approval_status),
            isMultiActivite: !!p.is_multi_activite, proposedById: uid(p.proposed_by), imageUrl: newUrl(p.image_url),
            startDate: p.start_date ? new Date(`${p.start_date}T00:00:00Z`) : null, endDate: p.end_date ? new Date(`${p.end_date}T00:00:00Z`) : null, createdAt: new Date(p.created_at),
          })),
        })
        for (const p of projects.filter((x) => x.parent_project_id)) await prisma.project.update({ where: { id: p.id }, data: { parentProjectId: p.parent_project_id } })
      },
    ],
    ['project_positions', pPos.length, () => prisma.projectPosition.createMany({ skipDuplicates: true, data: pPos.map((x) => ({ id: x.id, projectId: x.project_id, name: x.position_name })) })],
    ['project_members', pMem.length, () => prisma.projectMember.createMany({ skipDuplicates: true, data: pMem.filter((x) => uid(x.user_id)).map((x) => ({ id: x.id, projectId: x.project_id, userId: uid(x.user_id)!, positionId: x.position_id })) })],
    [
      'project_proposals',
      proposals.length,
      () =>
        prisma.projectProposal.createMany({
          skipDuplicates: true,
          data: proposals.filter((x) => uid(x.proposed_by)).map((x) => ({
            id: x.id, title: x.title, description: x.description, type: x.type ?? 'Projet', isActivity: !!x.is_activity, parentProjectId: x.parent_project_id,
            proposedById: uid(x.proposed_by)!, suggestedChefId: uid(x.suggested_chef), status: approval(x.status), reviewNotes: x.review_notes,
            reviewedById: uid(x.reviewed_by), reviewedAt: x.reviewed_at ? new Date(x.reviewed_at) : null, createdAt: new Date(x.proposed_at),
          })),
        }),
    ],
    [
      'tasks',
      tasks.length,
      () =>
        prisma.task.createMany({
          skipDuplicates: true,
          data: tasks.filter((t) => uid(t.created_by)).map((t) => ({
            id: t.id, contextType: ctx(t.context_type), contextId: t.context_id, title: t.title, description: t.description,
            status: taskStatus(t.status), priority: taskPriority(t.priority), dueDate: t.due_date ? new Date(t.due_date) : null,
            startedAt: t.started_at ? new Date(t.started_at) : null, completedAt: t.completed_at ? new Date(t.completed_at) : null,
            archived: !!t.archived, createdById: uid(t.created_by)!, lastUpdatedById: uid(t.last_updated_by), createdAt: new Date(t.created_at),
          })),
        }),
    ],
    ['task_assignees', assignees.length, () => prisma.taskAssignee.createMany({ skipDuplicates: true, data: assignees.filter((x) => uid(x.user_id)).map((x) => ({ taskId: x.task_id, userId: uid(x.user_id)! })) })],
    ['task_contexts', secCtx.length, () => prisma.taskContext.createMany({ skipDuplicates: true, data: secCtx.map((x) => ({ id: x.id, taskId: x.task_id, contextType: ctx(x.context_type), contextId: x.context_id })) })],
    ['task_comments', comments.length, () => prisma.taskComment.createMany({ skipDuplicates: true, data: comments.filter((x) => uid(x.author_id)).map((x) => ({ id: x.id, taskId: x.task_id, authorId: uid(x.author_id)!, content: x.content, createdAt: new Date(x.created_at) })) })],
    [
      'team_events',
      events.length,
      () =>
        prisma.teamEvent.createMany({
          skipDuplicates: true,
          data: events.filter((e) => uid(e.created_by)).map((e) => ({
            id: e.id, title: e.title, description: e.description, type: eventType(e.type), contextType: (['project', 'cellule'].includes(e.context_type) ? e.context_type : 'global') as 'global',
            contextId: e.context_id, startAt: new Date(e.start_at), endAt: e.end_at ? new Date(e.end_at) : null, location: e.location,
            visibility: norm(String(e.visibility ?? '')).startsWith('invit') ? 'invites' : 'tous', createdById: uid(e.created_by)!, createdAt: new Date(e.created_at),
          })),
        }),
    ],
    ['team_event_attendees', attendees.length, () => prisma.teamEventAttendee.createMany({ skipDuplicates: true, data: attendees.filter((x) => uid(x.user_id)).map((x) => ({ eventId: x.event_id, userId: uid(x.user_id)!, rsvp: rsvp(x.rsvp_status) })) })],
    ['team_event_invites', invites.length, () => prisma.teamEventInvite.createMany({ skipDuplicates: true, data: invites.map((x) => ({ id: x.id, eventId: x.event_id, contextType: ctx(x.context_type), contextId: x.context_id })) })],
    [
      'notifications',
      notifs.length,
      () =>
        prisma.notification.createMany({
          skipDuplicates: true,
          data: notifs.filter((n) => uid(n.recipient_id)).map((n) => ({ id: n.id, recipientId: uid(n.recipient_id)!, type: n.type, targetId: n.target_id, message: n.message, createdAt: new Date(n.created_at), readAt: n.status === 'Lu' ? new Date(n.created_at) : null })),
        }),
    ],
    [
      'app_config → site_settings',
      config.length,
      async () => {
        for (const c of config) await prisma.siteSetting.upsert({ where: { key: `terminal.${c.key}` }, create: { key: `terminal.${c.key}`, value: String(c.value ?? '') }, update: {} })
      },
    ],
  ]

  for (const [name, count, run] of plan) {
    if (WRITE) await run()
    console.log(`${name.padEnd(28)} ${count} ${WRITE ? 'imported' : 'to import'}`)
  }
  if (!WRITE) {
    // Validate every value mapping even in dry run
    tasks.forEach((t) => (taskStatus(t.status), taskPriority(t.priority)))
    projects.forEach((p) => (projectStatus(p.status), approval(p.approval_status)))
  }
  console.log(warnings.length ? `\nWarnings:\n - ${[...new Set(warnings)].join('\n - ')}` : '\nNo warnings.')
}

main()
  .catch((e) => {
    console.error(e instanceof Prisma.PrismaClientKnownRequestError ? `${e.code}: ${e.message}` : e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
