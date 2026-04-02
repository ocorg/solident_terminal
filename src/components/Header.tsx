'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { useTheme } from 'next-themes'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string
  message: string
  type: string
  status: string
  created_at: string
}

interface HeaderProps {
  collapsed: boolean
  onToggle: () => void
  fullName: string
  isAdmin: boolean
}

export default function Header({ collapsed, onToggle, fullName, isAdmin }: HeaderProps) {
  const supabase = createClient()
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs, setShowNotifs]       = useState(false)
  const [showProfile, setShowProfile]     = useState(false)
  const notifRef   = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => n.status === 'Non lu').length

  useEffect(() => {
    async function fetchNotifs() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data) setNotifications(data)
    }
    fetchNotifs()
  }, [])

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  async function markAllRead() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase
      .from('notifications')
      .update({ status: 'Lu' })
      .eq('recipient_id', user.id)
      .eq('status', 'Non lu')
    setNotifications(prev => prev.map(n => ({ ...n, status: 'Lu' })))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const notifIcon: Record<string, string> = {
    task_assigned:      '✅',
    new_comment:        '💬',
    event_invited:      '📅',
    proposal_approved:  '✅',
    proposal_rejected:  '❌',
    task_overdue:       '⏰',
    default:            '🔔',
  }

  return (
    <header
      className={`
        fixed top-0 right-0 z-30 h-16
        flex items-center justify-between px-4
        bg-white/80 dark:bg-[#080d1a]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5
        transition-all duration-300
        ${collapsed ? 'left-[68px]' : 'left-[220px]'}
      `}
    >
      {/* Burger */}
      <button
        onClick={onToggle}
        className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-white/5 transition-all duration-200 group"
      >
        <span className={`block h-0.5 bg-slate-400 group-hover:bg-white transition-all duration-300 ${collapsed ? 'w-5' : 'w-4'}`} />
        <span className="block w-5 h-0.5 bg-slate-400 group-hover:bg-white transition-all duration-300" />
        <span className={`block h-0.5 bg-slate-400 group-hover:bg-white transition-all duration-300 ${collapsed ? 'w-5' : 'w-3'}`} />
      </button>

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-black/5 dark:hover:bg-white/5 transition text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
          title="Changer le thème"
        >
          {theme === 'dark' ? '☀️' : '🌙'}
        </button>

        {/* Bell */}
        <div ref={notifRef} className="relative">
          <button
            onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false) }}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-white/5 transition text-slate-400 hover:text-white"
          >
            🔔
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#F0A500] rounded-full text-[10px] text-black font-bold flex items-center justify-center">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {/* Notif Dropdown */}
          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 bg-[#0e1628] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/5">
                <span className="text-white text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[#F0A500] text-xs hover:underline">
                    Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-white/5">
                {notifications.length === 0 ? (
                  <p className="text-slate-500 text-sm text-center py-6">Aucune notification</p>
                ) : (
                  notifications.map(n => (
                    <div key={n.id} className={`flex gap-3 px-4 py-3 text-sm transition hover:bg-white/5 ${n.status === 'Non lu' ? 'bg-[#1E5F7A]/10' : ''}`}>
                      <span className="text-lg flex-shrink-0">{notifIcon[n.type] || notifIcon.default}</span>
                      <div>
                        <p className="text-slate-300 leading-snug">{n.message}</p>
                        <p className="text-slate-600 text-xs mt-0.5">{new Date(n.created_at).toLocaleDateString('fr-MA')}</p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button
            onClick={() => { setShowProfile(!showProfile); setShowNotifs(false) }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-white/5 transition"
          >
            <div className="w-7 h-7 rounded-lg bg-[#1E5F7A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {fullName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-slate-300 text-sm hidden sm:block">{fullName}</span>
            {isAdmin && (
              <span className="hidden sm:block text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-1.5 py-0.5 rounded-md font-medium">Admin</span>
            )}
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-44 bg-[#0e1628] border border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <Link href="/settings" className="flex items-center gap-2 px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition">
                ⚙️ Paramètres
              </Link>
              <div className="border-t border-white/5" />
              <button
                onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-400 hover:bg-red-500/10 transition"
              >
                🚪 Déconnexion
              </button>
            </div>
          )}
        </div>

      </div>
    </header>
  )
}