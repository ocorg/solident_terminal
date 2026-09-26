'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Role } from '@solident/db'
import { Spinner } from '@/components/spinner'
import { setSpaceAdmin, updateUser } from './actions'
import { roleOptions } from './roles'

export function UserRowActions({ id, isActive, role, isMe }: { id: string; isActive: boolean; role: Role; isMe: boolean }) {
  const router = useRouter()
  const [nextRole, setNextRole] = useState<Role>(role)
  const [busy, setBusy] = useState<string | null>(null)

  async function save(active: boolean, r: Role, label: string) {
    setBusy(label)
    const res = await updateUser({ id, isActive: active, role: r })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(res.data.approved ? 'Compte validé, un e-mail a été envoyé' : 'Utilisateur mis à jour')
    router.refresh()
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={nextRole}
        onChange={(e) => setNextRole(e.target.value as Role)}
        disabled={isMe}
        className="rounded-lg border border-navy-100 bg-white px-2 py-1.5 text-sm"
        aria-label="Rôle"
      >
        {roleOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {!isActive ? (
        <button type="button" onClick={() => save(true, nextRole, 'approve')} disabled={busy !== null} className="btn bg-success px-3 py-1.5 text-sm text-white">
          {busy === 'approve' && <Spinner />} Valider
        </button>
      ) : (
        <>
          {nextRole !== role && (
            <button type="button" onClick={() => save(true, nextRole, 'role')} disabled={busy !== null} className="btn btn-primary px-3 py-1.5 text-sm">
              {busy === 'role' && <Spinner />} Enregistrer le rôle
            </button>
          )}
          {!isMe && (
            <button type="button" onClick={() => save(false, role, 'off')} disabled={busy !== null} className="btn btn-ghost px-3 py-1.5 text-sm text-danger">
              {busy === 'off' && <Spinner />} Désactiver
            </button>
          )}
        </>
      )}
    </div>
  )
}

export function SpaceAdminToggle({ id, value }: { id: string; value: boolean }) {
  const router = useRouter()
  const [checked, setChecked] = useState(value)
  const [loading, setLoading] = useState(false)
  return (
    <label className="inline-flex items-center gap-2 text-sm">
      <input
        type="checkbox"
        checked={checked}
        disabled={loading}
        onChange={async (e) => {
          const next = e.target.checked
          setChecked(next)
          setLoading(true)
          const res = await setSpaceAdmin({ id, value: next })
          setLoading(false)
          if (res.status === 'error') {
            setChecked(!next)
            return void toast.error(res.message)
          }
          toast.success(next ? 'Admin de l’espace membres' : 'Droits d’admin de l’espace retirés')
          router.refresh()
        }}
        className="size-4 accent-navy-700"
      />
      {loading ? <Spinner /> : 'admin espace'}
    </label>
  )
}
