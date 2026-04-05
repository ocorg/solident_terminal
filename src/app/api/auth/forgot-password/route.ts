import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email } = body
    if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

    const allowed = rateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)
    if (!allowed) return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 })

    const admin = createAdminClient()

    // Check user exists
    const { data: usersData } = await admin.auth.admin.listUsers({ perPage: 1000 })
    const exists = usersData?.users?.some(u => u.email?.toLowerCase() === email.toLowerCase())
    if (!exists) return NextResponse.json({ error: 'Aucun compte associé à cette adresse email.' }, { status: 404 })

    // Actually send the reset email via Supabase
    const { error } = await admin.auth.admin.generateLink({
      type: 'recovery',
      email,
      options: {
        redirectTo: 'https://solident-terminal.vercel.app/auth/callback',
      }
    })

    // generateLink doesn't send — use this instead:
    const { createClient } = await import('@/lib/supabase/server')
    const supabase = await createClient()
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: 'https://solident-terminal.vercel.app/auth/callback',
    })

    if (resetError) return NextResponse.json({ error: resetError.message }, { status: 500 })
    return NextResponse.json({ status: 'sent' })

  } catch (e) {
    console.error('forgot-password error:', e)
    return NextResponse.json({ error: 'Erreur serveur inattendue' }, { status: 500 })
  }
}