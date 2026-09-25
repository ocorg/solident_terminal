'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [collapsed,      setCollapsed]      = useState(false)
  const [mobileOpen,     setMobileOpen]     = useState(false)
  const [fullName,       setFullName]       = useState('')
  const [isAdmin,        setIsAdmin]        = useState(false)
  const [isBackoffice,   setIsBackoffice]   = useState(false)
  const [avatarUrl,      setAvatarUrl]      = useState<string | null>(null)
  const [currentUserId,  setCurrentUserId]  = useState<string | null>(null)
  const [isMobile,       setIsMobile]       = useState(false)
  const [maintenanceOn,  setMaintenanceOn]  = useState(false)

  useEffect(() => {
    function checkMobile() {
      setIsMobile(window.innerWidth < 768)
      if (window.innerWidth < 768) setCollapsed(true)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, is_admin, is_backoffice, avatar_url')
        .eq('id', user.id)
        .single()
      if (data) {
        setFullName(data.full_name)
        setIsAdmin(data.is_admin)
        setIsBackoffice(data.is_backoffice ?? false)
        setAvatarUrl(data.avatar_url || null)
      }
      setCurrentUserId(user.id)

      // Check maintenance mode for banner (admins/backoffice stay in)
      if (data?.is_admin || data?.is_backoffice) {
        const { data: config } = await supabase
          .from('app_config')
          .select('value')
          .eq('key', 'maintenance_mode')
          .single()
        setMaintenanceOn(config?.value === 'true')
      }
    }
    loadProfile()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleToggle() {
    if (isMobile) {
      setMobileOpen(prev => !prev)
    } else {
      setCollapsed(prev => !prev)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1e]">

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/50 backdrop-blur-sm"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <Sidebar
        collapsed={isMobile ? false : collapsed}
        isAdmin={isAdmin}
        isBackoffice={isBackoffice}
        mobileOpen={mobileOpen}
        isMobile={isMobile}
      />

      <Header
        collapsed={isMobile ? false : collapsed}
        onToggle={handleToggle}
        fullName={fullName}
        isAdmin={isAdmin}
        isMobile={isMobile}
        avatarUrl={avatarUrl}
        userId={currentUserId}
      />

      {/* Maintenance mode banner — only shown to admins/backoffice while maintenance is ON */}
      {maintenanceOn && (isAdmin || isBackoffice) && (
        <div
          className={`
            fixed z-20 left-0 right-0 top-16
            ${isMobile ? 'left-0' : collapsed ? 'left-[68px]' : 'left-[220px]'}
            bg-[#F0A500]/90 backdrop-blur-sm px-4 py-2 flex items-center justify-center gap-2
            border-b border-[#F0A500]/50 shadow-lg
          `}
        >
          <span className="text-black text-xs font-bold">🔒 MODE MAINTENANCE ACTIF</span>
          <span className="text-black/60 text-xs">— Les utilisateurs voient la page de maintenance</span>
          <a href="/maintenance" className="ml-2 text-black/80 text-xs underline hover:text-black font-semibold">
            Gérer →
          </a>
        </div>
      )}

      <main
        className={`
          min-h-screen transition-all duration-300
          ${isMobile ? 'pl-0' : collapsed ? 'pl-[68px]' : 'pl-[220px]'}
          ${maintenanceOn && (isAdmin || isBackoffice) ? 'pt-24' : 'pt-16'}
        `}
      >
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}