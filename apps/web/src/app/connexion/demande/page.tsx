import type { Metadata } from 'next'
import Link from 'next/link'
import { RequestForm } from './request-form'

export const metadata: Metadata = { title: "Demande d'accès · Solident" }

export default function DemandePage() {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream-50 px-4 py-16">
      <div className="w-full max-w-md rounded-xl bg-white p-8 shadow-card">
        <h1 className="mb-1 font-heading text-2xl font-bold text-navy-700">
          Demander un accès<span className="text-gold-500">.</span>
        </h1>
        <p className="mb-6 text-ink-600">Réservé aux membres de l&apos;association. Un administrateur valide chaque demande.</p>
        <RequestForm />
        <p className="mt-6 text-center text-sm text-ink-600">
          Déjà validé ?{' '}
          <Link href="/connexion" className="text-navy-700 underline">
            Se connecter
          </Link>
        </p>
      </div>
    </main>
  )
}
