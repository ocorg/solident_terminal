'use client'

import { useEffect, useState } from 'react'
import { useToast, ToastStyle } from '@/hooks/useToast'
import ConfirmModal from '@/components/ConfirmModal'
import { createClient } from '@/lib/supabase/client'

interface Member {
  id: string
  full_name: string
  username: string
  is_admin: boolean
  last_login: string | null
  avatar_url?: string | null
  email_enabled?: boolean
}

interface Badge {
  contextType: string
  contextName: string
  positionName: string
}

interface DetailData {
  member: Member
  projectMemberships: { project_name: string; position_name: string }[]
  activityMemberships: { activity_name: string; position_name: string }[]
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
  const { toast, toastLeaving, showToast } = useToast()
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const [memberBadges, setMemberBadges] = useState<Record<string, Badge[]>>({})
  const [currentIsAdmin, setCurrentIsAdmin] = useState(false)
  const [uploadingFor,     setUploadingFor]     = useState<string | null>(null)
  const [togglingEmailFor, setTogglingEmailFor] = useState<string | null>(null)
  const [emailPrefs,       setEmailPrefs]       = useState<Record<string, boolean>>({})

  const [form, setForm] = useState({ email: '', full_name: '', username: '', is_admin: false })
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase.from('profiles').select('is_admin').eq('id', user.id).single()
        .then(({ data }) => { if (data) setCurrentIsAdmin(data.is_admin) })
    })
  }, [])

  async function loadMembers() {
    const { data } = await supabase.from('profiles').select('*').order('full_name')
    if (data) { setMembers(data); setFiltered(data) }

    // Fetch email prefs for all members
    const { data: prefs } = await supabase.from('user_email_prefs').select('user_id, email_enabled')
    if (prefs) {
      const map: Record<string, boolean> = {}
      prefs.forEach(p => { map[p.user_id] = p.email_enabled })
      setEmailPrefs(map)
    }

    // Fetch all non-membre positions across projects and cellules
    const [{ data: pmData }, { data: cmData }] = await Promise.all([
      supabase.from('project_members').select('user_id, project_positions(position_name), projects(name, parent_project_id)'),
      supabase.from('cellule_members').select('user_id, cellule_positions(position_name), cellules(name)'),
    ])

    const badgeMap: Record<string, Badge[]> = {}

    ;(pmData || []).forEach((r: any) => {
      const pos = r.project_positions?.position_name || ''
      if (!pos || pos.toLowerCase().includes('membre')) return
      if (!badgeMap[r.user_id]) badgeMap[r.user_id] = []
      const isActivity = !!r.projects?.parent_project_id
      badgeMap[r.user_id].push({
        contextType: isActivity ? 'activity' : 'project',
        contextName: r.projects?.name || '',
        positionName: pos,
      })
    })

    ;(cmData || []).forEach((r: any) => {
      const pos = r.cellule_positions?.position_name || ''
      if (!pos || pos.toLowerCase().includes('membre')) return
      if (!badgeMap[r.user_id]) badgeMap[r.user_id] = []
      badgeMap[r.user_id].push({ contextType: 'cellule', contextName: r.cellules?.name || '', positionName: pos })
    })

    setMemberBadges(badgeMap)
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
      supabase.from('project_members').select('position_id, project_id, projects(name, parent_project_id), project_positions(position_name)').eq('user_id', member.id),
      supabase.from('cellule_members').select('position_id, cellule_id, cellules(name), cellule_positions(position_name)').eq('user_id', member.id),
      supabase.from('login_logs').select('created_at, status').eq('user_id', member.id).order('created_at', { ascending: false }).limit(5),
    ])

    const allProjectRows = pmRes.data || []
    const projectRows  = allProjectRows.filter((r: any) => !r.projects?.parent_project_id)
    const activityRows = allProjectRows.filter((r: any) => !!r.projects?.parent_project_id)

    setDetail({
      member,
      projectMemberships: projectRows.map((r: any) => ({
        project_name:  r.projects?.name || '—',
        position_name: r.project_positions?.position_name || '—',
      })),
      activityMemberships: activityRows.map((r: any) => ({
        activity_name: r.projects?.name || '—',
        position_name: r.project_positions?.position_name || '—',
      })),
      celluleMemberships: (cmRes.data || []).map((r: any) => ({
        cellule_name:  r.cellules?.name || '—',
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
    await loadMembers()
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
    await loadMembers()
  }

  function handleDelete(id: string, name: string) {
    setConfirm({
      title: 'Supprimer le membre',
      message: `Êtes-vous sûr de vouloir supprimer ${name} ? Cette action est irréversible.`,
      onConfirm: async () => {
    const res = await fetch(`/api/members/${id}`, { method: 'DELETE' })
    const json = await res.json()
    if (!res.ok) { showToast(json.error, false); return }
    showToast('Membre supprimé.')
        if (detail?.member.id === id) setDetail(null)
        await loadMembers()
      }
    })
  }

  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  async function toggleMemberEmailPref(memberId: string) {
    if (!currentIsAdmin) return
    const current = emailPrefs[memberId] !== false // default to true if not set
    const next = !current
    setTogglingEmailFor(memberId)
    const res = await fetch(`/api/members/${memberId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email_enabled: next }),
    })
    if (res.ok) {
      setEmailPrefs(prev => ({ ...prev, [memberId]: next }))
      showToast(next ? 'Emails activés pour ce membre' : 'Emails désactivés pour ce membre')
    } else {
      showToast('Erreur lors de la mise à jour', false)
    }
    setTogglingEmailFor(null)
  }
  async function handleAdminAvatarUpload(memberId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 204800) { showToast('Image trop lourde — maximum 200 Ko', false); return }
    setUploadingFor(memberId)
    const formData = new FormData()
    formData.append('file', file)
    const res = await fetch(`/api/members/${memberId}/avatar`, { method: 'POST', body: formData })
    const data = await res.json()
    if (!res.ok) { showToast(data.error, false); setUploadingFor(null); return }
    setMembers(prev => prev.map(m => m.id === memberId ? { ...m, avatar_url: data.avatar_url } : m))
    if (detail?.member.id === memberId) setDetail(d => d ? { ...d, member: { ...d.member, avatar_url: data.avatar_url } } : d)
    showToast('Photo mise à jour !')
    setUploadingFor(null)
  }

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div
          style={ToastStyle(toastLeaving)}
          className={`fixed top-6 left-0 right-0 mx-auto w-fit z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      {confirm && (
        <ConfirmModal
          title={confirm.title}
          message={confirm.message}
          confirmLabel="Supprimer"
          danger
          onConfirm={() => { confirm.onConfirm(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
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
                <div className="w-12 h-12 rounded-xl bg-[#1E5F7A]/20 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] font-bold text-sm flex-shrink-0 overflow-hidden">
                  {member.avatar_url
                    ? <img src={member.avatar_url} alt={member.full_name} className="w-full h-full object-cover" />
                    : <span>{initials(member.full_name)}</span>
                  }
                </div>
                <div className="flex flex-wrap gap-1 justify-end max-w-[140px]">
                  {member.is_admin && (
                    <span className="text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-2 py-0.5 rounded-full font-semibold border border-[#F0A500]/20">Admin</span>
                  )}
                  {!member.is_admin && (memberBadges[member.id] || []).length === 0 && (
                    <span className="text-[10px] bg-green-100 dark:bg-gray/10 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full font-semibold border border-gray-200 dark:border-white/10">Membre</span>
                  )}
                  {(memberBadges[member.id] || []).map((b, i) => (
                    <span key={i} title={`${b.positionName} — ${b.contextName}`}
                      className={`text-[10px] px-2 py-0.5 rounded-full font-semibold border truncate max-w-[120px] ${
                        b.contextType === 'activity'
                          ? 'bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20'
                          : 'bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] border-[#1E5F7A]/20'
                      }`}>
                      {b.positionName}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-gray-900 dark:text-white font-semibold text-sm truncate">{member.full_name}</p>
              <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 truncate">@{member.username}</p>
              {member.last_login && (
                <p className="text-gray-300 dark:text-slate-600 text-xs mt-2">
                  Dernière connexion: {new Date(member.last_login).toLocaleDateString('fr-MA')}
                </p>
              )}
              {currentIsAdmin && (
                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100 dark:border-white/10">
                      <span className="text-[10px] text-gray-400 dark:text-slate-500">Emails</span>
                      <div onClick={e => { e.stopPropagation(); toggleMemberEmailPref(member.id) }}
                        className={`w-8 h-4 rounded-full transition-colors duration-200 relative cursor-pointer flex-shrink-0 ${emailPrefs[member.id] === true ? 'bg-[#1E5F7A]' : 'bg-gray-200 dark:bg-white/10'} ${togglingEmailFor === member.id ? 'opacity-50' : ''}`}>
                        <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all duration-200 ${emailPrefs[member.id] === true ? 'left-4' : 'left-0.5'}`} />
                      </div>
                    </div>
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
              <div className="relative flex-shrink-0">
                <div className="w-16 h-16 rounded-xl bg-[#1E5F7A]/20 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] font-bold overflow-hidden">
                  {detail.member.avatar_url
                    ? <img src={detail.member.avatar_url} alt={detail.member.full_name} className="w-full h-full object-cover" />
                    : <span>{initials(detail.member.full_name)}</span>
                  }
                </div>
                {currentIsAdmin && (
                  <label className="absolute -bottom-1 -right-1 w-6 h-6 bg-[#1E5F7A] rounded-lg flex items-center justify-center cursor-pointer hover:bg-[#2a7a9a] transition shadow">
                    <span className="text-white text-[10px]">{uploadingFor === detail.member.id ? '…' : '📷'}</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={e => handleAdminAvatarUpload(detail.member.id, e)}
                      disabled={uploadingFor === detail.member.id} />
                  </label>
                )}
              </div>
              <div>
                <p className="text-gray-900 dark:text-white font-semibold">{detail.member.full_name}</p>
                <p className="text-gray-400 dark:text-slate-500 text-sm">@{detail.member.username}</p>
                {detail.member.is_admin && (
                  <span className="text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-2 py-0.5 rounded-full font-semibold border border-[#F0A500]/20 mt-1 inline-block">Administrateur</span>
                )}
                {currentIsAdmin && (
                  <div className="flex items-center gap-2 mt-2">
                    <span className="text-xs text-gray-400 dark:text-slate-500">Notifications email</span>
                    <div onClick={() => toggleMemberEmailPref(detail.member.id)}
                      className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer flex-shrink-0 ${emailPrefs[detail.member.id] === true ? 'bg-[#1E5F7A]' : 'bg-gray-200 dark:bg-white/10'}`}>
                      <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${emailPrefs[detail.member.id] === true ? 'left-4' : 'left-0.5'}`} />
                    </div>
                    <span className="text-[10px] text-gray-400">{emailPrefs[detail.member.id] === true ? 'Activé' : 'Désactivé'}</span>
                  </div>
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

            {/* Activities */}
            {detail.activityMemberships.length > 0 && (
              <div>
                <h3 className="text-gray-700 dark:text-slate-400 text-xs font-semibold uppercase tracking-wider mb-3">Activités</h3>
                {detail.activityMemberships.map((a, i) => (
                  <div key={i} className="flex items-center justify-between py-2 border-b border-gray-100 dark:border-white/5 last:border-0">
                    <p className="text-gray-800 dark:text-slate-200 text-sm">⚡ {a.activity_name}</p>
                    <span className="text-xs text-purple-500 dark:text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded-lg">{a.position_name}</span>
                  </div>
                ))}
              </div>
            )}

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
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 dark:text-white font-bold text-lg">Inviter un membre</h2>
              <button type="button" onClick={() => setShowInvite(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition text-lg">×</button>
            </div>
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
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 dark:text-white font-bold text-lg">Modifier le membre</h2>
              <button type="button" onClick={() => setShowEdit(null)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition text-lg">×</button>
            </div>
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