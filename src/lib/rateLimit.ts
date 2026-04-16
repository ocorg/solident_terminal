import { createAdminClient } from '@/lib/supabase/admin'

export async function rateLimit(key: string, limit: number, windowMs: number): Promise<boolean> {
  try {
    const admin = createAdminClient()
    const windowStart = new Date(Date.now() - windowMs).toISOString()

    // Count recent attempts
    const { count } = await admin
      .from('rate_limit_log')
      .select('*', { count: 'exact', head: true })
      .eq('key', key)
      .gte('created_at', windowStart)

    if ((count ?? 0) >= limit) return false

    await admin.from('rate_limit_log').insert({ key, created_at: new Date().toISOString() })
    return true
  } catch {
    return true // fail open — don't block users if rate limit check fails
  }
}