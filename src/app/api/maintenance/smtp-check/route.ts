import { NextResponse } from 'next/server'
import { requireBackoffice } from '@/lib/requireBackoffice'
import nodemailer from 'nodemailer'

export const dynamic = 'force-dynamic'

// POST — test SMTP connectivity via nodemailer verify()
export async function POST() {
  const auth = await requireBackoffice()
  if ('error' in auth) return auth.error

  const gmailUser = process.env.GMAIL_USER
  const gmailPass = process.env.GMAIL_PASS

  if (!gmailUser || !gmailPass) {
    return NextResponse.json({
      success: false,
      error:   'GMAIL_USER ou GMAIL_PASS manquant dans les variables d\'environnement',
    }, { status: 500 })
  }

  const transporter = nodemailer.createTransport({
    host:   'smtp.gmail.com',
    port:   465,
    secure: true,
    auth: { user: gmailUser, pass: gmailPass },
  })

  try {
    await transporter.verify()
    return NextResponse.json({
      success:  true,
      message:  'Connexion SMTP Gmail vérifiée avec succès',
      account:  gmailUser,
    })
  } catch (err: any) {
    return NextResponse.json({
      success: false,
      error:   err?.message ?? 'Échec de la vérification SMTP',
      code:    err?.code,
    }, { status: 502 })
  }
}