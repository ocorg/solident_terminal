import 'server-only'
import { randomUUID } from 'node:crypto'
import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

// Cloudflare R2 through its S3-compatible API (docs/SPEC.md §3).
// Two buckets: public media (served from R2_PUBLIC_URL) and private files (donation proofs; signed links only).

function env(name: string) {
  const v = process.env[name]
  if (!v) throw new Error(`${name} is not set`)
  return v
}

let client: S3Client | undefined
function r2() {
  client ??= new S3Client({
    region: 'auto',
    endpoint: `https://${env('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: env('R2_ACCESS_KEY_ID'), secretAccessKey: env('R2_SECRET_ACCESS_KEY') },
    // Newer AWS SDKs add CRC32 checksums to every request, which breaks browser uploads to presigned URLs.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return client
}

export type Bucket = 'public' | 'private'
const bucketName = (b: Bucket) => env(b === 'public' ? 'R2_PUBLIC_BUCKET' : 'R2_PRIVATE_BUCKET')

export const UPLOAD_RULES = {
  image: { types: ['image/jpeg', 'image/png', 'image/webp'], maxBytes: 8 * 1024 * 1024 },
  document: { types: ['application/pdf'], maxBytes: 15 * 1024 * 1024 },
  proof: { types: ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], maxBytes: 5 * 1024 * 1024 }, // spec §5: ≤ 5 MB
} as const
export type UploadKind = keyof typeof UPLOAD_RULES

const EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'application/pdf': 'pdf',
}

/**
 * Signed PUT URL valid 5 minutes. Content type and exact size are part of the signature,
 * so the browser cannot upload a different or bigger file than the one validated here.
 */
export async function createUploadUrl(opts: {
  bucket: Bucket
  kind: UploadKind
  folder: string // e.g. "actions/tamesna-2026", "proofs/2026-10"
  contentType: string
  size: number
}) {
  const rule = UPLOAD_RULES[opts.kind]
  if (!(rule.types as readonly string[]).includes(opts.contentType)) throw new Error('Type de fichier non autorisé')
  if (!Number.isInteger(opts.size) || opts.size <= 0 || opts.size > rule.maxBytes) {
    throw new Error(`Fichier trop volumineux (max ${Math.round(rule.maxBytes / 1024 / 1024)} Mo)`)
  }
  const folder = opts.folder.replace(/[^a-z0-9/_-]/gi, '').replace(/^\/+|\/+$/g, '')
  const key = `${folder}/${randomUUID()}.${EXT[opts.contentType]}`

  const uploadUrl = await getSignedUrl(
    r2(),
    new PutObjectCommand({
      Bucket: bucketName(opts.bucket),
      Key: key,
      ContentType: opts.contentType,
      ContentLength: opts.size,
    }),
    { expiresIn: 300, signableHeaders: new Set(['content-type', 'content-length']) },
  )
  return { key, uploadUrl, publicUrl: opts.bucket === 'public' ? publicUrl(key) : null }
}

/** Permanent URL of a file in the public bucket. */
export function publicUrl(key: string) {
  return `${env('R2_PUBLIC_URL').replace(/\/+$/, '')}/${key}`
}

/** Short-lived link (default 5 min) to view a private file, e.g. a donation proof. */
export async function createPrivateViewUrl(key: string, expiresIn = 300) {
  return getSignedUrl(r2(), new GetObjectCommand({ Bucket: bucketName('private'), Key: key }), { expiresIn })
}

export async function deleteObject(bucket: Bucket, key: string) {
  await r2().send(new DeleteObjectCommand({ Bucket: bucketName(bucket), Key: key }))
}
