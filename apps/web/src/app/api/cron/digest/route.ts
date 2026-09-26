import { timingSafeEqual } from 'node:crypto'
import { prisma } from '@solident/db'
import { sendMail } from '@/lib/mail'
import { siteUrl } from '@/lib/site-url'

// Called every 15 min by cron-job.org with header "Authorization: Bearer <CRON_SECRET>".
// Sends ONE e-mail per member grouping their due notifications, then clears them from the queue.
export const dynamic = 'force-dynamic'

function authorized(req: Request) {
  const secret = process.env.CRON_SECRET
  const got = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? new URL(req.url).searchParams.get('key') ?? ''
  if (!secret || got.length !== secret.length) return false
  return timingSafeEqual(Buffer.from(got), Buffer.from(secret))
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

export async function GET(req: Request) {
  if (!authorized(req)) return Response.json({ error: 'unauthorized' }, { status: 401 })
  const due = await prisma.emailQueueItem.findMany({
    where: { sendAfter: { lte: new Date() } },
    orderBy: { createdAt: 'asc' },
    take: 500,
    include: { recipient: { select: { email: true, name: true, emailNotifications: true, isActive: true } } },
  })
  const byUser = new Map<string, typeof due>()
  for (const item of due) byUser.set(item.recipientId, [...(byUser.get(item.recipientId) ?? []), item])

  let sent = 0
  let failed = 0
  for (const [, items] of byUser) {
    const r = items[0].recipient
    const ids = items.map((i) => i.id)
    if (!r.isActive || !r.emailNotifications) {
      await prisma.emailQueueItem.deleteMany({ where: { id: { in: ids } } })
      continue
    }
    const lines = items.map((i) => String((i.payload as { message?: string }).message ?? ''))
    const url = `${siteUrl()}/espace/notifications`
    const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F;padding:32px 16px"><div style="max-width:520px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(18,58,79,.08)"><div style="background:#123A4F;padding:18px 24px;color:#fff;font-weight:700;font-size:18px">Solident<span style="color:#F4B223">.</span> espace membres</div><div style="padding:24px;line-height:1.6"><p style="margin:0 0 12px">Bonjour ${esc(r.name.split(' ')[0])},</p><ul style="padding-inline-start:18px;margin:0 0 20px;color:#4A5A66">${lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul><a href="${url}" style="display:inline-block;background:#1E5470;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Ouvrir l’espace membres</a><p style="margin:20px 0 0;font-size:12px;color:#4A5A66">Vous recevez ce récapitulatif car les e-mails sont activés dans vos paramètres.</p></div></div></body></html>`
    try {
      await sendMail(r.email, lines.length === 1 ? lines[0] : `${lines.length} nouveautés dans l’espace membres`, html, `${lines.map((l) => `• ${l}`).join('\n')}\n\n${url}`)
      await prisma.emailQueueItem.deleteMany({ where: { id: { in: ids } } })
      sent++
    } catch (e) {
      failed++ // kept in the queue, retried at the next run
      console.error('Digest failed for', r.email, e)
    }
  }
  return Response.json({ recipients: byUser.size, sent, failed })
}
