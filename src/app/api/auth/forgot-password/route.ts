import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rateLimit'
import { emailPasswordReset } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const allowed = await rateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: 'Trop de tentatives.' }, { status: 429 })

    const admin = createAdminClient()

    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://solident-terminal.vercel.app/auth/callback',
      },
    })
    // If email doesn't exist, generateLink returns an error — we silently ignore it (no user enumeration)
    if (linkError || !data?.properties?.action_link) return NextResponse.json({ status: 'sent' })
    if (!data?.properties?.action_link) return NextResponse.json({ error: 'No action_link returned' }, { status: 500 })

    await emailPasswordReset(email, data.properties.action_link)

    return NextResponse.json({ status: 'sent' })

  } catch (e: any) {
    return NextResponse.json({ error: `CRASH: ${e?.message ?? String(e)}` }, { status: 500 })
  }
}