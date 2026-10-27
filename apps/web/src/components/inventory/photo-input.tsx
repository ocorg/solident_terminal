'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { shrinkImage } from '@/components/admin/upload'
import { Spinner } from '@/components/spinner'
import { getItemPhotoUploadUrl } from '@/lib/inventory/actions'
import { IconCamera } from '@/components/ui/icons'

/**
 * Item reference photo: opens the phone camera directly, shrinks to 1280 px WebP in the browser
 * (phone photos are several MB; this also strips GPS data), uploads to R2 and returns the key.
 */
export function PhotoInput({ onUploaded, preview }: { onUploaded: (key: string, localUrl: string) => void; preview?: string | null }) {
  const [busy, setBusy] = useState(false)
  const [local, setLocal] = useState<string | null>(null)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      const small = await shrinkImage(file, 1280, 0.82)
      const res = await getItemPhotoUploadUrl({ contentType: small.type, size: small.size })
      if (res.status === 'error') throw new Error(res.message)
      const put = await fetch(res.data.uploadUrl, { method: 'PUT', body: small, headers: { 'Content-Type': small.type } })
      if (!put.ok) throw new Error('Envoi de la photo refusé. Réessayez.')
      const url = URL.createObjectURL(small)
      setLocal(url)
      onUploaded(res.data.key, url)
      toast.success('Photo ajoutée')
    } catch (e) {
      // Browser decoding errors are in English: show a French message instead.
      toast.error(
        e instanceof DOMException
          ? 'Cette image ne peut pas être lue. Essayez une autre photo (JPEG ou PNG).'
          : e instanceof TypeError
            ? 'Pas de réseau : la photo n’a pas pu être envoyée. Réessayez.'
            : e instanceof Error
              ? e.message
              : 'La photo n’a pas pu être envoyée.',
      )
    } finally {
      setBusy(false)
    }
  }

  const shown = local ?? preview
  return (
    <label
      className={`group flex cursor-pointer items-center gap-4 rounded-[12px] border border-dashed border-navy-700/30 bg-white p-3 transition hover:border-navy-700 hover:bg-navy-100/30 ${busy ? 'pointer-events-none opacity-70' : ''}`}
    >
      <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-navy-100 text-navy-700">
        {busy ? (
          <Spinner />
        ) : shown ? (
          // eslint-disable-next-line @next/next/no-img-element -- local preview / R2 image
          <img src={shown} alt="" className="size-full object-cover" />
        ) : (
          <IconCamera className="size-8" />
        )}
      </span>
      <span className="min-w-0">
        <span className="block font-semibold text-navy-900">{busy ? 'Envoi de la photo…' : shown ? 'Changer la photo' : 'Ajouter une photo'}</span>
        <span className="block text-xs text-ink-600">Ouvre l’appareil photo sur un téléphone. Aide les membres à reconnaître l’article.</span>
      </span>
      <input type="file" accept="image/*" capture="environment" className="sr-only" disabled={busy} onChange={(e) => onFile(e.target.files?.[0])} />
    </label>
  )
}
