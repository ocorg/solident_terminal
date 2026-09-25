'use client'

import Link from 'next/link'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, PasswordInput, SubmitButton } from '@/components/form-fields'
import { authClient, authErrorMessage } from '@/lib/auth-client'

export function RequestForm() {
  const [form, setForm] = useState({ name: '', email: '', password: '', website: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (form.website) return setDone(true) // honeypot filled: a bot, pretend it worked
    setLoading(true)
    try {
      const { error } = await authClient.signUp.email({ name: form.name.trim(), email: form.email, password: form.password })
      if (error) return void toast.error(authErrorMessage(error))
      setDone(true)
      toast.success('Compte créé, en attente de validation')
    } catch {
      toast.error("Le compte n'a pas pu être créé. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-navy-700">Compte créé</p>
        <p className="text-ink-600">
          Un administrateur doit maintenant le valider. Ensuite, connectez-vous avec <strong>{form.email}</strong> et
          votre mot de passe.
        </p>
        <Link href="/connexion" className="text-sm text-navy-700 underline">
          Aller à la connexion
        </Link>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="reg-name" label="Nom complet">
        <input id="reg-name" required minLength={2} maxLength={80} autoComplete="name" value={form.name} onChange={set('name')} className={inputClass} />
      </Field>
      <Field id="reg-email" label="Adresse e-mail">
        <input id="reg-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} />
      </Field>
      <Field id="reg-password" label={<>Mot de passe <span className="font-normal text-ink-600">(8 caractères minimum)</span></>}>
        <PasswordInput id="reg-password" required minLength={8} maxLength={128} autoComplete="new-password" value={form.password} onChange={set('password')} />
      </Field>
      {/* Honeypot, hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
      <SubmitButton loading={loading}>Créer mon compte</SubmitButton>
    </form>
  )
}
