import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rateLimit'

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'Email requis' }, { status: 400 })

  // Rate limit: 3 attempts per email per 15 minutes
  const allowed = rateLimit(`forgot:${email}`, 3, 15 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 })

  const admin = createAdminClient()

  // Check if user exists with this email
  const { data: { users } } = await admin.auth.admin.listUsers()
  const exists = users?.some(u => u.email?.toLowerCase() === email.toLowerCase())

  if (!exists) {
    return NextResponse.json({ error: 'Aucun compte associé à cette adresse email.' }, { status: 404 })
  }

  // User exists — send reset email via Supabase
  const { createClient } = await import('@/lib/supabase/server')
  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://solident-terminal.vercel.app'}/reset-password`,
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ status: 'sent' })
}