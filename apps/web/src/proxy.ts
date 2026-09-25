import { NextResponse, type NextRequest } from 'next/server'
import createMiddleware from 'next-intl/middleware'
import { routing } from './i18n/routing'

// Next 16 "proxy" (formerly middleware): adds the /fr /ar /en prefix to public pages.
const intl = createMiddleware(routing)

// French-only back-office pages live outside /[locale].
const BACKOFFICE = /^\/(admin|connexion|inscription|mot-de-passe|mot-de-passe-oublie|acces-refuse)(\/|$)/

export default function proxy(request: NextRequest) {
  if (BACKOFFICE.test(request.nextUrl.pathname)) return NextResponse.next()
  return intl(request)
}

export const config = {
  // Everything except the API, Next internals and files with an extension.
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)'],
}
