'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { uploadToR2 } from '@/components/admin/upload'
import { Spinner } from '@/components/spinner'
import { setDossier } from '@/lib/media-actions'

const MAX = 15 * 1024 * 1024

export function DossierField({ url }: { url: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    if (file.type !== 'application/pdf') return void toast.error('Choisissez un fichier PDF.')
    if (file.size > MAX) return void toast.error('PDF trop lourd (15 Mo maximum). Compressez-le avant de l’envoyer.')
    setBusy(true)
    try {
      const key = await uploadToR2('dossier', file)
      const res = await setDossier({ key })
      if (res.status === 'error') throw new Error(res.message)
      toast.success('Dossier publié sur la page Sponsoring')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'L’envoi a échoué.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    if (!confirm('Retirer le dossier de la page Sponsoring ?')) return
    setBusy(true)
    const res = await setDossier({ key: null })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Dossier retiré')
    router.refresh()
  }

  return (
    <div className="card space-y-4 p-6">
      <div>
        <p className="font-semibold text-navy-700">Dossier de sponsoring (PDF)</p>
        <p className="text-sm text-ink-600">Affiché comme bouton « Télécharger le dossier » sur la page Sponsoring, dans les 3 langues.</p>
      </div>
      {url ? (
        <p className="text-sm">
          En ligne :{' '}
          <a href={url} target="_blank" rel="noreferrer" className="break-all font-semibold text-navy-700 underline">
            ouvrir le PDF
          </a>
        </p>
      ) : (
        <p className="text-sm text-ink-600">Aucun dossier pour l’instant : la page indique qu’il est disponible sur demande.</p>
      )}
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="btn btn-primary">
          {busy && <Spinner />} {url ? 'Remplacer le PDF' : 'Envoyer le PDF'}
        </button>
        {url && (
          <button type="button" disabled={busy} onClick={remove} className="text-sm text-danger underline">
            Retirer
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="application/pdf" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  )
}
