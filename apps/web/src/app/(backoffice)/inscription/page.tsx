import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { AuthCard } from '@/components/auth-card'
import { getSession } from '@/lib/guards'
import { RequestForm } from './request-form'

export const metadata: Metadata = { title: 'Inscription · Solident' }

export default async function InscriptionPage() {
  if (await getSession()) redirect('/admin')

  return (
    <AuthCard
      active="/inscription"
      title="Créer un compte"
      subtitle="Réservé aux membres de l'association. Chaque compte est validé par un administrateur."
    >
      <RequestForm />
    </AuthCard>
  )
}
