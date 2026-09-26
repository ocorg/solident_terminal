'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { confirmDonation, getProofLink, rejectDonation } from './actions'

const dh = (n: number) => new Intl.NumberFormat('fr-MA').format(n) + ' DH'

export function ProofButton({ id }: { id: string }) {
  const [loading, setLoading] = useState(false)
  async function open() {
    setLoading(true)
    // Open the tab synchronously so pop-up blockers allow it, then point it at the signed link.
    const tab = window.open('', '_blank')
    const res = await getProofLink({ id })
    setLoading(false)
    if (res.status === 'error') {
      tab?.close()
      return void toast.error(res.message)
    }
    if (tab) tab.location.href = res.data.url
    else window.location.href = res.data.url
  }
  return (
    <button type="button" onClick={open} disabled={loading} className="inline-flex items-center gap-1 text-sm text-navy-700 underline disabled:opacity-60">
      {loading && <Spinner />} Voir
    </button>
  )
}

export function DecisionButtons({ id, amountDh, status }: { id: string; amountDh: number; status: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState<'confirm' | 'reject' | null>(null)
  const [rejecting, setRejecting] = useState(false)
  const [note, setNote] = useState('')

  async function confirm() {
    setBusy('confirm')
    const res = await confirmDonation({ id })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(`Don de ${dh(amountDh)} confirmé · total ${dh(res.data.raisedDh)}`)
    router.refresh()
  }

  async function reject() {
    setBusy('reject')
    const res = await rejectDonation({ id, note: note || undefined })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Don refusé')
    setRejecting(false)
    router.refresh()
  }

  if (rejecting) {
    return (
      <div className="flex flex-col gap-2">
        <input
          autoFocus
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Motif (facultatif)"
          maxLength={500}
          className="rounded-lg border border-navy-100 px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <button type="button" onClick={reject} disabled={busy !== null} className="btn bg-danger px-3 py-1.5 text-sm text-white">
            {busy === 'reject' && <Spinner />} Refuser
          </button>
          <button type="button" onClick={() => setRejecting(false)} className="text-sm text-ink-600 underline">
            Annuler
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      {status !== 'confirmed' && (
        <button type="button" onClick={confirm} disabled={busy !== null} className="btn bg-success px-3 py-1.5 text-sm text-white">
          {busy === 'confirm' && <Spinner />} Confirmer
        </button>
      )}
      {status !== 'rejected' && (
        <button type="button" onClick={() => setRejecting(true)} disabled={busy !== null} className="btn btn-ghost px-3 py-1.5 text-sm">
          {status === 'confirmed' ? 'Annuler (refuser)' : 'Refuser'}
        </button>
      )}
    </div>
  )
}
