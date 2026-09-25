import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getSession } from '@/lib/guards'
import { LoginForm } from './login-form'

export const metadata: Metadata = { title: 'Connexion · Solident' }

const errors: Record<string, string> = {
  INVALID_TOKEN: 'Ce lien est invalide ou a déjà été utilisé. Demandez-en un nouveau.',
  EXPIRED_TOKEN: 'Ce lien a expiré. Demandez-en un nouveau.',
  new_user_signup_disabled: "Cette adresse n'est pas associée à un compte membre.",
}

export default async function ConnexionPage({ searchParams }: PageProps<'/connexion'>) {
  if (await getSession()) redirect('/admin')
  const { error } = await searchParams
  const message = typeof error === 'string' ? (errors[error] ?? 'La connexion a échoué. Réessayez.') : null

  return (
    <main className="flex flex-1 items-center justify-center bg-cream-50 px-4 py-16">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-card">
        <h1 className="mb-1 font-heading text-2xl font-bold text-navy-700">
          Espace membres<span className="text-gold-500">.</span>
        </h1>
        <p className="mb-6 text-ink-600">Recevez un lien de connexion par e-mail, sans mot de passe.</p>
        {message && (
          <p role="alert" className="mb-4 rounded-[10px] bg-danger/10 px-4 py-3 text-sm text-danger">
            {message}
          </p>
        )}
        <LoginForm />
        <p className="mt-6 text-center text-sm text-ink-600">
          Pas encore de compte ?{' '}
          <Link href="/connexion/demande" className="text-navy-700 underline">
            Demander un accès
          </Link>
        </p>
      </div>
    </main>
  )
}
