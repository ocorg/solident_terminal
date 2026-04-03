'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  full_name: string
  username: string
  is_admin: boolean
  last_login: string | null
}

interface Badge {
  contextType: string
  contextName: string
  positionName: string
}

interface DetailData {
  member: Member
  projectMemberships: { project_name: string; position_name: string }[]
  celluleMemberships: { cellule_name: string; position_name: string }[]
  loginLogs: { created_at: string; status: string }[]
}

const FILTERS = ['Tous', 'Admins', 'Membres']

export default function MembersPage() {
  const supabase = createClient()

  const [members,     setMembers]     = useState<Member[]>([])
  const [filtered,    setFiltered]    = useState<Member[]>([])
  const [search,      setSearch]      = useState('')
  const [filter,      setFilter]      = useState('Tous')
  const [loading,     setLoading]     = useState(true)
  const [detail,      setDetail]      = useState<DetailData | null>(null)
  const [showInvite,  setShowInvite]  = useState(false)
  const [showEdit,    setShowEdit]    = useState<Member | null>(null)
  const [toast,       setToast]       = useState<{ msg: string; ok: boolean } | null>(null)

  const [form, setForm] = useState({ email: '', full_name: '', username: '', is_admin: false })
  const [submitting, setSubmitting] = useState(false)

  function showToast(msg: string, ok = true) {
    setToast({ msg, ok })
    setTimeout(() => setToast(null), 3500)
  }

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    if (data) { setMembers(data); setFiltered(data) }
    setLoading(false)
  }

  useEffect(() => { loadMembers() }, [])

  useEffect(() => {
    let result = members
    if (filter === 'Admins')  result = result.filter(m => m.is_admin)
    if (filter === 'Membres') result = result.filter(m => !m.is_admin)
    if (search) result = result.filter(m =>
      m.full_name.toLowerCase().includes(search.toLowerCase()) ||
      m.username.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(result)
  }, [search, filter, members])

  async function openDetail(member: Member) {
    const [pmRes, cmRes, llRes] = await Promise.all([
      supabase.from('project_members').select('position_id, project_id, projects(name), project_positions(position_name)').eq('user_id', member.id),
      supabase.from('cellule_members').select('position_id, cellule_id, cellules(name), cellule_positions(position_name)').eq('user_id', member.id),
      supabase.from('login_logs').select('created_at, status').eq('user_id', member.id).order('created_at', { ascending: false }).limit(5),
    ])

    setDetail({
      member,
      projectMemberships: (pmRes.data || []).map((r: any) => ({
        project_name:  r.projects?.name      || '—',
        position_name: r.project_positions?.position_name || '—',
      })),
      celluleMemberships: (cmRes.data || []).map((r: any) => ({
        cellule_name:  r.cellules?.name       || '—',
        position_name: r.cellule_positions?.position_name || '—',
      })),
      loginLogs: llRes.data || [],
    })
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/members/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { showToast(json.error, false); return }
    showToast('Invitation envoyée avec succès !')
    setShowInvite(false)
    setForm({ email: '', full_name: '', username: '', is_admin: false })
    loadMembers()
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!showEdit) return
    setSubmitting(true)
    const res = await fetch(`/api/members/${showEdit.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(showEdit),
    })
    const json = await res.json()
    setSubmitting(false)
    if (!res.ok) { showToast(json.error, false); return }
    showToast('Membre mis à jour !')
    setShowEdit(null)
    loadMembers()
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Supprimer ${name} ? Cette action est irréversible.`)) return
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { showToast(json.error, false); return }
    showToast('Membre supprimé.')
    if (detail?.member.id === id) setDetail(null)
    loadMembers()
  }

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div className={`fixed top-4 right-4 z-50 px-5 py-3 rounded-2xl text-sm font-medium shadow-2xl transition-all duration-300 ${toast.ok ? 'bg-green-500/20 border border-green-500/30 text-green-400' : 'bg-red-500/20 border border-red-500/30 text-red-400'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Membres</h1>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">{members.length} membre{members.length !== 1 ? 's' : ''} au total</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]"
        >
          <span className="text-lg leading-none">+</span> Inviter un membre
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-slate-500 text-sm">🔍</span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher par nom ou username..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#1E5F7A] focus:ring-1 focus:ring-[#1E5F7A] transition"
          />
        </div>
        <div className="flex gap-2">
          {FILTERS.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2.5 rounded-xl text-sm font-medium transition ${filter === f ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-[#1E5F7A] hover:text-[#1E5F7A]'}`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Cards Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-600">Aucun membre trouvé</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map(member => (
            <div
              key={member.id}
              onClick={() => openDetail(member)}
              className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 cursor-pointer hover:border-[#1E5F7A]/50 hover:shadow-lg hover:shadow-[#1E5F7A]/10 transition-all duration-200 group"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="w-12 h-12 rounded-xl bg-[#1E5F7A]/20 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] font-bold text-sm flex-shrink-0">
                  {initials(member.full_name)}
                </div>
                <div className="flex gap-1.5">
                  {member.is_admin && (
                    <span className="text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-2 py-0.5 rounded-full font-semibold border border-[#F0A500]/20">Admin</span>
                  )}
                </div>
              </div>
              <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{member.full_name}</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 truncate">@{member.username}</p>
              {member.last_login && (
                <p className="text-gray-300 dark:text-slate-600 text-xs mt-2">
                  Dernière connexion: {new Date(member.last_login).toLocaleDateString('fr-MA')}
                </p>
              )}
              {/* Actions on hover */}
              <div className="flex gap-2 mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                <button
                  onClick={e => { e.stopPropagation(); setShowEdit(member) }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] hover:bg-[#1E5F7A]/20 transition font-medium"
                >
                  Modifier
                </button>
                <button
                  onClick={e => { e.stopPropagation(); handleDelete(member.id, member.full_name) }}
                  className="flex-1 text-xs py-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition font-medium"
                >
                  Supprimer
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail Slide-Over */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-md bg-white dark:bg-[#0e1628] border-l border-gray-200 dark:border-white/10 h-full overflow-y-auto p-6 space-y-6 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between">
              <h2 className="text-gray-900 dark:text-white font-bold text-lg">Détail du membre</h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition text-xl">×</button>
            </div>

            {/* Profile */}
            <div className="flex items-center gap-4 p-4 bg-gray-50 dark:bg-white/5 rounded-2xl">
              <div className="w-14 h-14 rounded-xl bg-[#1E5F7A]/20 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] font-bold">
                {initials(detail.member.full_name)}
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">{detail.member.full_name}</p>
                <p className="text-gray-400 dark:text-slate-500 text-sm">@{detail.member.username}</p>
                {detail.member.is_admin && (
                  <span className="text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-2 py-0.5 rounded-full font-semibold border border-[#F0A500]/20 mt-1 inline-block">Administrateur</span>
                )}
              </div>
            </div>

            {/* Projects */}
            <div>
              <h3 className="text-gray-700 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Projets</h3>
              {detail.projectMemberships.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm">Aucun projet</p>
              ) : detail.projectMemberships.map((p, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                  <p className="text-gray-800 dark:text-slate-200 text-sm">📁 {p.project_name}</p>
                  <span className="text-xs text-[#1E5F7A] dark:text-[#5bbcde] bg-[#1E5F7A]/10 px-2 py-0.5 rounded-lg">{p.position_name}</span>
                </div>
              ))}
            </div>

            {/* Cellules */}
            <div>
              <h3 className="text-gray-700 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Cellules</h3>
              {detail.celluleMemberships.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm">Aucune cellule</p>
              ) : detail.celluleMemberships.map((c, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                  <p className="text-gray-800 dark:text-slate-200 text-sm">🏛️ {c.cellule_name}</p>
                  <span className="text-xs text-[#1E5F7A] dark:text-[#5bbcde] bg-[#1E5F7A]/10 px-2 py-0.5 rounded-lg">{c.position_name}</span>
                </div>
              ))}
            </div>

            {/* Login History */}
            <div>
              <h3 className="text-gray-700 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Historique de connexion</h3>
              {detail.loginLogs.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm">Aucune connexion enregistrée</p>
              ) : detail.loginLogs.map((l, i) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                  <p className="text-gray-500 dark:text-slate-500 text-xs">{new Date(l.created_at).toLocaleString('fr-MA')}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-lg ${l.status === 'success' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                    {l.status}
                  </span>
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <button
                onClick={() => { setShowEdit(detail.member); setDetail(null) }}
                className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold py-2.5 rounded-xl transition"
              >
                Modifier
              </button>
              <button
                onClick={() => handleDelete(detail.member.id, detail.member.full_name)}
                className="flex-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 text-sm font-semibold py-2.5 rounded-xl transition"
              >
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invite Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowInvite(false)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-5">Inviter un membre</h2>
            <form onSubmit={handleInvite} className="space-y-4">
              {[
                { label: 'Nom complet',   key: 'full_name', type: 'text',  placeholder: 'Prénom Nom'          },
                { label: 'Username',      key: 'username',  type: 'text',  placeholder: 'prenom.nom'          },
                { label: 'Adresse email', key: 'email',     type: 'email', placeholder: 'membre@exemple.com'  },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">{field.label}</label>
                  <input
                    type={field.type}
                    required
                    placeholder={field.placeholder}
                    value={(form as any)[field.key]}
                    onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#1E5F7A] focus:ring-1 focus:ring-[#1E5F7A] transition"
                  />
                </div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setForm(f => ({ ...f, is_admin: !f.is_admin }))}
                  className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${form.is_admin ? 'bg-[#1E5F7A]' : 'bg-gray-200 dark:bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.is_admin ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-slate-300">Administrateur</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowInvite(false)} className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                  {submitting ? 'Envoi…' : 'Envoyer l\'invitation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowEdit(null)} />
          <div className="relative w-full max-w-md bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-5">Modifier le membre</h2>
            <form onSubmit={handleEdit} className="space-y-4">
              {[
                { label: 'Nom complet', key: 'full_name', placeholder: 'Prénom Nom'  },
                { label: 'Username',    key: 'username',  placeholder: 'prenom.nom'  },
              ].map(field => (
                <div key={field.key}>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">{field.label}</label>
                  <input
                    required
                    placeholder={field.placeholder}
                    value={(showEdit as any)[field.key]}
                    onChange={e => setShowEdit(m => m ? { ...m, [field.key]: e.target.value } : m)}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#1E5F7A] focus:ring-1 focus:ring-[#1E5F7A] transition"
                  />
                </div>
              ))}
              <label className="flex items-center gap-3 cursor-pointer">
                <div
                  onClick={() => setShowEdit(m => m ? { ...m, is_admin: !m.is_admin } : m)}
                  className={`w-10 h-6 rounded-full transition-colors duration-200 relative ${showEdit.is_admin ? 'bg-[#1E5F7A]' : 'bg-gray-200 dark:bg-white/10'}`}
                >
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${showEdit.is_admin ? 'left-5' : 'left-1'}`} />
                </div>
                <span className="text-sm text-gray-700 dark:text-slate-300">Administrateur</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowEdit(null)} className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting} className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                  {submitting ? 'Enregistrement…' : 'Enregistrer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}