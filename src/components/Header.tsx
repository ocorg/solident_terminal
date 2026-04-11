'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string; message: string; type: string
  status: string; created_at: string
}

interface HeaderProps {
  collapsed: boolean; onToggle: () => void
  fullName: string; isAdmin: boolean
  isMobile: boolean
}

export default function Header({ collapsed, onToggle, fullName, isAdmin, isMobile }: HeaderProps) {
  const supabase = createClient()
  const router   = useRouter()

  const [notifications, setNotifications] = useState<Notification[]>([])
  const [showNotifs,    setShowNotifs]    = useState(false)
  const [showProfile,   setShowProfile]   = useState(false)
  const notifRef   = useRef<HTMLDivElement>(null)
  const profileRef = useRef<HTMLDivElement>(null)

  const unread = notifications.filter(n => n.status === 'Non lu').length

  // ─── Notification sound ───────────────────────────────────────
  function playNotifSound() {
    try {
      const ctx  = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc  = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.setValueAtTime(880,  ctx.currentTime)
      osc.frequency.setValueAtTime(1100, ctx.currentTime + 0.1)
      gain.gain.setValueAtTime(0.15, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4)
      osc.start(ctx.currentTime)
      osc.stop(ctx.currentTime + 0.4)
    } catch {
      // Audio not available
    }
  }

  // ─── Fetch + Realtime subscription (runs once) ───────────────
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let active = true

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return

      // Load existing notifications
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_id', user.id)
        .order('created_at', { ascending: false })
        .limit(10)
      if (data && active) setNotifications(data)

      // Subscribe to new ones
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          'postgres_changes',
          {
            event:  'INSERT',
            schema: 'public',
            table:  'notifications',
            filter: `recipient_id=eq.${user.id}`,
          },
          (payload) => {
            if (!active) return
            setNotifications(prev => [payload.new as Notification, ...prev])
            playNotifSound()
          }
        )
        .subscribe()
    }

    init()

    return () => {
      active = false
      if (channel) {
        supabase.removeChannel(channel)
        channel = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Close dropdowns on outside click ────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   setShowNotifs(false)
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

    async function markAllRead() {
      const res = await fetch('/api/notifications', { method: 'PATCH' })
      if (res.ok) setNotifications(prev => prev.map(n => ({ ...n, status: 'Lu' })))
    }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const notifIcon: Record<string, string> = {
    task_assigned:     '✅',
    new_comment:       '💬',
    event_invited:     '📅',
    proposal_approved: '✅',
    proposal_rejected: '❌',
    task_overdue:      '⏰',
    default:           '🔔',
  }

  return (
    <header className={`fixed top-0 right-0 z-30 h-16 flex items-center justify-between px-4 bg-white/80 dark:bg-[#080d1a]/80 backdrop-blur-xl border-b border-gray-200 dark:border-white/5 transition-all duration-300 ${isMobile ? 'left-0' : collapsed ? 'left-[68px]' : 'left-[220px]'}`}>

      {/* Burger */}
      <button onClick={onToggle}
        className="w-9 h-9 flex flex-col items-center justify-center gap-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition-all duration-200 group">
        <span className={`block h-0.5 bg-gray-400 group-hover:bg-gray-900 dark:group-hover:bg-white transition-all duration-300 ${collapsed ? 'w-5' : 'w-4'}`} />
        <span className="block w-5 h-0.5 bg-gray-400 group-hover:bg-gray-900 dark:group-hover:bg-white transition-all duration-300" />
        <span className={`block h-0.5 bg-gray-400 group-hover:bg-gray-900 dark:group-hover:bg-white transition-all duration-300 ${collapsed ? 'w-5' : 'w-3'}`} />
      </button>

      <div className="flex items-center gap-2">

        {/* Theme toggle */}
        <ThemeToggle />

        {/* Refresh */}
        <button
          onClick={() => window.location.reload()}
          title="Actualiser"
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white text-base">
          ↺
        </button>

        {/* Bell */}
        <div ref={notifRef} className="relative">
          <button onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false) }}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
            🔔
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#F0A500] rounded-full text-[10px] text-black font-bold flex items-center justify-center animate-bounce">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && (
            <div className="absolute right-0 top-12 w-80 bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <span className="text-gray-900 dark:text-white text-sm font-semibold">Notifications</span>
                {unread > 0 && (
                  <button onClick={markAllRead} className="text-[#F0A500] text-xs hover:underline">
                    Tout marquer lu
                  </button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                {notifications.length === 0 ? (
                  <p className="text-gray-400 dark:text-slate-500 text-sm text-center py-6">Aucune notification</p>
                ) : notifications.map(n => (
                  <div key={n.id} className={`flex gap-3 px-4 py-3 text-sm transition hover:bg-gray-50 dark:hover:bg-white/5 ${n.status === 'Non lu' ? 'bg-[#1E5F7A]/5' : ''}`}>
                    <span className="text-lg flex-shrink-0">{notifIcon[n.type] || notifIcon.default}</span>
                    <div>
                      <p className="text-gray-700 dark:text-slate-300 leading-snug text-xs">{n.message}</p>
                      <p className="text-gray-400 dark:text-slate-600 text-[10px] mt-0.5">
                        {new Date(n.created_at).toLocaleDateString('fr-MA')}
                      </p>
                    </div>
                    {n.status === 'Non lu' && (
                      <div className="w-2 h-2 bg-[#F0A500] rounded-full flex-shrink-0 mt-1 ml-auto" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button onClick={() => { setShowProfile(!showProfile); setShowNotifs(false) }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition">
            <div className="w-7 h-7 rounded-lg bg-[#1E5F7A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {fullName?.[0]?.toUpperCase() ?? 'U'}
            </div>
            <span className="text-gray-700 dark:text-slate-300 text-sm hidden sm:block">{fullName}</span>
            {isAdmin && (
              <span className="hidden sm:block text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-1.5 py-0.5 rounded-md font-medium">Admin</span>
            )}
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-44 bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <Link href="/settings" className="flex items-center gap-2 px-4 py-3 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition">
                ⚙️ Paramètres
              </Link>
              <div className="border-t border-gray-100 dark:border-white/5" />
              <button onClick={handleLogout}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                🚪 Déconnexion
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Theme toggle extracted to avoid re-rendering Header ─────
function ThemeToggle() {
  const [theme, setThemeState] = useState<string>('light')

  useEffect(() => {
    setThemeState(document.documentElement.classList.contains('dark') ? 'dark' : 'light')
  }, [])

  function toggle() {
    const next = theme === 'dark' ? 'light' : 'dark'
    setThemeState(next)
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
  }

  return (
    <button onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
      title="Changer le thème">
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  )
}