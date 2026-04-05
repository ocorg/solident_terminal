'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function AuthCallbackPage() {
  const supabase = createClient()
  const router   = useRouter()
  const [status, setStatus] = useState<'loading' | 'error'>('loading')
  const [error,  setError]  = useState('')

  useEffect(() => {
    async function handle() {
      try {
        // Parse hash from URL
        const hash   = window.location.hash.substring(1)
        const params = new URLSearchParams(hash)

        const accessToken  = params.get('access_token')
        const refreshToken = params.get('refresh_token')
        const type         = params.get('type')
        const errorParam   = params.get('error_description')

        // Handle error from Supabase
        if (errorParam) {
          setError(decodeURIComponent(errorParam.replace(/\+/g, ' ')))
          setStatus('error')
          return
        }

        // Exchange tokens if present in hash
        if (accessToken && refreshToken) {
          const { error: sessionError } = await supabase.auth.setSession({
            access_token:  accessToken,
            refresh_token: refreshToken,
          })

          if (sessionError) {
            setError('Session invalide. Demandez un nouveau lien.')
            setStatus('error')
            return
          }

          // Route based on type
          if (type === 'invite') {
            router.replace('/set-password')
          } else if (type === 'recovery') {
            router.replace('/reset-password')
          } else {
            router.replace('/dashboard')
          }
          return
        }

        // No hash tokens — check search params (some Supabase flows use these)
        const searchParams = new URLSearchParams(window.location.search)
        const tokenHash = searchParams.get('token_hash')
        const searchType = searchParams.get('type')

        if (tokenHash && searchType) {
          const { error: verifyError } = await supabase.auth.verifyOtp({
            type: searchType as any,
            token_hash: tokenHash,
          })

          if (verifyError) {
            setError('Lien invalide ou expiré.')
            setStatus('error')
            return
          }

          if (searchType === 'invite') router.replace('/set-password')
          else if (searchType === 'recovery') router.replace('/reset-password')
          else router.replace('/dashboard')
          return
        }

        // Last resort — check if already logged in
        const { data: { session } } = await supabase.auth.getSession()
        if (session) {
          router.replace('/dashboard')
        } else {
          setError('Lien invalide ou expiré. Demandez une nouvelle invitation.')
          setStatus('error')
        }

      } catch (e) {
        setError('Une erreur inattendue est survenue.')
        setStatus('error')
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
        {status === 'loading' ? (
          <>
            <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-gray-500 dark:text-slate-400 text-sm">Vérification en cours…</p>
          </>
        ) : (
          <>
            <div className="w-14 h-14 bg-red-100 dark:bg-red-500/20 rounded-2xl flex items-center justify-center text-2xl mx-auto">❌</div>
            <p className="text-red-500 text-sm font-medium max-w-sm mx-auto">{error}</p>
            <a href="/login" className="inline-block mt-4 text-[#1E5F7A] text-sm hover:underline">
              ← Retour à la connexion
            </a>
          </>
        )}
      </div>
    </div>
  )
}