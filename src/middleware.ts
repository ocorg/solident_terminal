import { type NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'

const ADMIN_ROUTES      = ['/members']
const BACKOFFICE_ROUTES = ['/maintenance']

const PUBLIC_PATHS = [
  '/login',
  '/forgot-password',
  '/reset-password',
  '/set-password',
  '/auth',
  '/api/auth',
  '/api/cron',
  '/maintenance-active',   // ← public page shown when maintenance is ON
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Exit early for public paths — don't touch Supabase at all
  if (PUBLIC_PATHS.some(p => pathname.startsWith(p))) {
    return NextResponse.next({ request })
  }

  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Fetch profile once for all permission checks
  let profile: { is_admin: boolean; is_backoffice: boolean } | null = null
  const needsProfileCheck =
    ADMIN_ROUTES.some(r => pathname.startsWith(r)) ||
    BACKOFFICE_ROUTES.some(r => pathname.startsWith(r)) ||
    !pathname.startsWith('/api/maintenance') // maintenance mode check for non-API routes

  if (needsProfileCheck) {
    try {
      const { data } = await supabase
        .from('profiles')
        .select('is_admin, is_backoffice')
        .eq('id', user.id)
        .single()
      profile = data
    } catch {
      profile = null
    }
  }

  // ── Admin-only routes ─────────────────────────────────────
  if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
    if (!profile?.is_admin) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // ── Backoffice-only routes ────────────────────────────────
  if (BACKOFFICE_ROUTES.some(route => pathname.startsWith(route))) {
    if (!profile?.is_admin && !profile?.is_backoffice) {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
  }

  // ── Maintenance mode check (non-API routes only) ──────────
  // Skip for admins, backoffice, and API routes
  const isPageRoute = !pathname.startsWith('/api/')
  const isPrivileged = profile?.is_admin || profile?.is_backoffice

  if (isPageRoute && !isPrivileged) {
    try {
      const { data: config } = await supabase
        .from('app_config')
        .select('value')
        .eq('key', 'maintenance_mode')
        .single()

      if (config?.value === 'true') {
        const url = request.nextUrl.clone()
        url.pathname = '/maintenance-active'
        return NextResponse.redirect(url)
      }
    } catch {
      // If check fails, allow through (fail-open for maintenance mode)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}