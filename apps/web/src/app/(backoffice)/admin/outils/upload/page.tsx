import { requireRolePage } from '@/lib/guards'
import { UploadTest } from './upload-test'

export default async function UploadTestPage() {
  await requireRolePage('admin')

  return (
    <div className="mx-auto max-w-3xl rounded-xl bg-white p-8 shadow-card">
      <h1 className="mb-2 font-heading text-2xl font-bold text-navy-700">Test d&apos;envoi R2</h1>
      <p className="mb-6 text-ink-600">
        Envoie un fichier directement du navigateur vers Cloudflare R2 via un lien signé (images ≤ 8 Mo, PDF ≤ 15 Mo,
        preuves ≤ 5 Mo). Les fichiers vont dans le dossier <code>tests/</code>.
      </p>
      <UploadTest />
    </div>
  )
}
