'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { auth } from '@/lib/auth'

const schema = z.object({ email: z.email('Adresse e-mail invalide').trim().toLowerCase() })

export async function requestMagicLink(input: { email: string }) {
  const { email } = schema.parse(input)
  await auth.api.signInMagicLink({
    body: { email, callbackURL: '/admin', errorCallbackURL: '/connexion' },
    headers: await headers(),
  })
  // Same answer whether or not the email belongs to a member.
  return { status: 'success' as const, data: { email } }
}
