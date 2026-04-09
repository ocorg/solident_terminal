import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rateLimit'
import { emailPasswordReset } from '@/lib/email'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const allowed = rateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 })

    const admin = createAdminClient()

    // Check user exists — but return same response either way (prevents email enumeration)
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const exists = usersData?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!exists) return NextResponse.json({ status: 'sent' })

    // Generate reset link without sending Supabase's own email
    const { data, error: linkError } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://solident-terminal.vercel.app/auth/callback',
      },
    })

    if (linkError || !data?.properties?.action_link) {
      console.error('generateLink error:', linkError)
      return NextResponse.json({ error: 'Erreur lors de la génération du lien.' }, { status: 500 })
    }

    // Send via Resend with branded template
    await emailPasswordReset(email, data.properties.action_link)

    return NextResponse.json({ status: 'sent' })

  } catch (e) {
    console.error('forgot-password error:', e)
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 })
  }
}