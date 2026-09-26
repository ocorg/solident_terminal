import { prisma } from '@solident/db'
import { requireRole } from '@/lib/guards'

const profileLabel = { etudiant: 'Étudiant', praticien: 'Praticien', public: 'Public' }
const statusLabel = { new: 'Nouvelle', processed: 'Traitée', cancelled: 'Annulée' }

// CSV for Excel: UTF-8 BOM (accents, Arabic) and ";" separator (French/Moroccan Excel default).
const cell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v)
  // Neutralize spreadsheet formulas in user-typed text (CSV injection).
  const safe = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s
  return /[";\n\r]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
}

export async function GET(request: Request) {
  try {
    await requireRole('admin', 'hr')
  } catch {
    return new Response('Accès refusé', { status: 403 })
  }
  const eventId = new URL(request.url).searchParams.get('evenement') ?? ''
  if (!/^[0-9a-f-]{36}$/i.test(eventId)) return new Response('Événement manquant', { status: 400 })
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { slug: true } })
  if (!event) return new Response('Événement introuvable', { status: 404 })

  const rows = await prisma.registration.findMany({ where: { eventId }, orderBy: { createdAt: 'asc' } })
  const header = ['Nom', 'Téléphone', 'E-mail', 'Ville', 'Profil', 'Remarque', 'Statut', 'Inscrit le']
  const lines = rows.map((r) =>
    [
      r.fullName,
      r.phone,
      r.email,
      r.city,
      profileLabel[r.profile],
      r.note,
      statusLabel[r.status],
      r.createdAt.toLocaleString('fr-FR', { timeZone: 'Africa/Casablanca' }),
    ]
      .map(cell)
      .join(';'),
  )
  const csv = '﻿' + [header.join(';'), ...lines].join('\r\n')
  return new Response(csv, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="inscriptions-${event.slug}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
