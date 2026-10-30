import { timingSafeEqual } from 'node:crypto'
import { NextResponse, type NextRequest } from 'next/server'

// Owner's way in while the project sleeps: /veille/entrer?cle=<HIBERNATE_KEY> sets the cookie that
// the hibernation redirect lets through (next.config.ts), then opens the members area.
// /veille/entrer?sortir=1 removes it (to see the hibernation page again).
export function GET(request: NextRequest) {
  const url = new URL(request.url)
  const key = process.env.HIBERNATE_KEY ?? ''
  if (url.searchParams.get('sortir')) {
    const res = NextResponse.redirect(new URL('/veille', url))
    res.cookies.delete('solident_wake')
    return res
  }
  const given = url.searchParams.get('cle') ?? ''
  const good = key.length > 0 && given.length === key.length && timingSafeEqual(Buffer.from(given), Buffer.from(key))
  if (!good) return NextResponse.redirect(new URL('/veille', url))
  const res = NextResponse.redirect(new URL('/espace', url))
  res.cookies.set('solident_wake', key, { httpOnly: true, secure: url.protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 60 * 60 * 24 * 90 })
  return res
}
