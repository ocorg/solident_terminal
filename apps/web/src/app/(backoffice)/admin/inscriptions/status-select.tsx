'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { updateRegistration } from './actions'

const options = [
  { value: 'new', label: 'Nouvelle' },
  { value: 'processed', label: 'Traitée' },
  { value: 'cancelled', label: 'Annulée (libère la place)' },
]

export function RegistrationStatus({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [value, setValue] = useState(status)
  const [loading, setLoading] = useState(false)

  async function change(next: string) {
    const prev = value
    setValue(next)
    setLoading(true)
    const res = await updateRegistration({ id, status: next })
    setLoading(false)
    if (res.status === 'error') {
      setValue(prev)
      return void toast.error(res.message)
    }
    toast.success('Inscription mise à jour')
    router.refresh()
  }

  return (
    <span className="inline-flex items-center gap-2">
      <select value={value} onChange={(e) => change(e.target.value)} disabled={loading} aria-label="Statut" className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm">
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
