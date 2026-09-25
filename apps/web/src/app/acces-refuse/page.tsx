import Link from 'next/link'
import { SignOutButton } from '@/components/sign-out-button'

export default function AccesRefuse() {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream-50 px-4 py-16">
      <div className="w-full max-w-md space-y-4 rounded-xl bg-white p-8 text-center shadow-card">
        <h1 className="font-heading text-2xl font-bold text-navy-700">Accès refusé</h1>
        <p className="text-ink-600">Votre compte n&apos;a pas accès à cet espace. Contactez un administrateur.</p>
        <div className="flex justify-center gap-3">
          <Link href="/" className="rounded-[10px] px-3 py-1.5 text-sm text-navy-700 underline">
            Retour au site
          </Link>
          <SignOutButton className="border-navy-100 text-navy-700 hover:bg-navy-100" />
        </div>
      </div>
    </main>
  )
}
