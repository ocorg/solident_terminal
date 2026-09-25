'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { requestMagicLink } from './actions'

export function LoginForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sentTo, setSentTo] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await requestMagicLink({ email })
      setSentTo(res.data.email)
      toast.success('Vérifiez votre boîte mail')
    } catch {
      toast.error("Impossible d'envoyer le lien. Vérifiez l'adresse et réessayez.")
    } finally {
      setLoading(false)
    }
  }

  if (sentTo) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-navy-700">Lien envoyé</p>
        <p className="text-ink-600">
          Si <strong>{sentTo}</strong> correspond à un compte membre, vous allez recevoir un lien de connexion
          valable 24 heures.
        </p>
        <button type="button" onClick={() => setSentTo(null)} className="text-sm text-navy-700 underline">
          Utiliser une autre adresse
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <label htmlFor="login-email" className="block text-sm font-medium text-navy-900">
        Adresse e-mail
      </label>
      <input
        id="login-email"
        type="email"
        required
        autoComplete="email"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="w-full rounded-[10px] border border-navy-100 bg-white px-4 py-3 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-100"
        placeholder="prenom.nom@exemple.com"
      />
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-navy-700 px-4 py-3 font-semibold text-white transition hover:brightness-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && <Spinner />}
        Recevoir mon lien de connexion
      </button>
    </form>
  )
}
