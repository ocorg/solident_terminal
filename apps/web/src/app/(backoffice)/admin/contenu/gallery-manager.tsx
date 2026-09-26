'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { shrinkImage, uploadToR2 } from '@/components/admin/upload'
import { Spinner } from '@/components/spinner'
import { addGalleryImage, deleteGalleryImage } from '@/lib/media-actions'

/** Several photos at once: each is shrunk (1600 px WebP, EXIF removed), uploaded, then added to the gallery. */
export function GalleryManager({ actionId, photos }: { actionId: string; photos: { id: string; url: string }[] }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  async function onFiles(files: FileList | null) {
    if (!files?.length) return
    const list = [...files].filter((f) => f.type.startsWith('image/'))
    let done = 0
    let failed = 0
    for (const file of list) {
      setProgress(`${done + 1} / ${list.length}`)
      try {
        const small = await shrinkImage(file, 1600)
        const dims = await createImageBitmap(small).then((b) => ({ width: b.width, height: b.height }))
        const key = await uploadToR2('action', small)
        const res = await addGalleryImage({ actionId, key, ...dims })
        if (res.status === 'error') throw new Error(res.message)
        done++
      } catch {
        failed++
      }
    }
    setProgress(null)
    if (input.current) input.current.value = ''
    if (done) toast.success(`${done} photo${done > 1 ? 's' : ''} ajoutée${done > 1 ? 's' : ''}`)
    if (failed) toast.error(`${failed} photo${failed > 1 ? 's' : ''} n’ont pas pu être envoyée${failed > 1 ? 's' : ''}.`)
    router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Supprimer cette photo ?')) return
    setDeleting(id)
    const res = await deleteGalleryImage({ id })
    setDeleting(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Photo supprimée')
    router.refresh()
  }

  return (
    <div className="card space-y-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-semibold text-navy-700">Galerie ({photos.length})</p>
          <p className="text-xs text-ink-600">Floutez les visages des bénéficiaires, surtout des enfants, avant l’envoi (spec §8).</p>
        </div>
        <button type="button" disabled={progress !== null} onClick={() => input.current?.click()} className="btn btn-primary px-4 py-2 text-sm">
          {progress ? (
            <>
              <Spinner /> Envoi {progress}
            </>
          ) : (
            '+ Ajouter des photos'
          )}
        </button>
      </div>
      {photos.length > 0 && (
        <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {photos.map((p) => (
            <li key={p.id} className="group relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="" className="aspect-square w-full rounded-lg object-cover" />
              <button
                type="button"
                onClick={() => remove(p.id)}
                disabled={deleting === p.id}
                className="absolute end-1 top-1 rounded-md bg-white/90 px-2 py-0.5 text-xs font-semibold text-danger opacity-0 transition group-hover:opacity-100 focus:opacity-100"
              >
                {deleting === p.id ? <Spinner /> : 'Supprimer'}
              </button>
            </li>
          ))}
        </ul>
      )}
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onFiles(e.target.files)} />
    </div>
  )
}
