'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { saveFundraising } from './actions'

export function FundraisingCard({ open, authorization }: { open: boolean; authorization: string }) {
  const router = useRouter()
  const [isOpen, setIsOpen] = useState(open)
  const [ref, setRef] = useState(authorization)
  const [loading, setLoading] = useState(false)
  const dirty = isOpen !== open || ref.trim() !== authorization

  async function save() {
    setLoading(true)
    const res = await saveFundraising({ open: isOpen, authorization: ref })
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(res.data.open ? 'Collecte ouverte sur le site' : 'Collecte fermée sur le site')
    router.refresh()
  }

  return (
    <section className={`card border-s-4 p-5 ${open ? 'border-success' : 'border-gold-500'}`}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-heading text-lg font-bold text-navy-700">Collecte publique sur le site</h2>
        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${open ? 'bg-success/15 text-success' : 'bg-gold-100 text-navy-900'}`}>
          {open ? 'Ouverte' : 'Fermée'}
        </span>
      </div>
      <p className="mb-4 text-sm text-ink-600">
        La loi 18-18 impose une autorisation avant tout appel aux dons auprès du public (demande au moins 30 jours avant, rapport 30 jours après la fin). Fermée : le RIB, le
        formulaire de don et les barres de progression sont masqués partout ; le sponsoring et le bénévolat restent ouverts. Ouverte : la référence de l’autorisation est affichée
        sur la page de don.
      </p>
      <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto] sm:items-center">
        <label className="inline-flex items-center gap-2 text-sm font-medium">
          <input type="checkbox" checked={isOpen} onChange={(e) => setIsOpen(e.target.checked)} className="size-4 accent-navy-700" />
          Collecte ouverte
        </label>
        <input
          value={ref}
          onChange={(e) => setRef(e.target.value)}
          placeholder="Référence de l’autorisation (n°, date, autorité)"
          aria-label="Référence de l’autorisation"
          maxLength={200}
          className="min-w-0 rounded-[10px] border border-navy-100 bg-white px-3 py-2 text-sm"
        />
        <button type="button" onClick={save} disabled={loading || !dirty} className="btn btn-primary px-4 py-2 text-sm">
          {loading && <Spinner />} Enregistrer
        </button>
      </div>
    </section>
  )
}
