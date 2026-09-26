import { prisma } from '@solident/db'
import { requireRolePage } from '@/lib/guards'
import { DossierField } from './dossier-field'

export default async function DocumentsPage() {
  await requireRolePage('admin', 'media')
  const dossier = await prisma.siteSetting.findUnique({ where: { key: 'dossier_url' } })

  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Documents</h1>
      <DossierField url={dossier?.value ?? null} />
    </div>
  )
}
