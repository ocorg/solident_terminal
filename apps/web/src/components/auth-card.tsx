import Link from 'next/link'

const tabs = [
  { href: '/connexion', label: 'Connexion' },
  { href: '/inscription', label: 'Inscription' },
] as const

/** Shared frame for /connexion and /inscription: brand header + Connexion / Inscription tabs. */
export function AuthCard({
  active,
  title,
  subtitle,
  children,
}: {
  active: (typeof tabs)[number]['href']
  title: string
  subtitle: string
  children: React.ReactNode
}) {
  return (
    <main className="flex flex-1 items-center justify-center bg-cream-50 px-4 py-16">
      <div className="w-full max-w-md overflow-hidden rounded-xl bg-white shadow-card">
        <div className="bg-navy-700 px-8 py-5 font-heading text-xl font-bold text-white">
          Solident<span className="text-gold-500">.</span>{' '}
          <span className="font-normal text-white/80">Espace membres</span>
        </div>
        <nav className="grid grid-cols-2 border-b border-navy-100" aria-label="Connexion ou inscription">
          {tabs.map((t) => (
            <Link
              key={t.href}
              href={t.href}
              aria-current={t.href === active ? 'page' : undefined}
              className={`py-3 text-center font-semibold transition ${
                t.href === active
                  ? 'border-b-2 border-gold-500 text-navy-700'
                  : 'text-ink-600 hover:bg-navy-100/50 hover:text-navy-700'
              }`}
            >
              {t.label}
            </Link>
          ))}
        </nav>
        <div className="p-8">
          <h1 className="mb-1 font-heading text-2xl font-bold text-navy-700">{title}</h1>
          <p className="mb-6 text-ink-600">{subtitle}</p>
          {children}
        </div>
      </div>
    </main>
  )
}
