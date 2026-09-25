'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, PasswordInput, SubmitButton } from '@/components/form-fields'
import { authClient, authErrorMessage } from '@/lib/auth-client'

export function ResetForm({ token }: { token: string }) {
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (password !== confirm) return void toast.error('Les deux mots de passe ne correspondent pas.')
    setLoading(true)
    try {
      const { error } = await authClient.resetPassword({ newPassword: password, token })
      if (error) return void toast.error(authErrorMessage(error))
      toast.success('Mot de passe enregistré. Vous pouvez vous connecter.')
      router.replace('/connexion')
    } catch {
      toast.error("Le mot de passe n'a pas pu être enregistré. Réessayez.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <Field id="new-password" label="Nouveau mot de passe">
        <PasswordInput id="new-password" required minLength={8} maxLength={128} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>
      <Field id="confirm-password" label="Confirmer le mot de passe">
        <PasswordInput id="confirm-password" required minLength={8} maxLength={128} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
      </Field>
      <SubmitButton loading={loading}>Enregistrer le mot de passe</SubmitButton>
    </form>
  )
}
