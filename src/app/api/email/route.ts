import { NextResponse } from 'next/server'

// This route is just a health check for the email system
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    provider: 'Resend',
    from: 'noreply@solident-terminal.vercel.app'
  })
}