'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { useState } from 'react'

const navItems = [
  { href: '/dashboard',    icon: '📊', label: 'Dashboard'     },
  { href: '/tasks',        icon: '✅', label: 'Tâches'        },
  { href: '/projects',     icon: '📁', label: 'Projets'       },
  { href: '/cellules',     icon: '🏛️', label: 'Cellules'      },
  { href: '/events',       icon: '📅', label: 'Événements'    },
  { href: '/proposals',    icon: '💡', label: 'Propositions'  },
]

const adminItems = [
  { href: '/members',      icon: '👥', label: 'Membres'       },
]

const bottomItems = [
  { href: '/settings',     icon: '⚙️', label: 'Paramètres'   },
]

interface SidebarProps {
  collapsed: boolean
  isAdmin: boolean
}

export default function Sidebar({ collapsed, isAdmin }: SidebarProps) {
  const pathname = usePathname()

  const NavLink = ({ href, icon, label }: { href: string; icon: string; label: string }) => {
    const active = pathname === href
    return (
      <Link
        href={href}
        className={`
          flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
          ${active
            ? 'bg-[#1E5F7A] text-white shadow-lg shadow-[#1E5F7A]/30'
            : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/5'
          }
          ${collapsed ? 'justify-center' : ''}
        `}
      >
        <span className="text-lg leading-none flex-shrink-0">{icon}</span>
        {!collapsed && (
          <span className="truncate transition-all duration-200">{label}</span>
        )}
      </Link>
    )
  }

  return (
    <aside
      className={`
        fixed top-0 left-0 h-full z-40 flex flex-col
        bg-white dark:bg-[#080d1a] border-r border-gray-200 dark:border-white/5
        transition-all duration-300 ease-in-out
        ${collapsed ? 'w-[68px]' : 'w-[220px]'}
      `}
    >
      {/* Logo */}
      <div className={`flex items-center h-16 px-3 border-b border-white/5 flex-shrink-0 ${collapsed ? 'justify-center' : 'gap-3'}`}>
        <div className="w-8 h-8 rounded-lg bg-gray-100 dark:bg-white flex items-center justify-center flex-shrink-0 overflow-hidden">
          <Image src="/Logo_Solident.png" alt="Solident" width={28} height={28} className="object-contain" />
        </div>
        {!collapsed && (
          <span className="text-gray-900 dark:text-white font-semibold text-sm tracking-tight">Solident</span>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto overflow-x-hidden p-2 space-y-1">
        {navItems.map(item => <NavLink key={item.href} {...item} />)}

        {isAdmin && (
          <>
            <div className={`my-2 border-t border-white/5 ${collapsed ? '' : 'mx-2'}`} />
            {adminItems.map(item => <NavLink key={item.href} {...item} />)}
          </>
        )}
      </nav>

      {/* Bottom */}
      <div className="p-2 border-t border-white/5 space-y-1">
        {bottomItems.map(item => <NavLink key={item.href} {...item} />)}
      </div>
    </aside>
  )
}