'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { sendPush } from '@/lib/push'
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

// Phone notifications: one subscription per device (endpoint), always attached to the member who enabled it last.
const pushSchema = z.object({
  endpoint: z.url().max(1000).refine((u) => u.startsWith('https://'), 'https'),
  keys: z.object({ p256dh: z.string().min(20).max(200), auth: z.string().min(8).max(100) }),
  userAgent: z.string().max(300).optional(),
})

export async function savePushSubscription(input: z.input<typeof pushSchema>) {
  return run(async () => {
    const user = await requireMember()
    const d = pushSchema.parse(input)
    const data = { userId: user.id, p256dh: d.keys.p256dh, auth: d.keys.auth, userAgent: d.userAgent ?? null }
    await prisma.pushSubscription.upsert({ where: { endpoint: d.endpoint }, create: { endpoint: d.endpoint, ...data }, update: data })
    return ok({ saved: true })
  }, 'Les notifications n’ont pas pu être activées.')
}

export async function removePushSubscription(input: { endpoint: string }) {
  return run(async () => {
    const user = await requireMember()
    const { endpoint } = z.object({ endpoint: z.string().max(1000) }).parse(input)
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })
    return ok({ removed: true })
  }, 'Les notifications n’ont pas pu être désactivées.')
}

export async function sendTestPush() {
  return run(async () => {
    const user = await requireMember()
    const { sent } = await sendPush([user.id], { title: 'Solident', body: 'Les notifications fonctionnent sur cet appareil.', url: '/espace/parametres', tag: 'test' })
    if (!sent) return fail('Aucun appareil n’a reçu la notification. Réactivez-les puis réessayez.')
    return ok({ sent })
  }, 'L’envoi du test a échoué.')
}
