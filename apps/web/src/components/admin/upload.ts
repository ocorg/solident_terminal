'use client'

import { getMediaUploadUrl } from '@/lib/media-actions'

/** Every uploaded image is compressed to at most this size (owner rule, 27 Oct 2026). Same limit on the server (lib/r2.ts). */
export const IMAGE_MAX_BYTES = 100 * 1024

/**
 * Shrinks an image to at most `maxSide` px and re-encodes it (WebP, JPEG where the browser cannot
 * write WebP) until it weighs at most 100 KB: lowers the quality first, then the dimensions.
 * Re-encoding also strips EXIF metadata such as phone GPS positions. Keeps transparency for logos (WebP).
 */
export async function shrinkImage(file: File, maxSide = 1200, quality = 0.85, maxBytes = IMAGE_MAX_BYTES): Promise<File> {
  const bitmap = await createImageBitmap(file)
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')!
  let scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
  let q = quality
  let blob: Blob | null = null
  for (let i = 0; i < 20; i++) {
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    blob = await encode(canvas, q)
    if (blob.size <= maxBytes) break
    if (q > 0.55) q = Math.max(0.55, q - 0.1)
    else scale *= 0.8
  }
  bitmap.close()
  if (!blob || blob.size > maxBytes) throw new Error('Image impossible à compresser sous 100 Ko.')
  const ext = blob.type === 'image/webp' ? 'webp' : 'jpg'
  return new File([blob], file.name.replace(/\.[^.]+$/, '') + '.' + ext, { type: blob.type })
}

/** WebP when supported (older Safari returns PNG for WebP requests: then JPEG). */
async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const toBlob = (type: string) => new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, type, quality))
  const webp = await toBlob('image/webp')
  if (webp && webp.type === 'image/webp') return webp
  const jpeg = await toBlob('image/jpeg')
  if (!jpeg) throw new Error('Image illisible')
  return jpeg
}

/** Presigned upload straight from the browser to the public R2 bucket; returns the object key. */
export async function uploadToR2(target: 'team' | 'partner' | 'event' | 'action' | 'programme' | 'dossier', file: File): Promise<string> {
  const res = await getMediaUploadUrl({ target, contentType: file.type, size: file.size })
  if (res.status === 'error') throw new Error(res.message)
  const put = await fetch(res.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
  if (!put.ok) throw new Error(`Envoi refusé par le stockage (${put.status})`)
  return res.data.key
}
