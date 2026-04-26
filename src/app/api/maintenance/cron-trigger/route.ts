import { NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/requireBackoffice'

export const dynamic = 'force-dynamic'

// POST — manually trigger the email digest cron
export async function POST() {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solident-terminal.vercel.app'
  const cronKey = process.env.Cron_Key

  if (!cronKey) {
    return NextResponse.json({ error: 'Cron_Key non configurée dans les variables d\'environnement' }, { status: 500 })
  }

  try {
    const res = await fetch(`${appUrl}/api/cron/digest`, {
      method:  'GET',
      headers: { Authorization: `Bearer ${cronKey}` },
    })

    const data = await res.json()

    if (!res.ok) {
      return NextResponse.json({
        success: false,
        status:  res.status,
        detail:  data,
      }, { status: 502 })
    }

    return NextResponse.json({ success: true, result: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? 'Erreur interne' }, { status: 500 })
  }
}