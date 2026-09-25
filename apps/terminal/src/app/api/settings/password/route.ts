import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { rateLimit } from '@/lib/rateLimit'

export async function PATCH(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { current_password, new_password } = await req.json()

  // Rate limit: 5 password attempts per user per 15 minutes
  const allowed = rateLimit(`password:${user.id}`, 5, 15 * 60 * 1000)
  if (!allowed) return NextResponse.json({ error: 'Trop de tentatives. Réessayez dans 15 minutes.' }, { status: 429 })
  if (!current_password || !new_password) {
    return NextResponse.json({ error: 'Champs manquants' }, { status: 400 })
  }
  if (new_password.length < 8) {
    return NextResponse.json({ error: 'Le mot de passe doit contenir au moins 8 caractères' }, { status: 400 })
  }

  // Verify current password by attempting sign in
  const { error: signInError } = await supabase.auth.signInWithPassword({
    email: user.email!,
    password: current_password,
  })
  if (signInError) return NextResponse.json({ error: 'Mot de passe actuel incorrect' }, { status: 401 })

  // Update password
  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: new_password })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ status: 'updated' })
}