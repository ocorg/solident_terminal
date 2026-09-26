'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { requireRole } from '@/lib/guards'
import { deleteObject, publicKeyFromUrl } from '@/lib/r2'

const opt = (max: number) => z.string().trim().max(max).optional().transform((v) => v || null)

const schema = z.object({
  id: z.uuid().optional(),
  fullName: z.string().trim().min(2).max(80),
  roleFr: z.string().trim().min(2).max(120),
  roleAr: opt(120),
  roleEn: opt(120),
  phone: z
    .string()
    .trim()
    .max(30)
    .optional()
    .transform((v) => (v ? v.replace(/[\s.-]/g, '') : null))
    .refine((v) => v === null || /^\+?\d{8,15}$/.test(v), 'phone'),
  isPublicContact: z.boolean(),
  isBoard: z.boolean(),
  order: z.number().int().min(0).max(999),
})

export type MemberInput = z.input<typeof schema>

function refresh() {
  revalidatePath('/[locale]', 'layout')
  revalidatePath('/admin/equipe')
}

export async function saveMember(input: MemberInput) {
  return run(async () => {
    const { user } = await requireRole('admin', 'media')
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues.some((i) => i.message === 'phone') ? 'Numéro de téléphone invalide (ex. +212612345678).' : 'Vérifiez les champs obligatoires.')
    const { id, ...data } = parsed.data
    if (data.isPublicContact && !data.phone) return fail('Un contact public doit avoir un numéro de téléphone.')
    const m = id ? await prisma.teamMember.update({ where: { id }, data }) : await prisma.teamMember.create({ data })
    await prisma.auditLog.create({ data: { userId: user.id, action: id ? 'team.update' : 'team.create', entity: 'team_member', entityId: m.id, payload: { fullName: m.fullName } } })
    refresh()
    return ok({ id: m.id })
  }, 'L’enregistrement a échoué.')
}

export async function deleteMember(input: { id: string }) {
  return run(async () => {
    const { user } = await requireRole('admin', 'media')
    const { id } = z.object({ id: z.uuid() }).parse(input)
    const m = await prisma.teamMember.delete({ where: { id } })
    await prisma.auditLog.create({ data: { userId: user.id, action: 'team.delete', entity: 'team_member', entityId: id, payload: { fullName: m.fullName } } })
    const key = publicKeyFromUrl(m.photoUrl)
    if (key) await deleteObject('public', key).catch((e) => console.error('Photo not deleted:', e))
    refresh()
    return ok(null)
  }, 'La suppression a échoué.')
}
