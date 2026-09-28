import 'server-only'
import { cache } from 'react'
import { prisma } from '@solident/db'

// Public fundraising switch (law 18-18: an appeal to the public needs a prior authorization).
// Stored in site_settings; missing = closed. Edited in /admin/campagnes.
export const FUNDRAISING_KEYS = { open: 'fundraising_open', authorization: 'fundraising_authorization' } as const

export type Fundraising = { open: boolean; authorization: string | null }

export const getFundraising = cache(async (): Promise<Fundraising> => {
  const rows = await prisma.siteSetting.findMany({ where: { key: { in: Object.values(FUNDRAISING_KEYS) } } })
  const value = (key: string) => rows.find((r) => r.key === key)?.value
  return { open: value(FUNDRAISING_KEYS.open) === 'true', authorization: value(FUNDRAISING_KEYS.authorization) || null }
})
