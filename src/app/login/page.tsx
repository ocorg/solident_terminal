'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { useEffect } from 'react'

export default function LoginPage() {
  const supabase = createClient()
  const router = useRouter()

  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading]   = useState(false)
  const [error, setError]       = useState('')
  const [showPass, setShowPass] = useState(false)
  const [resetSuccess, setResetSuccess] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setResetSuccess(new URLSearchParams(window.location.search).get('reset') === 'success')
    }
  }, [])

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      setError('Identifiants incorrects. Veuillez réessayer.')
      setLoading(false)
      return
    }

    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1e] px-4">

      {/* Background glows — brand colors */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#1E5F7A] opacity-10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-[#F0A500] opacity-5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">

        {/* Logo */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-gray-200 dark:border-white/10 mb-4 shadow-lg shadow-[#1E5F7A]/20 overflow-hidden">
            <Image
              src="/Logo_Solident.png"
              alt="Solident"
              width={72}
              height={72}
              className="object-contain"
            />
          </div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-semibold tracking-tight">Solident</h1>
          <p className="text-[#1E5F7A] text-sm mt-1 font-medium">Solidarité Dentaires — Espace membre</p>
        </div>

        {/* Card */}
        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-gray-900 dark:text-white text-xl font-semibold mb-6">Connexion</h2>

          <form onSubmit={handleLogin} className="space-y-5">

            {/* Email */}
            <div>
              <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Adresse e-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                placeholder="vous@exemple.com"
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-[#1E5F7A] focus:ring-1 focus:ring-[#1E5F7A] transition"
              />
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 pr-16 text-white placeholder:text-slate-600 text-sm focus:outline-none focus:border-[#1E5F7A] focus:ring-1 focus:ring-[#1E5F7A] transition"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 hover:text-[#1E5F7A] dark:hover:text-[#F0A500] transition"
                >
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>
            
            {resetSuccess && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-xl px-4 py-3 text-green-500 text-sm">
                Mot de passe réinitialisé avec succès. Connectez-vous.
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl py-3 text-sm transition-all duration-200 shadow-lg shadow-[#1E5F7A]/30 hover:shadow-[#1E5F7A]/50 active:scale-[0.98]"
            >
              {loading ? 'Connexion en cours…' : 'Se connecter'}
            </button>

          </form>
        </div>

        {/* Accent bottom line */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="h-px w-12 bg-[#F0A500]/30" />
          <p className="text-slate-600 text-xs">Solidarité Dentaires © {new Date().getFullYear()}</p>
          <div className="h-px w-12 bg-[#F0A500]/30" />
        </div>

      </div>
    </div>
  )
}