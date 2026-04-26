import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

/**
 * Verifies that the current user is either is_admin OR is_backoffice.
 * Returns { user, profile } if authorized, or a NextResponse 401/403 to return early.
 */
export async function requireBackoffice() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }

  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('profiles')
    .select('is_admin, is_backoffice, full_name')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin && !profile?.is_backoffice) {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }

  return { user, profile, admin }
}