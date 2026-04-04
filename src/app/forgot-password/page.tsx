'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function ForgotPasswordPage() {
  const [email,     setEmail]     = useState('')
  const [loading,   setLoading]   = useState(false)
  const [sent,      setSent]      = useState(false)
  const [error,     setError]     = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const res = await fetch('/api/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    })
    const data = await res.json()

    setLoading(false)
    if (!res.ok) { setError(data.error); return }
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#0a0f1e] px-4">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-[#1E5F7A] opacity-10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 left-1/3 w-[300px] h-[300px] bg-[#F0A500] opacity-5 rounded-full blur-[100px]" />
      </div>

      <div className="relative w-full max-w-md">
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white border border-gray-200 dark:border-white/10 mb-4 shadow-lg shadow-[#1E5F7A]/20 overflow-hidden">
            <Image src="/Logo_Solident.png" alt="Solident" width={72} height={72} className="object-contain" />
          </div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-semibold tracking-tight">Solident</h1>
          <p className="text-[#1E5F7A] text-sm mt-1 font-medium">Solidarité Dentaires — Espace membre</p>
        </div>

        <div className="bg-white dark:bg-white/5 backdrop-blur-xl border border-gray-200 dark:border-white/10 rounded-2xl p-8 shadow-2xl">
          {sent ? (
            <div className="text-center space-y-4">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-500/20 rounded-2xl flex items-center justify-center text-2xl mx-auto">✅</div>
              <h2 className="text-gray-900 dark:text-white text-lg font-semibold">Email envoyé !</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm">
                Un lien de réinitialisation a été envoyé à <strong>{email}</strong>. Vérifiez votre boîte mail.
              </p>
              <Link href="/login" className="block mt-4 text-[#1E5F7A] text-sm hover:underline">
                ← Retour à la connexion
              </Link>
            </div>
          ) : (
            <>
              <h2 className="text-gray-900 dark:text-white text-xl font-semibold mb-2">Mot de passe oublié</h2>
              <p className="text-gray-500 dark:text-slate-400 text-sm mb-6">
                Entrez votre adresse email et nous vous enverrons un lien de réinitialisation.
              </p>
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Adresse e-mail</label>
                  <input type="email" required value={email} onChange={e => setEmail(e.target.value)}
                    placeholder="vous@exemple.com"
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-3 text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 text-sm focus:outline-none focus:border-[#1E5F7A] focus:ring-1 focus:ring-[#1E5F7A] transition" />
                </div>
                {error && (
                  <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-red-400 text-sm">{error}</div>
                )}
                <button type="submit" disabled={loading}
                  className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-sm transition-all duration-200 shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
                  {loading ? 'Envoi…' : 'Envoyer le lien'}
                </button>
                <Link href="/login" className="block text-center text-gray-400 dark:text-slate-500 text-sm hover:text-[#1E5F7A] transition">
                  ← Retour à la connexion
                </Link>
              </form>
            </>
          )}
        </div>

        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="h-px w-12 bg-[#F0A500]/30" />
          <p className="text-gray-400 dark:text-slate-600 text-xs">Solidarité Dentaires © {new Date().getFullYear()}</p>
          <div className="h-px w-12 bg-[#F0A500]/30" />
        </div>
      </div>
    </div>
  )
}