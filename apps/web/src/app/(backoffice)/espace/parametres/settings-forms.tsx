'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { shrinkImage } from '@/components/admin/upload'
import { Field, inputClass, PasswordInput, SubmitButton } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { Avatar } from '@/components/space/avatar'
import { authClient, authErrorMessage } from '@/lib/auth-client'
import { getAvatarUploadUrl, saveProfile, setAvatar } from './actions'

export function ProfileForm({ initial }: { initial: { name: string; username: string; emailNotifications: boolean } }) {
  const router = useRouter()
  const [v, setV] = useState(initial)
  const [loading, setLoading] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    const res = await saveProfile(v)
    setLoading(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Profil enregistré')
    router.refresh()
  }
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="s-name" label="Nom complet">
          <input id="s-name" required minLength={2} maxLength={80} value={v.name} onChange={(e) => setV({ ...v, name: e.target.value })} className={inputClass} />
        </Field>
        <Field id="s-user" label="Identifiant (facultatif)">
          <input id="s-user" dir="ltr" value={v.username} onChange={(e) => setV({ ...v, username: e.target.value })} placeholder="prenom.nom" className={`${inputClass} text-start`} />
        </Field>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={v.emailNotifications} onChange={(e) => setV({ ...v, emailNotifications: e.target.checked })} className="size-4 accent-navy-700" />
        Recevoir un récapitulatif par e-mail de mes notifications (tâches, commentaires, invitations)
      </label>
      <div className="w-48">
        <SubmitButton loading={loading}>Enregistrer</SubmitButton>
      </div>
    </form>
  )
}

export function AvatarForm({ name, image }: { name: string; image: string | null }) {
  const router = useRouter()
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)
  async function onFile(file?: File) {
    if (!file) return
    setBusy(true)
    try {
      const small = await shrinkImage(file, 400)
      const res = await getAvatarUploadUrl({ contentType: small.type, size: small.size })
      if (res.status === 'error') throw new Error(res.message)
      const put = await fetch(res.data.uploadUrl, { method: 'PUT', body: small, headers: { 'Content-Type': small.type } })
      if (!put.ok) throw new Error('Envoi refusé par le stockage')
      const saved = await setAvatar({ key: res.data.key })
      if (saved.status === 'error') throw new Error(saved.message)
      toast.success('Photo mise à jour')
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
    const res = await setAvatar({ key: null })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Photo retirée')
    router.refresh()
  }
  return (
    <div className="flex items-center gap-4">
      <Avatar name={name} image={image} size="lg" />
      <div className="flex flex-col items-start gap-1 text-sm">
        <button type="button" disabled={busy} onClick={() => input.current?.click()} className="inline-flex items-center gap-1 font-semibold text-navy-700 underline">
          {busy && <Spinner />} {image ? 'Changer la photo' : 'Ajouter une photo'}
        </button>
        {image && (
          <button type="button" disabled={busy} onClick={remove} className="text-danger underline">
            Retirer
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden onChange={(e) => onFile(e.target.files?.[0])} />
    </div>
  )
}

/** Change password; accounts imported from Terminal have none yet → e-mail link to set one. */
export function PasswordForm({ hasPassword, email }: { hasPassword: boolean; email: string }) {
  const [v, setV] = useState({ current: '', next: '', confirm: '' })
  const [loading, setLoading] = useState(false)
  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (v.next !== v.confirm) return void toast.error('Les deux nouveaux mots de passe ne correspondent pas.')
    setLoading(true)
    const { error } = await authClient.changePassword({ currentPassword: v.current, newPassword: v.next, revokeOtherSessions: true })
    setLoading(false)
    if (error) return void toast.error(error.code === 'INVALID_PASSWORD' ? 'Mot de passe actuel incorrect.' : authErrorMessage(error))
    toast.success('Mot de passe modifié. Vos autres appareils ont été déconnectés.')
    setV({ current: '', next: '', confirm: '' })
  }
  async function sendSetLink() {
    setLoading(true)
    const { error } = await authClient.requestPasswordReset({ email, redirectTo: '/mot-de-passe/nouveau' })
    setLoading(false)
    if (error) return void toast.error(authErrorMessage(error))
    toast.success('E-mail envoyé : cliquez sur le lien pour choisir votre mot de passe.')
  }
  if (!hasPassword)
    return (
      <div className="space-y-3">
        <p className="text-sm text-ink-600">Votre compte n’a pas encore de mot de passe (vous vous connectez par lien e-mail). Recevez un lien pour en choisir un.</p>
        <button type="button" onClick={sendSetLink} disabled={loading} className="btn btn-primary">
          {loading && <Spinner />} M’envoyer le lien
        </button>
      </div>
    )
  return (
    <form onSubmit={onSubmit} className="grid gap-4 sm:grid-cols-3">
      <Field id="pw-cur" label="Mot de passe actuel">
        <PasswordInput id="pw-cur" required autoComplete="current-password" value={v.current} onChange={(e) => setV({ ...v, current: e.target.value })} />
      </Field>
      <Field id="pw-new" label="Nouveau (8 caractères min.)">
        <PasswordInput id="pw-new" required minLength={8} autoComplete="new-password" value={v.next} onChange={(e) => setV({ ...v, next: e.target.value })} />
      </Field>
      <Field id="pw-conf" label="Confirmer">
        <PasswordInput id="pw-conf" required minLength={8} autoComplete="new-password" value={v.confirm} onChange={(e) => setV({ ...v, confirm: e.target.value })} />
      </Field>
      <div className="w-56">
        <SubmitButton loading={loading}>Changer le mot de passe</SubmitButton>
      </div>
    </form>
  )
}
