import type { Metadata } from 'next'
import Link from 'next/link'
import { AuthCard } from '@/components/auth-card'
import { ResetForm } from './reset-form'

export const metadata: Metadata = { title: 'Nouveau mot de passe · Solident' }

export default async function NouveauMotDePassePage({ searchParams }: PageProps<'/mot-de-passe/nouveau'>) {
  const { token, error } = await searchParams
  const valid = typeof token === 'string' && token.length > 0 && !error

  return (
    <AuthCard active="/connexion" title="Nouveau mot de passe" subtitle="Choisissez un mot de passe d'au moins 8 caractères.">
      {valid ? (
        <ResetForm token={token} />
      ) : (
        <div className="space-y-3 text-center">
          <p className="text-ink-600">Ce lien est invalide ou a expiré.</p>
          <Link href="/mot-de-passe-oublie" className="text-sm text-navy-700 underline">
            Demander un nouveau lien
          </Link>
        </div>
      )}
    </AuthCard>
  )
}
