import Link from 'next/link'
import { countStatusLabel } from '@/lib/inventory/labels'
import { Tag } from './ui'

export type CountRow = {
  id: string
  status: 'brouillon' | 'valide'
  createdAt: string
  validatedAt: string | null
  createdBy: string
  validatedBy: string | null
  lines: number
  project?: { id: string; name: string } | null
}

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Africa/Casablanca' })

/** Counts (drafts first), each opening the count sheet or the frozen bilan. */
export function CountList({ counts, empty }: { counts: CountRow[]; empty: string }) {
  if (!counts.length) return <p className="card p-6 text-center text-sm text-ink-600">{empty}</p>
  return (
    <ul className="space-y-2">
      {counts.map((c) => (
        <li key={c.id}>
          <Link
            href={`/espace/inventaire/comptages/${c.id}`}
            className={`card card-hover flex flex-wrap items-center gap-3 border-s-4 px-4 py-3 ${c.status === 'brouillon' ? 'border-gold-500' : 'border-success'}`}
          >
            <Tag tone={c.status === 'brouillon' ? 'gold' : 'success'}>{countStatusLabel[c.status]}</Tag>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold text-navy-900">
                {c.project ? c.project.name : 'Inventaire général'} · {day(c.validatedAt ?? c.createdAt)}
              </span>
              <span className="block text-sm text-ink-600">
                {c.lines} ligne(s) · ouvert par {c.createdBy}
                {c.validatedBy && ` · validé par ${c.validatedBy}`}
              </span>
            </span>
            <span className="text-sm font-semibold text-navy-700">{c.status === 'brouillon' ? 'Continuer →' : 'Voir le bilan →'}</span>
          </Link>
        </li>
      ))}
    </ul>
  )
}
