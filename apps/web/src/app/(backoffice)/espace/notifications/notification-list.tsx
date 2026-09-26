'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { markRead } from './actions'

type N = { id: string; message: string; href: string | null; read: boolean; when: string; icon: string }

export function NotificationList({ items }: { items: N[] }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const unread = items.filter((i) => !i.read).length

  async function open(n: N) {
    if (!n.read) await markRead({ id: n.id })
    if (n.href) router.push(n.href)
    else router.refresh()
  }
  async function readAll() {
    setBusy(true)
    const res = await markRead({})
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Tout est marqué comme lu')
    router.refresh()
  }

  return (
    <div className="space-y-3">
      {unread > 0 && (
        <button type="button" onClick={readAll} disabled={busy} className="btn btn-ghost px-3 py-1.5 text-sm">
          {busy && <Spinner />} Tout marquer comme lu ({unread})
        </button>
      )}
      {items.length === 0 && <p className="card p-6 text-ink-600">Aucune notification.</p>}
      <ul className="card divide-y divide-navy-100">
        {items.map((n) => (
          <li key={n.id}>
            <button type="button" onClick={() => open(n)} className={`flex w-full items-start gap-3 p-4 text-start hover:bg-cream-50 ${n.read ? 'opacity-70' : ''}`}>
              <span className="text-lg" aria-hidden>
                {n.icon}
              </span>
              <span className="flex-1">
                <span className={n.read ? '' : 'font-semibold'}>{n.message}</span>
                <span className="block text-xs text-ink-600">{n.when}</span>
              </span>
              {!n.read && <span className="mt-2 size-2 rounded-full bg-gold-500" aria-label="non lue" />}
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
