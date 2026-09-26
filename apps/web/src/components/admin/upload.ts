'use client'

import { getMediaUploadUrl } from '@/lib/media-actions'

/**
 * Shrinks an image to at most `maxSide` px and re-encodes it as WebP (keeps transparency for logos).
 * Re-encoding also strips EXIF metadata such as phone GPS positions.
 */
export async function shrinkImage(file: File, maxSide = 1200, quality = 0.85): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * scale)
  canvas.height = Math.round(bitmap.height * scale)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', quality))
  if (!blob) throw new Error('Image illisible')
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.webp', { type: 'image/webp' })
}

/** Presigned upload straight from the browser to the public R2 bucket; returns the object key. */
export async function uploadToR2(target: 'team' | 'partner' | 'dossier', file: File): Promise<string> {
  const res = await getMediaUploadUrl({ target, contentType: file.type, size: file.size })
  if (res.status === 'error') throw new Error(res.message)
  const put = await fetch(res.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  if (!put.ok) throw new Error(`Envoi refusé par le stockage (${put.status})`)
  return res.data.key
}
