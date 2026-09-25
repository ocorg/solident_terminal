'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, PasswordInput, SubmitButton } from '@/components/form-fields'
import { authClient, authErrorMessage } from '@/lib/auth-client'

export function LoginForm() {
  const router = useRouter()
  const [mode, setMode] = useState<'password' | 'link'>('password')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [linkSentTo, setLinkSentTo] = useState<string | null>(null)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      if (mode === 'password') {
        const { error } = await authClient.signIn.email({ email, password, rememberMe: true })
        if (error) return void toast.error(authErrorMessage(error))
        toast.success('Connexion réussie')
        router.replace('/admin')
        router.refresh()
      } else {
        const { error } = await authClient.signIn.magicLink({ email, callbackURL: '/admin', errorCallbackURL: '/connexion' })
        if (error) return void toast.error(authErrorMessage(error))
        setLinkSentTo(email)
        toast.success('Vérifiez votre boîte mail')
      }
    } catch {
      toast.error('Connexion impossible. Vérifiez votre connexion internet et réessayez.')
    } finally {
      setLoading(false)
    }
  }

  if (linkSentTo) {
    return (
      <div className="space-y-3 text-center">
        <p className="text-lg font-semibold text-navy-700">Vérifiez votre boîte mail</p>
        <p className="text-ink-600">
          Si <strong>{linkSentTo}</strong> a un compte validé, vous allez recevoir un lien de connexion valable 24 heures.
        </p>
        <button type="button" onClick={() => setLinkSentTo(null)} className="text-sm text-navy-700 underline">
          Retour
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="login-email" label="Adresse e-mail">
        <input
          id="login-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={inputClass}
        />
      </Field>

      {mode === 'password' && (
        <Field
          id="login-password"
          label={
            <span className="flex items-center justify-between">
              Mot de passe
              <Link href="/mot-de-passe-oublie" className="font-normal text-navy-700 hover:underline">
                Mot de passe oublié ?
              </Link>
            </span>
          }
        >
          <PasswordInput
            id="login-password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
      )}

      <SubmitButton loading={loading}>{mode === 'password' ? 'Se connecter' : 'Recevoir un lien de connexion'}</SubmitButton>

      <button
        type="button"
        onClick={() => setMode((m) => (m === 'password' ? 'link' : 'password'))}
        className="block w-full text-center text-sm text-ink-600 hover:text-navy-700 hover:underline"
      >
        {mode === 'password' ? 'Se connecter sans mot de passe (lien par e-mail)' : 'Se connecter avec mon mot de passe'}
      </button>
    </form>
  )
}
