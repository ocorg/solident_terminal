'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { createUploadUrl, deleteObject, publicKeyFromUrl, publicUrl } from '@/lib/r2'
import { requireMember } from '@/lib/space'

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  username: z.union([z.literal(''), z.string().trim().toLowerCase().regex(/^[a-z0-9._-]{3,30}$/)]).optional().transform((v) => v || null),
  emailNotifications: z.boolean(),
})

export async function saveProfile(input: z.input<typeof schema>) {
  return run(async () => {
    const user = await requireMember()
    const parsed = schema.safeParse(input)
    if (!parsed.success) return fail('Nom (2 caractères min.) ou identifiant invalide (3 à 30 caractères : lettres, chiffres, . _ -).')
    const d = parsed.data
    if (d.username && (await prisma.user.findFirst({ where: { username: d.username, NOT: { id: user.id } }, select: { id: true } }))) return fail('Cet identifiant est déjà pris.')
    await prisma.user.update({ where: { id: user.id }, data: d })
    revalidatePath('/espace', 'layout')
    return ok(null)
  }, 'L’enregistrement a échoué.')
}

export async function getAvatarUploadUrl(input: { contentType: string; size: number }) {
  return run(async () => {
    await requireMember()
    const d = z.object({ contentType: z.string().max(100), size: z.number().int() }).parse(input)
    const { key, uploadUrl } = await createUploadUrl({ bucket: 'public', kind: 'image', folder: 'avatars', contentType: d.contentType, size: d.size })
    return ok({ key, uploadUrl })
  }, 'Fichier refusé.')
}

export async function setAvatar(input: { key: string | null }) {
  return run(async () => {
    const user = await requireMember()
    const { key } = z.object({ key: z.string().nullable() }).parse(input)
    if (key && !/^avatars\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(key)) return fail('Fichier invalide.')
    const before = await prisma.user.findUnique({ where: { id: user.id }, select: { image: true } })
    await prisma.user.update({ where: { id: user.id }, data: { image: key ? publicUrl(key) : null } })
    const oldKey = publicKeyFromUrl(before?.image)
    if (oldKey) await deleteObject('public', oldKey).catch(() => {})
    revalidatePath('/espace', 'layout')
    return ok(null)
  }, 'La photo n’a pas pu être enregistrée.')
}
