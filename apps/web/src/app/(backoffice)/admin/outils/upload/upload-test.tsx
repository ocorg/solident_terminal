'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { deleteTestFile, getTestPrivateLink, getTestUploadUrl } from './actions'

type Result = { bucket: 'public' | 'private'; key: string; url: string; isImage: boolean }

export function UploadTest() {
  const [bucket, setBucket] = useState<'public' | 'private'>('public')
  const [file, setFile] = useState<File | null>(null)
  const [busy, setBusy] = useState<string | null>(null)
  const [result, setResult] = useState<Result | null>(null)

  async function upload() {
    if (!file) return
    setBusy('upload')
    try {
      const { data } = await getTestUploadUrl({ bucket, contentType: file.type, size: file.size })
      const put = await fetch(data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      if (!put.ok) throw new Error(`R2 a refusé l'envoi (${put.status})`)
      const url = data.publicUrl ?? (await getTestPrivateLink({ key: data.key })).data.url
      setResult({ bucket, key: data.key, url, isImage: file.type.startsWith('image/') })
      toast.success('Fichier envoyé sur R2')
    } catch (e) {
      // A TypeError from fetch usually means the bucket's CORS policy blocked the browser.
      const msg = e instanceof TypeError ? 'Envoi bloqué par le navigateur (CORS du bucket ?)' : (e as Error).message
      toast.error(msg)
    } finally {
      setBusy(null)
    }
  }

  async function remove() {
    if (!result) return
    setBusy('delete')
    try {
      await deleteTestFile({ bucket: result.bucket, key: result.key })
      setResult(null)
      toast.success('Fichier supprimé')
    } catch (e) {
      toast.error((e as Error).message)
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-4">
        {(['public', 'private'] as const).map((b) => (
          <label key={b} className="flex items-center gap-2">
            <input type="radio" name="bucket" checked={bucket === b} onChange={() => setBucket(b)} />
            {b === 'public' ? 'Public (photos, PDF)' : 'Privé (preuves de don)'}
          </label>
        ))}
      </div>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        className="block text-sm"
      />
      <button
        type="button"
        onClick={upload}
        disabled={!file || busy !== null}
        className="flex items-center gap-2 rounded-[10px] bg-navy-700 px-4 py-2 font-semibold text-white transition hover:brightness-90 active:scale-[0.97] disabled:opacity-60"
      >
        {busy === 'upload' && <Spinner />}
        Envoyer
      </button>

      {result && (
        <div className="space-y-3 rounded-xl border border-navy-100 p-4">
          <p className="break-all text-sm">
            <strong>{result.bucket === 'public' ? 'URL publique' : 'Lien privé (expire dans 60 s)'} :</strong>{' '}
            <a href={result.url} target="_blank" rel="noreferrer" className="text-navy-700 underline">
              {result.url.split('?')[0]}
            </a>
          </p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {result.isImage && <img src={result.url} alt="Aperçu du fichier envoyé" className="max-h-64 rounded-lg" />}
          <button
            type="button"
            onClick={remove}
            disabled={busy !== null}
            className="flex items-center gap-2 rounded-[10px] border border-danger px-3 py-1.5 text-sm text-danger transition active:scale-[0.97] disabled:opacity-60"
          >
            {busy === 'delete' && <Spinner />}
            Supprimer ce fichier de test
          </button>
        </div>
      )}
    </div>
  )
}
