'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { authClient, authErrorMessage } from '@/lib/auth-client'

export function ForgotForm() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/mot-de-passe/nouveau' })
      if (error) return void toast.error(authErrorMessage(error))
      setSent(true)
      toast.success('Vérifiez votre boîte mail')
    } catch {
      toast.error("Impossible d'envoyer le lien. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  if (sent) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-navy-700">Vérifiez votre boîte mail</p>
        <p className="text-ink-600">
          Si un compte existe pour <strong>{email}</strong>, vous allez recevoir un lien valable 1 heure.
        </p>
        <Link href="/connexion" className="text-sm text-navy-700 underline">
          Retour à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="forgot-email" label="Adresse e-mail">
        <input id="forgot-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
      </Field>
      <SubmitButton loading={loading}>Envoyer le lien</SubmitButton>
      <Link href="/connexion" className="block text-center text-sm text-ink-600 hover:text-navy-700 hover:underline">
        Retour à la connexion
      </Link>
    </form>
  )
}
