'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { createCount } from '@/lib/inventory/actions'

/** Starts a count (or reopens the project's open draft) and goes to the count sheet. */
export function NewCountButton({ projectId = null, className = 'btn btn-ghost', children = 'Nouvel inventaire' }: { projectId?: string | null; className?: string; children?: React.ReactNode }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  async function start() {
    setBusy(true)
    const res = await createCount({ projectId })
    if (res.status === 'error') {
      setBusy(false)
      return void toast.error(res.message)
    }
    toast.success('Inventaire ouvert')
    router.push(`/espace/inventaire/comptages/${res.data.id}`)
  }
  return (
    <button type="button" onClick={start} disabled={busy} className={`${className} disabled:opacity-70`}>
      {busy && <Spinner />} {children}
    </button>
  )
}
