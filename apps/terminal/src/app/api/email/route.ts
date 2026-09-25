import { NextResponse } from 'next/server'

// This route is just a health check for the email system
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    provider: 'Nodemailer / Gmail SMTP',
    from: process.env.GMAIL_USER ?? '(not configured)'
  })
}