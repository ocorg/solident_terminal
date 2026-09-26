'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Spinner } from './spinner'

/** compact: icon only on phones (text from the sm breakpoint), for crowded top bars. */
export function SignOutButton({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function onClick() {
    setLoading(true)
    const { error } = await authClient.signOut()
    if (error) {
      toast.error('Déconnexion impossible, réessayez.')
      setLoading(false)
      return
    }
    toast.success('Vous êtes déconnecté')
    router.replace('/connexion')
    router.refresh()
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label="Se déconnecter"
      title="Se déconnecter"
      className={`flex shrink-0 items-center gap-2 rounded-[10px] border px-3 py-1.5 text-sm transition active:scale-[0.97] disabled:opacity-70 ${className}`}
    >
      {loading ? (
        <Spinner />
      ) : (
        compact && (
          <svg aria-hidden viewBox="0 0 24 24" className="size-4 sm:hidden" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
          </svg>
        )
      )}
      <span className={compact ? 'hidden sm:inline' : ''}>Se déconnecter</span>
    </button>
  )
}
