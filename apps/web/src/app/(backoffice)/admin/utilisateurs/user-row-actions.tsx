'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import type { Role } from '@solident/db'
import { Spinner } from '@/components/spinner'
import { updateUser } from './actions'
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
