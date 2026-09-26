'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { ok, run } from '@/lib/action'
import { requireMember } from '@/lib/space'

export async function markRead(input: { id?: string }) {
  return run(async () => {
    const user = await requireMember()
    const { id } = z.object({ id: z.uuid().optional() }).parse(input)
    await prisma.notification.updateMany({ where: { recipientId: user.id, readAt: null, ...(id && { id }) }, data: { readAt: new Date() } })
    revalidatePath('/espace', 'layout')
    return ok(null)
  })
}
