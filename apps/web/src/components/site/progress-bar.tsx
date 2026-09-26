'use client'

import { useFormatter, useTranslations } from 'next-intl'
import { useState } from 'react'
import { channels } from '@/lib/realtime'
import { useRealtime } from '@/lib/use-realtime'

type Totals = { raisedDh: number; donorsCount: number; goalDh: number }

/** Campaign progress (spec §8): 14 px gold bar, raised / goal / % / donors, live via Pusher. */
export function ProgressBar({ campaignId, initial, dark = false }: { campaignId: string; initial: Totals; dark?: boolean }) {
  const t = useTranslations('Donate')
  const format = useFormatter()
  const [totals, setTotals] = useState(initial)
  const [pulse, setPulse] = useState(false)

  useRealtime(channels.campaign(campaignId), 'total-updated', (next) => {
    setTotals(next)
    setPulse(true)
    setTimeout(() => setPulse(false), 1200)
  })

  const pct = totals.goalDh > 0 ? Math.min(100, (totals.raisedDh / totals.goalDh) * 100) : 0
  const money = (n: number) => format.number(n, { style: 'currency', currency: 'MAD', maximumFractionDigits: 0 })
  const muted = dark ? 'text-white/75' : 'text-ink-600'

  return (
    <div>
      <div className="mb-2 flex items-end justify-between gap-4">
        <p className={`font-heading text-2xl font-bold ${dark ? 'text-white' : 'text-navy-700'} transition ${pulse ? 'scale-105' : ''}`}>
          {t('raised', { amount: money(totals.raisedDh) })}
        </p>
        <p className="font-heading text-lg font-bold text-gold-500">{format.number(pct / 100, { style: 'percent', maximumFractionDigits: 0 })}</p>
      </div>
      <div
        className={`h-3.5 overflow-hidden rounded-full ${dark ? 'bg-white/15' : 'bg-navy-100'}`}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={totals.goalDh}
        aria-valuenow={totals.raisedDh}
        aria-valuetext={`${money(totals.raisedDh)} / ${money(totals.goalDh)}`}
      >
        <div className="h-full rounded-full bg-gold-500 transition-[width] duration-1000 ease-out" style={{ width: `${pct}%` }} />
      </div>
      <div className={`mt-2 flex flex-wrap justify-between gap-2 text-sm ${muted}`}>
        <span>{t('goal', { amount: money(totals.goalDh) })}</span>
        <span className="flex items-center gap-2">
          {t('donors', { count: totals.donorsCount })}
          <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-success">
            <span className="size-1.5 animate-pulse rounded-full bg-success" />
            {t('live')}
          </span>
        </span>
      </div>
    </div>
  )
}
