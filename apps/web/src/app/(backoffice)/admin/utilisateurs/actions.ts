'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { requireRole } from '@/lib/guards'
import { sendMail } from '@/lib/mail'
import { siteUrl } from '@/lib/site-url'

const role = z.enum(['admin', 'treasurer', 'hr', 'media', 'member'])
const schema = z.object({ id: z.uuid(), isActive: z.boolean(), role })

/** Activate/deactivate and set the role in one call; deactivation also ends every session. */
export async function updateUser(input: z.input<typeof schema>) {
  return run(async () => {
    const { user: me } = await requireRole('admin')
    const d = schema.parse(input)
    if (d.id === me.id && (!d.isActive || d.role !== 'admin')) return fail('Vous ne pouvez pas retirer votre propre accès admin.')

    const before = await prisma.user.findUnique({ where: { id: d.id } })
    if (!before) return fail('Utilisateur introuvable.')

    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: d.id }, data: { isActive: d.isActive, role: d.role } })
      if (!d.isActive) await tx.session.deleteMany({ where: { userId: d.id } })
      await tx.auditLog.create({
        data: { userId: me.id, action: 'user.update', entity: 'user', entityId: d.id, payload: { from: { isActive: before.isActive, role: before.role }, to: { isActive: d.isActive, role: d.role } } },
      })
    })

    // Newly approved: tell them they can log in (never blocks the approval).
    if (!before.isActive && d.isActive) {
      const url = `${siteUrl()}/connexion`
      const html = `<!doctype html><html lang="fr"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F;padding:32px 16px"><div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(18,58,79,.08);line-height:1.6"><p style="margin:0 0 12px">Bonjour,</p><p style="margin:0 0 20px;color:#4A5A66">Votre compte Solident a été validé. Vous pouvez maintenant vous connecter avec votre e-mail et votre mot de passe.</p><a href="${url}" style="display:inline-block;background:#1E5470;color:#fff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Se connecter</a></div></body></html>`
      await sendMail(before.email, 'Votre compte Solident est validé', html, `Votre compte Solident a été validé. Connectez-vous : ${url}`).catch((e) =>
        console.error('Approval email failed:', e),
      )
    }

    revalidatePath('/admin', 'layout')
    return ok({ approved: !before.isActive && d.isActive })
  }, 'La mise à jour a échoué.')
}

/** Members-area admin rights (ex-Terminal admin), independent from the website role. */
export async function setSpaceAdmin(input: { id: string; value: boolean }) {
  return run(async () => {
    const { user: me } = await requireRole('admin')
    const d = z.object({ id: z.uuid(), value: z.boolean() }).parse(input)
    await prisma.$transaction([
      prisma.user.update({ where: { id: d.id }, data: { spaceAdmin: d.value } }),
      prisma.auditLog.create({ data: { userId: me.id, action: 'user.space_admin', entity: 'user', entityId: d.id, payload: { value: d.value } } }),
    ])
    revalidatePath('/admin', 'layout')
    return ok(null)
  }, 'La mise à jour a échoué.')
}
