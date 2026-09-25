'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Image from 'next/image'

export default function SetPasswordPage() {
  const supabase = createClient()
  const router   = useRouter()

  const [password,  setPassword]  = useState('')
  const [confirm,   setConfirm]   = useState('')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [showPass,  setShowPass]  = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password !== confirm) { setError('Les mots de passe ne correspondent pas'); return }
    if (password.length < 8)  { setError('Minimum 8 caractères requis'); return }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)

    if (error) { setError(error.message); return }

    router.push('/dashboard')
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1e] px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#1E5F7A] opacity-10 rounded-full blur-[120px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-gray-200 dark:border-white/10 mb-4 shadow-lg overflow-hidden">
            <Image src="/Logo_Solident.png" alt="Solident" width={72} height={72} className="object-contain" />
          </div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-semibold">Bienvenue sur Solident</h1>
          <p className="text-[#1E5F7A] text-sm mt-1 font-medium">Créez votre mot de passe pour continuer</p>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          <h2 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">Définir mon mot de passe</h2>
          <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">Choisissez un mot de passe sécurisé d'au moins 8 caractères.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Mot de passe</label>
              <div className="relative">
                <input type={showPass ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)} placeholder="••••••••"
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 pr-12 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:border-[#1E5F7A] transition" />
                <button type="button" onClick={() => setShowPass(!showPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1E5F7A] transition">
                  {showPass ? (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  )}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Confirmer le mot de passe</label>
              <input type={showPass ? 'text' : 'password'} required value={confirm}
                onChange={e => setConfirm(e.target.value)} placeholder="••••••••"
                className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 text-sm focus:outline-none focus:border-[#1E5F7A] transition" />
            </div>

            {/* Strength bar */}
            {password && (
              <div className="space-y-1">
                <div className="flex gap-1">
                  {[1,2,3,4].map(i => (
                    <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                      password.length < 6  && i === 1 ? 'bg-red-400' :
                      password.length < 8  && i <= 2 ? 'bg-orange-400' :
                      password.length < 12 && i <= 3 ? 'bg-yellow-400' :
                      i <= 4 ? 'bg-green-400' : 'bg-gray-200 dark:bg-white/10'
                    }`} />
                  ))}
                </div>
                <p className="text-xs text-gray-400 dark:text-slate-500">
                  {password.length < 6 ? 'Trop court' : password.length < 8 ? 'Faible' : password.length < 12 ? 'Correct' : 'Fort'}
                </p>
              </div>
            )}

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
            )}

            <button type="submit" disabled={loading}
              className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-all shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
              {loading ? 'Enregistrement…' : 'Accéder à la plateforme'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}