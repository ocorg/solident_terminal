'use server'

import { z } from 'zod'
import { ok, run } from '@/lib/action'
import { requireMember } from '@/lib/space'
import { loadMovements } from './queries'

/** Last movements of one item (item drawer). */
export async function getItemHistory(input: { itemId: string }) {
  return run(async () => {
    await requireMember()
    const itemId = z.uuid().parse(input.itemId)
    const { rows, total } = await loadMovements({ itemId })
    return ok({ rows, total })
  }, 'L’historique n’a pas pu être chargé.')
}
