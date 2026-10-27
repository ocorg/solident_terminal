'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { createCount } from '@/lib/inventory/actions'
import { IconCount } from '@/components/ui/icons'
import { Btn, type BtnVariant } from '@/components/ui'

/** Starts a count (or reopens the project's open draft) and goes to the count sheet. */
export function NewCountButton({
  projectId = null,
  variant = 'secondary',
  size = 'md',
  className = '',
  children = 'Nouvel inventaire',
}: {
  projectId?: string | null
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  children?: React.ReactNode
}) {
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
    <Btn variant={variant} size={size} icon={<IconCount />} busy={busy} onClick={start} className={className}>
      {children}
    </Btn>
  )
}
