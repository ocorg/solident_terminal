'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { fail, ok, run } from '@/lib/action'
import { requireRole } from '@/lib/guards'
import { setRegistrationStatus } from '@/lib/registrations'

export async function updateRegistration(input: { id: string; status: string }) {
  return run(async () => {
    const { user } = await requireRole('admin', 'hr')
    const d = z.object({ id: z.uuid(), status: z.enum(['new', 'processed', 'cancelled']) }).parse(input)
    try {
      await setRegistrationStatus(d.id, d.status, user.id)
    } catch (e) {
      if (e instanceof Error && e.message.startsWith('Événement complet')) return fail(e.message)
      throw e
    }
    revalidatePath('/admin', 'layout')
    return ok(null)
  }, 'La mise à jour a échoué.')
}
