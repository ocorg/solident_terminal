import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth-card'
import { getSession } from '@/lib/guards'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Connexion · Solident' }

const errors: Record<string, string> = {
  INVALID_TOKEN: 'Ce lien est invalide ou a déjà été utilisé. Demandez-en un nouveau.',
  EXPIRED_TOKEN: 'Ce lien a expiré. Demandez-en un nouveau.',
  new_user_signup_disabled: "Cette adresse n'est pas associée à un compte. Créez-en un dans l'onglet Inscription.",
}

export default async function ConnexionPage({ searchParams }: PageProps<'/connexion'>) {
  if (await getSession()) redirect('/admin')
  const { error } = await searchParams
  const message = typeof error === 'string' ? (errors[error] ?? 'La connexion a échoué. Réessayez.') : null

  return (
    <AuthCard
      active="/connexion"
      title="Connexion"
      subtitle="Pas de mot de passe : entrez votre e-mail et cliquez sur le lien que nous vous envoyons."
    >
      {message && (
        <p role="alert" className="mb-4 rounded-[10px] bg-danger/10 px-4 py-3 text-sm text-danger">
          {message}
        </p>
      )}
      <LoginForm />
    </AuthCard>
  )
}
