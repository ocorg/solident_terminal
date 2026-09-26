import { requireRolePage } from '@/lib/guards'
import { CampaignForm } from '../campaign-form'

export default async function NouvelleCampagnePage() {
  await requireRolePage('admin', 'treasurer')
  return (
    <div className="space-y-5">
      <h1 className="font-heading text-2xl font-bold text-navy-700">Nouvelle campagne</h1>
      <CampaignForm />
    </div>
  )
}
