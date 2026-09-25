import type { Metadata } from 'next'
import { AuthCard } from '@/components/auth-card'
import { ForgotForm } from './forgot-form'

export const metadata: Metadata = { title: 'Mot de passe oublié · Solident' }

export default function MotDePasseOubliePage() {
  return (
    <AuthCard
      active="/connexion"
      title="Mot de passe oublié"
      subtitle="Entrez votre e-mail : nous vous envoyons un lien pour choisir un nouveau mot de passe. Aussi valable si vous n'avez jamais eu de mot de passe."
    >
      <ForgotForm />
    </AuthCard>
  )
}
