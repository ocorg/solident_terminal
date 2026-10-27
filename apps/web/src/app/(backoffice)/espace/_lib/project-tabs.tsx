import Link from 'next/link'

/** Tabs of a project page: overview (tasks, team) and inventory. Each tab has its own URL. */
export function ProjectTabs({ projectId, active }: { projectId: string; active: 'apercu' | 'inventaire' }) {
  const tabs = [
    { key: 'apercu', label: 'Aperçu', href: `/espace/projets/${projectId}` },
    { key: 'inventaire', label: 'Inventaire', href: `/espace/projets/${projectId}/inventaire` },
  ] as const
  return (
    <nav aria-label="Sections du projet" className="print:hidden">
      <ul className="flex gap-1 border-b border-navy-100">
        {tabs.map((t) => (
          <li key={t.key}>
            <Link
              href={t.href}
              aria-current={active === t.key ? 'page' : undefined}
              className={`-mb-px block border-b-2 px-4 py-3 text-sm font-semibold transition ${active === t.key ? 'border-gold-500 text-navy-900' : 'border-transparent text-ink-600 hover:border-navy-100 hover:text-navy-900'}`}
            >
              {t.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}
