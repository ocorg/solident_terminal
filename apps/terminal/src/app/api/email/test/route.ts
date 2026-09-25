import { NextRequest, NextResponse } from 'next/server'
import { sendDigestEmail } from '@/lib/email'

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get('token')
  if (token !== process.env.Cron_Key) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const to = process.env.GMAIL_USER
  if (!to) {
    return NextResponse.json({ error: 'GMAIL_USER not configured' }, { status: 500 })
  }

  try {
    await sendDigestEmail(to, 'Test Admin', [
      { action_type: 'task_assigned', payload: { title: 'Test — SMTP connection verified' } }
    ])
    return NextResponse.json({ status: 'ok', message: `Test email sent to ${to}` })
  } catch (e: any) {
    return NextResponse.json({ status: 'error', message: e?.message ?? String(e) }, { status: 500 })
  }
}