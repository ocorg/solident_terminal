'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { setInquiryStatus } from './actions'

const options = [
  { value: 'new', label: 'Nouveau' },
  { value: 'in_progress', label: 'En cours' },
  { value: 'closed', label: 'Traité' },
]

export function StatusSelect({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [loading, setLoading] = useState(false)

  async function change(next: string) {
    const prev = value
    setValue(next)
    setLoading(true)
    const res = await setInquiryStatus({ id, status: next })
    setLoading(false)
    if (res.status === 'error') {
      setValue(prev)
      return void toast.error(res.message)
    }
    toast.success('Statut mis à jour')
    router.refresh()
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select value={value} onChange={(e) => change(e.target.value)} disabled={loading} className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm" aria-label="Statut">
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {loading && <Spinner />}
    </span>
  )
}
