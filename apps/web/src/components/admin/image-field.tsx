'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { setImage } from '@/lib/media-actions'
import { shrinkImage, uploadToR2 } from './upload'

/** Photo / logo with "Changer" and "Retirer": resize in the browser → R2 → save on the record. */
export function ImageField({
  entity,
  id,
  url,
  alt,
  round = false,
  maxSide = 1200,
}: {
  entity: 'team' | 'partner' | 'event'
  id: string
  url: string | null
  alt: string
  round?: boolean
  maxSide?: number
}) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) return void toast.error('Choisissez une image (JPG, PNG ou WebP).')
    setBusy(true)
    try {
      const small = await shrinkImage(file, maxSide)
      const key = await uploadToR2(entity, small)
      const res = await setImage({ entity, id, key })
      if (res.status === 'error') throw new Error(res.message)
      toast.success('Image mise à jour')
      router.refresh()
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'L’envoi a échoué.')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  async function remove() {
    setBusy(true)
    const res = await setImage({ entity, id, key: null })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Image retirée')
    router.refresh()
  }

  const shape = round ? 'rounded-full' : 'rounded-lg'
  return (
    <div className="flex items-center gap-3">
      <div className={`relative flex size-16 shrink-0 items-center justify-center overflow-hidden bg-navy-100 ${shape}`}>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={url} alt={alt} className={`size-full ${round ? 'object-cover' : 'object-contain p-1'}`} />
        ) : (
          <span className="text-xs text-ink-600">Aucune</span>
        )}
        {busy && (
          <span className="absolute inset-0 flex items-center justify-center bg-white/70 text-navy-700">
            <Spinner />
          </span>
        )}
      </div>
      <div className="flex flex-col items-start gap-1 text-sm">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="font-semibold text-navy-700 underline disabled:opacity-50">
          {url ? 'Changer' : 'Ajouter'}
        </button>
        {url && (
          <button type="button" disabled={busy} onClick={remove} className="text-danger underline disabled:opacity-50">
            Retirer
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  )
}
