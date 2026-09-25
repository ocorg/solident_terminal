'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { channels } from '@/lib/realtime'
import { useRealtime } from '@/lib/use-realtime'
import { sendPing } from './actions'

export function RealtimeTest() {
  const [loading, setLoading] = useState(false)
  const [log, setLog] = useState<string[]>([])

  useRealtime(channels.test, 'ping', ({ sentAt, by }) => {
    setLog((l) => [`${new Date().toLocaleTimeString('fr-FR')} · ping de ${by} reçu en ${Date.now() - sentAt} ms`, ...l].slice(0, 10))
  })

  async function onClick() {
    setLoading(true)
    try {
      await sendPing()
      toast.success('Ping envoyé')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onClick}
        disabled={loading}
        className="flex items-center gap-2 rounded-[10px] bg-gold-500 px-4 py-2 font-semibold text-navy-900 transition hover:brightness-95 active:scale-[0.97] disabled:opacity-60"
      >
        {loading && <Spinner />}
        Envoyer un ping
      </button>
      <ul className="space-y-1 text-sm text-ink-600">
        {log.length === 0 ? <li>En attente d&apos;événements…</li> : log.map((line, i) => <li key={i}>{line}</li>)}
      </ul>
    </div>
  )
}
