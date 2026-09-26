'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { prisma } from '@solident/db'
import { ok, run } from '@/lib/action'
import { requireRole } from '@/lib/guards'

export async function setVolunteerStatus(input: { id: string; status: string }) {
  return run(async () => {
    const { user } = await requireRole('admin', 'hr')
    const d = z.object({ id: z.uuid(), status: z.enum(['new', 'contacted', 'accepted', 'declined']) }).parse(input)
    await prisma.$transaction([
      prisma.volunteerApplication.update({ where: { id: d.id }, data: { status: d.status } }),
      prisma.auditLog.create({ data: { userId: user.id, action: 'volunteer.status', entity: 'volunteer_application', entityId: d.id, payload: { status: d.status } } }),
    ])
    revalidatePath('/admin', 'layout')
    return ok(null)
  }, 'La mise à jour a échoué.')
}
