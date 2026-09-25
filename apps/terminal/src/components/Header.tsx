'use client'

import Link from 'next/link'
import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Notification {
  id: string; message: string; type: string
  status: string; created_at: string
}

interface AdminNotification extends Notification {
  recipient_id: string
  profiles: { full_name: string; username: string } | null
}

interface HeaderProps {
  collapsed: boolean; onToggle: () => void
  fullName: string; isAdmin: boolean
  isMobile: boolean
  avatarUrl?: string | null
  userId?: string | null
}

export default function Header({ collapsed, onToggle, fullName, isAdmin, isMobile, avatarUrl, userId }: HeaderProps) {
  const supabase = createClient()
  const router   = useRouter()

  const [notifications,      setNotifications]      = useState<Notification[]>([])
  const [showNotifs,         setShowNotifs]         = useState(false)
  const [showProfile,        setShowProfile]        = useState(false)
  const [showAdminPanel,     setShowAdminPanel]     = useState(false)
  const [adminNotifications, setAdminNotifications] = useState<AdminNotification[]>([])
  const [loadingAdmin,       setLoadingAdmin]       = useState(false)
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
    } catch { /* Audio not available */ }
  }

  // ─── Load notifications via GET (triggers auto-archive) ──────
  async function loadNotifications() {
    const res = await fetch('/api/notifications')
    if (res.ok) {
      const data = await res.json()
      if (Array.isArray(data)) setNotifications(data)
    }
  }

  // ─── Fetch + Realtime subscription ───────────────────────────
  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null
    let active = true

    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !active) return

      await loadNotifications()

      // Subscribe to new ones
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT', schema: 'public', table: 'notifications',
          filter: `recipient_id=eq.${user.id}`,
        }, (payload) => {
          if (!active) return
          setNotifications(prev => [payload.new as Notification, ...prev])
          playNotifSound()
        })
        .subscribe()
    }

    init()
    return () => {
      active = false
      if (channel) { supabase.removeChannel(channel); channel = null }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Close dropdowns on outside click ────────────────────────
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (notifRef.current   && !notifRef.current.contains(e.target as Node))   { setShowNotifs(false); setShowAdminPanel(false) }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfile(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // ─── Mark single notification as read ────────────────────────
  async function markOneRead(id: string) {
    const notif = notifications.find(n => n.id === id)
    if (!notif || notif.status !== 'Non lu') return
    // Optimistic update
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, status: 'Lu' } : n))
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  }

  // ─── Mark all read ────────────────────────────────────────────
  async function markAllRead() {
    const res = await fetch('/api/notifications', { method: 'PATCH' })
    if (res.ok) setNotifications(prev => prev.map(n => ({ ...n, status: 'Lu' })))
  }

  // ─── Load admin notifications panel ──────────────────────────
  async function openAdminPanel() {
    setShowAdminPanel(true)
    setLoadingAdmin(true)
    const res = await fetch('/api/admin/notifications')
    if (res.ok) {
      const data = await res.json()
      setAdminNotifications(data)
    }
    setLoadingAdmin(false)
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const notifIcon: Record<string, string> = {
    task_assigned: '✅', new_comment: '💬', event_invited: '📅',
    proposal_approved: '✅', proposal_rejected: '❌', task_overdue: '⏰', default: '🔔',
  }

  const timeAgo = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime()
    const m = Math.floor(diff / 60000)
    if (m < 1)  return 'À l\'instant'
    if (m < 60) return `il y a ${m}m`
    const h = Math.floor(m / 60)
    if (h < 24) return `il y a ${h}h`
    return `il y a ${Math.floor(h / 24)}j`
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

        <ThemeToggle />

        <button onClick={() => window.location.reload()} title="Actualiser"
          className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white text-base">
          ↺
        </button>

        {/* Bell + Notifications dropdown */}
        <div ref={notifRef} className="relative">
          <button onClick={() => { setShowNotifs(v => !v); setShowProfile(false); setShowAdminPanel(false) }}
            className="relative w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white">
            🔔
            {unread > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 bg-[#F0A500] rounded-full text-[10px] text-black font-bold flex items-center justify-center animate-bounce">
                {unread > 9 ? '9+' : unread}
              </span>
            )}
          </button>

          {showNotifs && !showAdminPanel && (
            <div className="absolute right-0 top-12 w-[340px] bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">

              {/* Header row */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-gray-900 dark:text-white text-sm font-semibold">Notifications</span>
                  {unread > 0 && (
                    <span className="bg-[#F0A500] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{unread}</span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  {unread > 0 && (
                    <button onClick={markAllRead} className="text-[#1E5F7A] dark:text-[#5bbcde] text-xs hover:underline font-medium">
                      Tout lire
                    </button>
                  )}
                  {isAdmin && (
                    <button onClick={openAdminPanel}
                      className="text-[10px] bg-[#F0A500]/10 text-[#F0A500] border border-[#F0A500]/20 px-2 py-0.5 rounded-full font-semibold hover:bg-[#F0A500]/20 transition">
                      Vue admin
                    </button>
                  )}
                </div>
              </div>

              {/* Notification list */}
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                {notifications.length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-center px-4">
                    <span className="text-2xl mb-2">🔕</span>
                    <p className="text-gray-400 dark:text-slate-500 text-sm">Aucune notification</p>
                    <p className="text-gray-300 dark:text-slate-700 text-xs mt-0.5">Vous êtes à jour !</p>
                  </div>
                ) : notifications.map(n => (
                  <button key={n.id} type="button"
                    onClick={() => markOneRead(n.id)}
                    className={`w-full text-left flex gap-3 px-4 py-3 transition cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 ${n.status === 'Non lu' ? 'bg-[#1E5F7A]/5 dark:bg-[#1E5F7A]/10' : ''}`}>
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm flex-shrink-0 mt-0.5 ${n.status === 'Non lu' ? 'bg-[#1E5F7A]/15 dark:bg-[#1E5F7A]/20' : 'bg-gray-100 dark:bg-white/5'}`}>
                      {notifIcon[n.type] || notifIcon.default}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-xs leading-snug ${n.status === 'Non lu' ? 'text-gray-800 dark:text-slate-200 font-medium' : 'text-gray-500 dark:text-slate-400'}`}>
                        {n.message}
                      </p>
                      <p className="text-gray-400 dark:text-slate-600 text-[10px] mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                    {n.status === 'Non lu' && (
                      <div className="w-2 h-2 bg-[#F0A500] rounded-full flex-shrink-0 mt-2" />
                    )}
                  </button>
                ))}
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 dark:border-white/5 px-4 py-2 flex justify-center">
                <p className="text-[10px] text-gray-300 dark:text-slate-700">
                  Les notifications sont archivées après 7 jours
                </p>
              </div>
            </div>
          )}

          {/* Admin panel */}
          {showAdminPanel && (
            <div className="absolute right-0 top-12 w-[420px] bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 dark:border-white/5">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-1.5 py-0.5 rounded-full font-semibold">Admin</span>
                  <span className="text-gray-900 dark:text-white text-sm font-semibold">Suivi des notifications</span>
                </div>
                <button onClick={() => setShowAdminPanel(false)}
                  className="text-gray-400 hover:text-gray-900 dark:hover:text-white text-xl transition">×</button>
              </div>

              <div className="max-h-[420px] overflow-y-auto divide-y divide-gray-100 dark:divide-white/5">
                {loadingAdmin ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="w-5 h-5 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : adminNotifications.length === 0 ? (
                  <p className="text-center text-gray-400 dark:text-slate-500 text-sm py-8">Aucune notification</p>
                ) : adminNotifications.map(n => (
                  <div key={n.id} className="flex gap-3 px-4 py-3 items-start">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs flex-shrink-0 mt-0.5 ${n.status === 'Non lu' ? 'bg-[#F0A500]/20' : 'bg-gray-100 dark:bg-white/5'}`}>
                      {notifIcon[n.type] || notifIcon.default}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span className="text-gray-700 dark:text-slate-300 text-[11px] font-semibold truncate">
                          {(n.profiles as any)?.full_name || '—'}
                        </span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold flex-shrink-0 ${
                          n.status === 'Non lu'
                            ? 'bg-[#F0A500]/15 text-[#F0A500]'
                            : 'bg-green-100 dark:bg-green-500/15 text-green-600 dark:text-green-400'
                        }`}>
                          {n.status === 'Non lu' ? '⬤ Non lu' : '✓ Lu'}
                        </span>
                      </div>
                      <p className="text-gray-500 dark:text-slate-400 text-xs leading-snug">{n.message}</p>
                      <p className="text-gray-300 dark:text-slate-700 text-[10px] mt-0.5">{timeAgo(n.created_at)}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-gray-100 dark:border-white/5 px-4 py-2">
                <p className="text-[10px] text-gray-300 dark:text-slate-700 text-center">
                  50 notifications les plus récentes · actives seulement
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Profile */}
        <div ref={profileRef} className="relative">
          <button onClick={() => { setShowProfile(v => !v); setShowNotifs(false); setShowAdminPanel(false) }}
            className="flex items-center gap-2 pl-2 pr-3 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition">
            <div className="w-8 h-8 rounded-xl overflow-hidden bg-[#1E5F7A] flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {avatarUrl
                ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                : <span>{fullName?.[0]?.toUpperCase() ?? 'U'}</span>
              }
            </div>
            <span className="text-gray-700 dark:text-slate-300 text-sm hidden sm:block">{fullName}</span>
            {isAdmin && (
              <span className="hidden sm:block text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-1.5 py-0.5 rounded-md font-medium">Admin</span>
            )}
          </button>

          {showProfile && (
            <div className="absolute right-0 top-12 w-72 bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
              <div className="p-4">
                <div className="relative w-full aspect-[2.5/1] rounded-xl overflow-hidden bg-gradient-to-br from-[#1E5F7A] to-[#2a7a9a] flex flex-col items-center justify-center mb-3">
                  <div className="w-16 h-16 rounded-xl overflow-hidden border-2 border-white/30 bg-white/20 flex items-center justify-center text-white text-xl font-bold shadow-lg">
                    {avatarUrl
                      ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                      : <span>{fullName?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2) ?? 'U'}</span>
                    }
                  </div>
                  {isAdmin && (
                    <span className="absolute top-2 right-2 text-[10px] bg-[#F0A500]/30 text-[#F0A500] border border-[#F0A500]/40 px-2 py-0.5 rounded-full font-semibold">
                      Admin
                    </span>
                  )}
                </div>
                <p className="text-gray-900 dark:text-white font-bold text-sm text-center leading-tight">{fullName}</p>
                <p className="text-gray-400 dark:text-slate-500 text-xs text-center mt-0.5 truncate">Bridge de Solidarite des Medecins Dentistes</p>
              </div>
              <div className="border-t border-gray-100 dark:border-white/5" />
              <Link href="/settings" className="flex items-center gap-3 px-4 py-3 text-sm text-gray-600 dark:text-slate-300 hover:bg-gray-50 dark:hover:bg-white/5 hover:text-gray-900 dark:hover:text-white transition">
                <span className="text-base">⚙️</span><span>Paramètres</span>
              </Link>
              <div className="border-t border-gray-100 dark:border-white/5" />
              <button onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-3 text-sm text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 transition">
                <span className="text-base">🚪</span><span>Déconnexion</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}

// ─── Theme toggle ─────────────────────────────────────────────
function ThemeToggle() {
  const [mounted, setMounted] = useState(false)
  const isDark = mounted && document.documentElement.classList.contains('dark')
  useEffect(() => { setMounted(true) }, [])
  function toggle() {
    const next = isDark ? 'light' : 'dark'
    document.documentElement.classList.toggle('dark', next === 'dark')
    localStorage.setItem('theme', next)
  }
  if (!mounted) return <div className="w-9 h-9" />
  return (
    <button onClick={toggle}
      className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-gray-100 dark:hover:bg-white/5 transition text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white"
      title="Changer le thème">
      {isDark ? '☀️' : '🌙'}
    </button>
  )
}
