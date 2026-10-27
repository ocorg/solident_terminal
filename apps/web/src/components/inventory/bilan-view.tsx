import { categoryPlural, CATEGORIES, formatQty, outcomeLabel, outcomeTone } from '@/lib/inventory/labels'
import type { CountDTO } from '@/lib/inventory/queries'
import { PrintButton } from './print-button'
import { Tag } from '@/components/ui'

const day = (iso: string) => new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Africa/Casablanca' })
const r2 = (x: number) => Math.round(x * 100) / 100

/** Frozen bilan of a validated count: per item consumed / missing / surplus, then per-holder detail. Prints cleanly. */
export function BilanView({ count }: { count: CountDTO }) {
  const counted = count.lines.filter((l) => l.countedQty !== null)
  type Row = { name: string; unit: string; category: CountDTO['lines'][number]['item']['category']; expected: number; counted: number; consumed: number; lost: number; surplus: number }
  const byItem = new Map<string, Row>()
  for (const l of counted) {
    const e = Number(l.expectedQty ?? 0)
    const c = Number(l.countedQty)
    const gap = r2(c - e)
    const row = byItem.get(l.item.id) ?? { name: l.item.name, unit: l.item.unit, category: l.item.category, expected: 0, counted: 0, consumed: 0, lost: 0, surplus: 0 }
    row.expected = r2(row.expected + e)
    row.counted = r2(row.counted + c)
    if (l.outcome === 'consommation') row.consumed = r2(row.consumed - gap)
    if (l.outcome === 'perte') row.lost = r2(row.lost - gap)
    if (l.outcome === 'ajustement') row.surplus = r2(row.surplus + gap)
    byItem.set(l.item.id, row)
  }
  const rows = [...byItem.values()]
  const totals = { consumed: rows.filter((r) => r.consumed).length, lost: rows.filter((r) => r.lost).length, surplus: rows.filter((r) => r.surplus).length }
  const uncounted = count.lines.length - counted.length
  const cell = 'px-2 py-1.5 text-end tabular-nums'
  const dash = <span className="text-ink-600/50">—</span>

  return (
    <article className="space-y-6 print:space-y-4 print:text-[11pt] print:text-black">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-gold-700 print:text-black">Association Solident · Bilan d’inventaire</p>
          <h1 className="font-heading text-2xl font-bold text-navy-900 print:text-black">{count.project ? count.project.name : 'Inventaire général'}</h1>
          <p className="text-sm text-ink-600 print:text-black">
            Validé le {count.validatedAt && day(count.validatedAt)} par {count.validatedBy} · ouvert par {count.createdBy}
          </p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Tag tone="success">Validé · lecture seule</Tag>
          <PrintButton />
        </div>
      </header>
      {count.notes && <p className="whitespace-pre-wrap rounded-[10px] bg-white p-3 text-sm print:border print:border-black/20 print:p-2">{count.notes}</p>}

      <div className="grid grid-cols-3 gap-2 text-center print:gap-1">
        {(
          [
            ['Articles consommés', totals.consumed, 'border-navy-700'],
            ['Articles manquants', totals.lost, 'border-danger'],
            ['Surplus trouvés', totals.surplus, 'border-gold-500'],
          ] as const
        ).map(([label, v, border]) => (
          <div key={label} className={`rounded-[10px] border-s-4 bg-white p-3 print:border print:border-black/30 ${border}`}>
            <p className="font-heading text-2xl font-bold">{v}</p>
            <p className="text-xs text-ink-600 print:text-black">{label}</p>
          </div>
        ))}
      </div>

      {CATEGORIES.map((cat) => {
        const list = rows.filter((r) => r.category === cat)
        if (!list.length) return null
        return (
          <section key={cat} className="break-inside-avoid-page">
            <h2 className="mb-1 font-heading text-lg font-bold">{categoryPlural[cat]}</h2>
            <div className="overflow-x-auto rounded-[10px] bg-white print:overflow-visible print:rounded-none">
              <table className="w-full min-w-[520px] border-collapse text-sm print:min-w-0">
                <thead>
                  <tr className="border-b-2 border-navy-100 text-xs uppercase tracking-wide text-ink-600 print:border-black/40 print:text-black">
                    <th className="px-2 py-1.5 text-start">Article</th>
                    <th className={cell}>Attendu</th>
                    <th className={cell}>Compté</th>
                    <th className={cell}>Consommé</th>
                    <th className={cell}>Manquant</th>
                    <th className={cell}>Surplus</th>
                  </tr>
                </thead>
                <tbody>
                  {list.map((r) => (
                    <tr key={r.name} className="break-inside-avoid border-b border-navy-100 last:border-0 print:border-black/15">
                      <td className="px-2 py-1.5">
                        {r.name} <span className="text-xs text-ink-600 print:text-black">({r.unit})</span>
                      </td>
                      <td className={cell}>{formatQty(r.expected)}</td>
                      <td className={`${cell} font-semibold`}>{formatQty(r.counted)}</td>
                      <td className={cell}>{r.consumed ? formatQty(r.consumed) : dash}</td>
                      <td className={`${cell} ${r.lost ? 'font-semibold text-danger print:text-black' : ''}`}>{r.lost ? formatQty(r.lost) : dash}</td>
                      <td className={cell}>{r.surplus ? `+${formatQty(r.surplus)}` : dash}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )
      })}

      <section className="break-before-page">
        <h2 className="mb-1 font-heading text-lg font-bold">Détail par membre</h2>
        <div className="overflow-x-auto rounded-[10px] bg-white print:overflow-visible">
          <table className="w-full min-w-[520px] border-collapse text-sm print:min-w-0">
            <thead>
              <tr className="border-b-2 border-navy-100 text-xs uppercase tracking-wide text-ink-600 print:border-black/40 print:text-black">
                <th className="px-2 py-1.5 text-start">Membre</th>
                <th className="px-2 py-1.5 text-start">Article</th>
                <th className={cell}>Attendu</th>
                <th className={cell}>Compté</th>
                <th className="px-2 py-1.5 text-start">Résultat</th>
              </tr>
            </thead>
            <tbody>
              {count.lines.map((l) => (
                <tr key={l.id} className="break-inside-avoid border-b border-navy-100 last:border-0 print:border-black/15">
                  <td className="px-2 py-1.5">{l.holder.name}</td>
                  <td className="px-2 py-1.5">
                    {l.item.name}
                    {l.note && <span className="block text-xs text-ink-600 print:text-black">« {l.note} »</span>}
                  </td>
                  <td className={cell}>{l.expectedQty !== null ? formatQty(l.expectedQty) : dash}</td>
                  <td className={cell}>{l.countedQty !== null ? formatQty(l.countedQty) : dash}</td>
                  <td className="px-2 py-1.5">{l.outcome ? <Tag tone={outcomeTone[l.outcome]}>{outcomeLabel[l.outcome]}</Tag> : <span className="text-xs text-ink-600">Non compté</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {uncounted > 0 && <p className="mt-2 text-xs text-ink-600">{uncounted} ligne(s) non comptée(s) : aucun mouvement enregistré pour elles.</p>}
      </section>
    </article>
  )
}
