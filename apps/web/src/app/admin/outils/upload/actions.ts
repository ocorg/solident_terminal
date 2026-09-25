'use server'

import { z } from 'zod'
import { requireRole } from '@/lib/guards'
import { createPrivateViewUrl, createUploadUrl, deleteObject } from '@/lib/r2'

const bucket = z.enum(['public', 'private'])

export async function getTestUploadUrl(input: { bucket: string; contentType: string; size: number }) {
  await requireRole('admin')
  const data = z.object({ bucket, contentType: z.string(), size: z.number().int() }).parse(input)
  const kind = data.bucket === 'private' ? 'proof' : data.contentType === 'application/pdf' ? 'document' : 'image'
  const res = await createUploadUrl({ ...data, kind, folder: 'tests' })
  return { status: 'success' as const, data: res }
}

export async function getTestPrivateLink(input: { key: string }) {
  await requireRole('admin')
  const { key } = z.object({ key: z.string().startsWith('tests/') }).parse(input)
  return { status: 'success' as const, data: { url: await createPrivateViewUrl(key, 60) } }
}

export async function deleteTestFile(input: { bucket: string; key: string }) {
  await requireRole('admin')
  const data = z.object({ bucket, key: z.string().startsWith('tests/') }).parse(input)
  await deleteObject(data.bucket, data.key)
  return { status: 'success' as const, data: null }
}
