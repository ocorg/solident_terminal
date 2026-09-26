'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

export type NavItem = { href: string; label: string; badge?: number }

/**
 * Back-office section menu (admin + members area).
 * Desktop: horizontal tabs. Phone: current section + "Menu" button opening the full list,
 * plus extra links (e.g. Administration / Site) that do not fit in the top bar on small screens.
 */
export function BackofficeNav({ items, extra = [], root, label }: { items: NavItem[]; extra?: NavItem[]; root: string; label: string }) {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [pathname])

  const isActive = (href: string) => (href === root ? pathname === root : pathname.startsWith(href))
  const current = [...items].reverse().find((i) => isActive(i.href)) ?? items[0]
  const totalBadges = items.reduce((n, i) => n + (i.badge ?? 0), 0)
  const badge = (n?: number) => (n ? <span className="rounded-full bg-gold-500 px-1.5 text-xs font-bold text-navy-900">{n}</span> : null)

  return (
    <nav className="border-b border-navy-100 bg-white" aria-label={label}>
      {/* Desktop tabs */}
      <div className="hidden gap-1 overflow-x-auto px-4 sm:px-6 md:flex">
        {items.map((i) => (
          <Link
            key={i.href}
            href={i.href}
            aria-current={isActive(i.href) ? 'page' : undefined}
            className={`relative flex items-center gap-2 whitespace-nowrap px-3 py-3 text-sm font-semibold transition ${
              isActive(i.href) ? 'text-navy-700 after:absolute after:inset-x-2 after:bottom-0 after:h-0.5 after:bg-gold-500' : 'text-ink-600 hover:text-navy-700'
            }`}
          >
            {i.label}
            {badge(i.badge)}
          </Link>
        ))}
      </div>

      {/* Phone: current section + menu */}
      <div className="md:hidden">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="flex w-full items-center justify-between gap-3 px-4 py-3 text-start"
        >
          <span className="flex items-center gap-2 font-semibold text-navy-700">
            {current.label}
            {badge(current.badge)}
          </span>
          <span className="flex items-center gap-2 rounded-[10px] bg-navy-100 px-3 py-1.5 text-sm font-semibold text-navy-700">
            Menu {totalBadges > 0 && !open && <span className="size-2 rounded-full bg-gold-500" aria-label="éléments en attente" />}
            <span aria-hidden className={`transition ${open ? 'rotate-180' : ''}`}>
              ▾
            </span>
          </span>
        </button>
        {open && (
          <ul className="grid grid-cols-2 gap-1 border-t border-navy-100 p-2">
            {[...items, ...extra].map((i) => (
              <li key={i.href}>
                <Link
                  href={i.href}
                  aria-current={isActive(i.href) ? 'page' : undefined}
                  className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2.5 text-sm font-semibold ${
                    isActive(i.href) ? 'bg-navy-700 text-white' : extra.includes(i) ? 'bg-gold-100 text-navy-900' : 'text-navy-700 hover:bg-navy-100'
                  }`}
                >
                  {i.label}
                  {badge(i.badge)}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </nav>
  )
}
