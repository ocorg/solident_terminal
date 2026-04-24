import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autorisé' }, { status: 401 })

  const { data: profile } = await supabase.from('profiles').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 })

  const { id } = await params
  const formData = await req.formData()
  const file = formData.get('file') as File
  if (!file) return NextResponse.json({ error: 'Aucun fichier fourni' }, { status: 400 })
  if (file.size > 204800) return NextResponse.json({ error: 'Image trop lourde (max 200 Ko)' }, { status: 400 })
  const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
  if (!ALLOWED_MIME.includes(file.type)) {
    return NextResponse.json({ error: 'Format non autorisé — JPEG, PNG ou WebP uniquement' }, { status: 400 })
  }

  const admin = createAdminClient()
  const bytes = await file.arrayBuffer()
  const { error: uploadError } = await admin.storage.from('avatars').upload(id, Buffer.from(bytes), {
    upsert: true,
    contentType: file.type,
  })
  if (uploadError) return NextResponse.json({ error: uploadError.message }, { status: 500 })

  const { data: { publicUrl } } = admin.storage.from('avatars').getPublicUrl(id)
  const avatarUrl = `${publicUrl}?t=${Date.now()}`

  const { error: updateError } = await admin.from('profiles').update({ avatar_url: avatarUrl }).eq('id', id)
  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 })

  return NextResponse.json({ avatar_url: avatarUrl })
}