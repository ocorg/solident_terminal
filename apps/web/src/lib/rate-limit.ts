import 'server-only'
import { headers } from 'next/headers'
import { prisma } from '@solident/db'

/** Visitor IP as seen by Vercel (first x-forwarded-for hop). */
export async function clientIp() {
  const h = await headers()
  return h.get('x-forwarded-for')?.split(',')[0]?.trim() || h.get('x-real-ip') || 'unknown'
}

/**
 * Fixed-window limit for public server actions, stored in Postgres (rate_limits, "app:" keys)
 * so it holds across Vercel instances. Returns false when the limit is exceeded.
 */
export async function allow(name: string, max: number, windowSeconds: number) {
  const key = `app:${name}:${await clientIp()}`
  const now = Date.now()
  const row = await prisma.rateLimit.findUnique({ where: { key } })
  if (!row || now - Number(row.lastRequest) > windowSeconds * 1000) {
    await prisma.rateLimit.upsert({
      where: { key },
      create: { key, count: 1, lastRequest: BigInt(now) },
      update: { count: 1, lastRequest: BigInt(now) },
    })
    return true
  }
  if (row.count >= max) return false
  await prisma.rateLimit.update({ where: { key }, data: { count: { increment: 1 } } })
  return true
}
