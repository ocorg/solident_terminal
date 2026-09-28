'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { fail, ok, run } from '@/lib/action'
import { pushEnabled, sendPush } from '@/lib/push'
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
  endpoint: z.string().trim().startsWith('https://').max(2000),
  keys: z.object({ p256dh: z.string().min(20).max(300), auth: z.string().min(8).max(200) }),
  userAgent: z.string().max(300).optional(),
})

export async function savePushSubscription(input: z.input<typeof pushSchema>) {
  return run(async () => {
    const user = await requireMember()
    const parsed = pushSchema.safeParse(input)
    if (!parsed.success) {
      console.error('Push subscription rejected:', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '))
      return fail('Cet appareil n’a pas pu être enregistré. Désactivez puis réactivez les notifications.')
    }
    const d = parsed.data
    const data = { userId: user.id, p256dh: d.keys.p256dh, auth: d.keys.auth, userAgent: d.userAgent ?? null }
    await prisma.pushSubscription.upsert({ where: { endpoint: d.endpoint }, create: { endpoint: d.endpoint, ...data }, update: data })
    return ok({ saved: true })
  }, 'Les notifications n’ont pas pu être activées.')
}

export async function removePushSubscription(input: { endpoint: string }) {
  return run(async () => {
    const user = await requireMember()
    const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(input)
    await prisma.pushSubscription.deleteMany({ where: { endpoint, userId: user.id } })
    return ok({ removed: true })
  }, 'Les notifications n’ont pas pu être désactivées.')
}

/** Test on THIS device only (never other members): the client re-registers it just before. */
export async function sendTestPush(input: { endpoint: string }) {
  return run(async () => {
    const user = await requireMember()
    const { endpoint } = z.object({ endpoint: z.string().max(2000) }).parse(input)
    if (!pushEnabled) return fail('Les notifications ne sont pas configurées sur le serveur (clés VAPID manquantes).')
    const r = await sendPush([user.id], { title: 'Solident', body: 'Les notifications fonctionnent sur cet appareil.', url: '/espace/parametres', tag: 'test' }, { endpoint })
    if (r.sent) return ok({ sent: r.sent })
    if (!r.found) return fail('Cet appareil n’est pas enregistré. Désactivez puis réactivez les notifications.')
    const code = r.failures[0]
    if (code === 401 || code === 403) return fail('Le service de notification refuse nos clés (code ' + code + '). Les 3 variables VAPID de Vercel ne vont pas ensemble.')
    if (code === 404 || code === 410) return fail('Cet appareil n’est plus abonné. Réactivez les notifications.')
    return fail('Le service de notification a refusé l’envoi (code ' + (code || 'inconnu') + '). Réessayez dans un instant.')
  }, 'L’envoi du test a échoué.')
}
