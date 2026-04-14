'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [collapsed,    setCollapsed]    = useState(false)
  const [mobileOpen,   setMobileOpen]   = useState(false)
  const [fullName,     setFullName]     = useState('')
  const [isAdmin,      setIsAdmin]      = useState(false)
  const [avatarUrl,    setAvatarUrl]    = useState<string | null>(null)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [isMobile,     setIsMobile]     = useState(false)

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
        .select('full_name, is_admin, avatar_url')
        .eq('id', user.id)
        .single()
      if (data) {
        setFullName(data.full_name)
        setIsAdmin(data.is_admin)
        setAvatarUrl(data.avatar_url || null)
      }
      setCurrentUserId(user.id)
    }
    loadProfile()
  }, [])

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

      <main
        className={`
          pt-16 min-h-screen transition-all duration-300
          ${isMobile ? 'pl-0' : collapsed ? 'pl-[68px]' : 'pl-[220px]'}
        `}
      >
        <div className="p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}