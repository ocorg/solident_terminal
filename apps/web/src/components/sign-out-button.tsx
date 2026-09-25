'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { authClient } from '@/lib/auth-client'
import { Spinner } from './spinner'

export function SignOutButton({ className = '' }: { className?: string }) {
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
      className={`flex items-center gap-2 rounded-[10px] border px-3 py-1.5 text-sm transition active:scale-[0.97] disabled:opacity-70 ${className}`}
    >
      {loading && <Spinner />}
      Se déconnecter
    </button>
  )
}
