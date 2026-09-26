'use client'

import { useTranslations } from 'next-intl'
import { useEffect, useState } from 'react'
import { Link, usePathname } from '@/i18n/navigation'
import { LocaleSwitcher } from './locale-switcher'
import { navItems, supportItems } from './nav-items'

export function SiteHeader() {
  const t = useTranslations('Nav')
  const pathname = usePathname()
  const [open, setOpen] = useState(false)

  // Close the mobile menu after navigating.
  useEffect(() => setOpen(false), [pathname])

  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const linkClass = (href: string) =>
    `rounded-lg px-3 py-2 text-sm font-medium transition hover:bg-navy-100 hover:text-navy-700 ${
      isActive(href) ? 'text-navy-700 underline decoration-gold-500 decoration-2 underline-offset-8' : 'text-navy-900'
    }`

  return (
    <header className="sticky top-0 z-40 border-b border-navy-100/60 bg-cream-50/70 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
        <Link href="/" className="shrink-0 font-heading text-2xl font-bold text-navy-700">
          Solident<span className="text-gold-500">.</span>
        </Link>

        <nav className="ms-4 hidden flex-1 items-center gap-1 xl:flex" aria-label="Navigation principale">
          {navItems.map((i) => (
            <Link key={i.href} href={i.href} className={linkClass(i.href)}>
              {t(i.key)}
            </Link>
          ))}
        </nav>

        <div className="ms-auto flex items-center gap-2">
          <LocaleSwitcher />
          <Link href="/soutenir/don" className="btn btn-cta hidden px-4 py-2 text-sm sm:inline-flex">
            {t('donate')}
          </Link>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            aria-controls="menu-mobile"
            className="btn btn-ghost px-3 py-2 text-sm xl:hidden"
          >
            {t('menu')}
          </button>
        </div>
      </div>

      {open && (
        <nav id="menu-mobile" className="border-t border-navy-100 bg-cream-50 px-4 pb-6 pt-2 xl:hidden" aria-label={t('menu')}>
          <ul className="grid gap-1 sm:grid-cols-2">
            {[...navItems, ...supportItems].map((i) => (
              <li key={i.href}>
                <Link href={i.href} className={`block ${linkClass(i.href)}`}>
                  {t(i.key)}
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/soutenir/don" className="btn btn-cta mt-4 w-full sm:hidden">
            {t('donate')}
          </Link>
        </nav>
      )}
    </header>
  )
}
