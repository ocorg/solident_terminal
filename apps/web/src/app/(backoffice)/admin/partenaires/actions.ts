'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { requireRole } from '@/lib/guards'

const slugify = (s: string) =>
  s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 80)

const schema = z.object({
  id: z.uuid().optional(),
  name: z.string().trim().min(2).max(120),
  type: z.enum(['sponsor', 'association', 'ecole', 'universite', 'sport']),
  website: z
    .string()
    .trim()
    .max(300)
    .optional()
    .transform((v) => (v ? (/^https?:\/\//.test(v) ? v : `https://${v}`) : null))
    .refine((v) => v === null || z.url().safeParse(v).success, 'website'),
  isVisible: z.boolean(),
  order: z.number().int().min(0).max(999),
})

export type PartnerInput = z.input<typeof schema>

export async function savePartner(input: PartnerInput) {
  return run(async () => {
    const { user } = await requireRole('admin', 'media')
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail(parsed.error.issues.some((i) => i.message === 'website') ? 'Adresse du site invalide.' : 'Vérifiez les champs obligatoires.')
    const { id, ...data } = parsed.data

    let p
    if (id) {
      p = await prisma.partner.update({ where: { id }, data })
    } else {
      // Unique slug from the name (e.g. "MC Pharma" → mc-pharma, mc-pharma-2…)
      const base = slugify(data.name) || 'partenaire'
      let slug = base
      for (let i = 2; await prisma.partner.findUnique({ where: { slug }, select: { id: true } }); i++) slug = `${base}-${i}`
      p = await prisma.partner.create({ data: { ...data, slug } })
    }
    await prisma.auditLog.create({ data: { userId: user.id, action: id ? 'partner.update' : 'partner.create', entity: 'partner', entityId: p.id, payload: { name: p.name } } })
    revalidatePath('/[locale]', 'layout')
    revalidatePath('/admin/partenaires')
    return ok({ id: p.id })
  }, 'L’enregistrement a échoué.')
}
