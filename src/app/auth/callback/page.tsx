'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AuthCallbackPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [error,  setError] = useState('')

  useEffect(() => {
    async function handle() {
      // Get hash params from URL
      const hash   = window.location.hash.substring(1)
      const params = new URLSearchParams(hash)

      const accessToken  = params.get('access_token')
      const refreshToken = params.get('refresh_token')
      const type         = params.get('type')
      const errorDesc    = params.get('error_description')

      if (errorDesc) {
        setError(decodeURIComponent(errorDesc.replace(/\+/g, ' ')))
        return
      }

      if (accessToken && refreshToken) {
        // Exchange tokens for session
        const { error } = await supabase.auth.setSession({
          access_token:  accessToken,
          refresh_token: refreshToken,
        })

        if (error) { setError(error.message); return }

        if (type === 'invite' || type === 'recovery') {
          router.push('/set-password')
        } else {
          router.push('/dashboard')
        }
        return
      }

      // Fallback — check existing session
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        router.push('/dashboard')
      } else {
        setError('Lien invalide ou expiré. Demandez une nouvelle invitation.')
      }
    }

    handle()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1e] px-4">
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-gray-200 dark:border-white/10 mb-2 overflow-hidden mx-auto">
          <Image src="/Logo_Solident.png" alt="Solident" width={72} height={72} className="object-contain" />
        </div>
        {!error ? (
          <>
            <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">Vérification en cours…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center text-2xl mx-auto">❌</div>
            <p className="text-red-500 text-sm font-medium max-w-sm">{error}</p>
            <a href="/login" className="inline-block mt-4 text-[#1E5F7A] text-sm hover:underline">
              ← Retour à la connexion
            </a>
          </>
        )}
      </div>
    </div>
  )
}