import { requireRolePage } from '@/lib/guards'
import { RealtimeTest } from './realtime-test'

export default async function RealtimeTestPage() {
  await requireRolePage('admin')

  return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-card">
      <h1 className="mb-2 font-heading text-2xl font-bold text-navy-700">Test temps réel (Pusher)</h1>
      <p className="mb-6 text-ink-600">
        Ouvrez cette page dans deux onglets : un ping envoyé depuis l&apos;un apparaît instantanément dans les deux.
      </p>
      <RealtimeTest />
    </div>
  )
}
