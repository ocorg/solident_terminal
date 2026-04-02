'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()
  const [collapsed, setCollapsed] = useState(false)
  const [fullName, setFullName]   = useState('')
  const [isAdmin, setIsAdmin]     = useState(false)

  useEffect(() => {
    async function loadProfile() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('full_name, is_admin')
        .eq('id', user.id)
        .single()
      if (data) {
        setFullName(data.full_name)
        setIsAdmin(data.is_admin)
      }
    }
    loadProfile()
  }, [])

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-[#0a0f1e]">
      <Sidebar collapsed={collapsed} isAdmin={isAdmin} />
      <Header
        collapsed={collapsed}
        onToggle={() => setCollapsed(!collapsed)}
        fullName={fullName}
        isAdmin={isAdmin}
      />
      <main
        className={`
          pt-16 min-h-screen transition-all duration-300
          ${collapsed ? 'pl-[68px]' : 'pl-[220px]'}
        `}
      >
        <div className="p-6">
          {children}
        </div>
      </main>
    </div>
  )
}