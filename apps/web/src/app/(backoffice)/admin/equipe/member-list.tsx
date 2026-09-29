'use client'

import { useState } from 'react'
import { ImageField } from '@/components/admin/image-field'
import type { MemberInput } from './actions'
import { MemberEditor } from './member-editor'

type Member = MemberInput & { id: string; photoUrl: string | null }

export function MemberList({ members }: { members: Member[] }) {
  const [editing, setEditing] = useState<string | null>(null)
  const nextOrder = members.reduce((m, x) => Math.max(m, x.order), 0) + 1

  return (
    <div className="space-y-4">
      <ul className="card divide-y divide-navy-100">
        {members.map((m) => (
          <li key={m.id} className="p-4">
            <div className="flex flex-wrap items-center gap-4">
              <ImageField entity="team" id={m.id} url={m.photoUrl} alt={m.fullName} round maxSide={600} />
              <div className="min-w-48 flex-1">
                <p className="font-semibold">{m.fullName}</p>
                <p className="text-sm text-ink-600">
                  {m.roleFr}
                  {(!m.roleAr || !m.roleEn) && <span className="ms-2 text-xs text-gold-700">traduction manquante</span>}
                </p>
                <p className="text-xs text-ink-600">
                  {[m.isBoard && 'Bureau', m.isPublicContact && `Contact public · ${m.phone}`].filter(Boolean).join(' · ') || 'Non affiché'}
                </p>
              </div>
              <button type="button" onClick={() => setEditing(editing === m.id ? null : m.id)} className="btn btn-ghost px-3 py-1.5 text-sm">
                {editing === m.id ? 'Fermer' : 'Modifier'}
              </button>
            </div>
            {editing === m.id && (
              <div className="mt-4">
                <MemberEditor initial={m} onDone={() => setEditing(null)} />
              </div>
            )}
          </li>
        ))}
      </ul>
      {editing === 'new' ? (
        <div className="card p-4">
          <p className="mb-3 font-semibold text-navy-700">Nouveau membre</p>
          <MemberEditor nextOrder={nextOrder} onDone={() => setEditing(null)} />
        </div>
      ) : (
        <button type="button" onClick={() => setEditing('new')} className="btn btn-primary">
          + Ajouter un membre
        </button>
      )}
    </div>
  )
}
