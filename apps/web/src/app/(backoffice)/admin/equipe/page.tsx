import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { MemberList } from './member-list'

export default async function EquipePage() {
  await requireRolePage('admin', 'media')
  const members = await prisma.teamMember.findMany({ orderBy: [{ order: 'asc' }, { fullName: 'asc' }] })

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Équipe</h1>
      <p className="text-sm text-ink-600">
        Photos : de préférence carrées, visage centré. Elles sont réduites automatiquement avant l’envoi. Sans photo, les initiales s’affichent.
      </p>
      <MemberList
        members={members.map((m) => ({
          id: m.id,
          fullName: m.fullName,
          roleFr: m.roleFr,
          roleAr: m.roleAr ?? '',
          roleEn: m.roleEn ?? '',
          phone: m.phone ?? '',
          isPublicContact: m.isPublicContact,
          isBoard: m.isBoard,
          order: m.order,
          photoUrl: m.photoUrl,
        }))}
      />
    </div>
  )
}
