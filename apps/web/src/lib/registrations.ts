import 'server-only'
import { revalidatePath } from 'next/cache'
import { prisma, type Prisma, type Profile, type RegistrationStatus } from '@solident/db'
import { broadcast } from './pusher'
import { channels } from './realtime'

type Tx = Prisma.TransactionClient
type EventRow = { id: string; capacity: number | null; registrationOpen: boolean; isPublished: boolean; startsAt: Date; endsAt: Date | null }

/** Active registrations take a place; cancelled ones free it. */
export async function takenPlaces(tx: Tx | typeof prisma, eventId: string) {
  return tx.registration.count({ where: { eventId, status: { not: 'cancelled' } } })
}

/** Registration is possible while the event is published, open, not over and not full. */
export function registrationState(e: EventRow, taken: number) {
  const over = (e.endsAt ?? e.startsAt) < new Date()
  const placesLeft = e.capacity === null ? null : Math.max(0, e.capacity - taken)
  const open = e.isPublished && e.registrationOpen && !over && placesLeft !== 0
  return { open, placesLeft, over }
}

async function publishPlaces(eventId: string) {
  try {
    const e = await prisma.event.findUniqueOrThrow({ where: { id: eventId } })
    const { open, placesLeft } = registrationState(e, await takenPlaces(prisma, eventId))
    await broadcast(channels.event(eventId), 'places-updated', { placesLeft, registrationOpen: open })
  } catch (err) {
    console.error('Places broadcast failed (registration is saved anyway):', err)
  }
  try {
    revalidatePath('/[locale]', 'layout')
  } catch (err) {
    console.error('Cache refresh failed:', err)
  }
}

export type RegisterResult = 'ok' | 'errClosed' | 'errFull' | 'errDuplicate'

/** Spec §6: capacity and duplicate phone are checked in one transaction, with the event row locked. */
export async function register(input: {
  eventId: string
  fullName: string
  phone: string
  email: string | null
  city: string | null
  profile: Profile
  note: string | null
}): Promise<RegisterResult> {
  const result = await prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT id FROM events WHERE id = ${input.eventId}::uuid FOR UPDATE`
    const e = await tx.event.findUnique({ where: { id: input.eventId } })
    if (!e) return 'errClosed' as const
    const state = registrationState(e, await takenPlaces(tx, e.id))
    // "Closed" (unpublished, switched off, or over) wins over "full".
    if (!e.isPublished || !e.registrationOpen || state.over) return 'errClosed' as const
    if (state.placesLeft === 0) return 'errFull' as const

    const existing = await tx.registration.findUnique({ where: { eventId_phone: { eventId: e.id, phone: input.phone } } })
    if (existing && existing.status !== 'cancelled') return 'errDuplicate' as const
    if (existing) {
      // Same phone registered then cancelled: re-activate the row with the new details.
      await tx.registration.update({ where: { id: existing.id }, data: { ...input, status: 'new', createdAt: new Date() } })
    } else {
      await tx.registration.create({ data: input })
    }
    return 'ok' as const
  })
  if (result === 'ok') await publishPlaces(input.eventId)
  return result
}

/** HR processing (spec §6): cancelling frees a place, re-activating takes one back. */
export async function setRegistrationStatus(id: string, status: RegistrationStatus, userId: string) {
  const reg = await prisma.$transaction(async (tx) => {
    const r = await tx.registration.findUniqueOrThrow({ where: { id } })
    await tx.$executeRaw`SELECT id FROM events WHERE id = ${r.eventId}::uuid FOR UPDATE`
    if (r.status === 'cancelled' && status !== 'cancelled') {
      const e = await tx.event.findUniqueOrThrow({ where: { id: r.eventId } })
      if (e.capacity !== null && (await takenPlaces(tx, e.id)) >= e.capacity) throw new Error('Événement complet : impossible de réactiver cette inscription.')
    }
    const updated = await tx.registration.update({ where: { id }, data: { status } })
    await tx.auditLog.create({ data: { userId, action: 'registration.status', entity: 'registration', entityId: id, payload: { from: r.status, to: status } } })
    return updated
  })
  await publishPlaces(reg.eventId)
  return reg
}
