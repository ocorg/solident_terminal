'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast, ToastStyle } from '@/hooks/useToast'
import { useRouter } from 'next/navigation'

interface Project {
  id: string; name: string; description: string | null
  status: string; start_date: string | null; end_date: string | null
  is_multi_activite: boolean; approval_status: string
  project_members: { user_id: string; profiles: { full_name: string } }[]
}

const STATUS_STYLES: Record<string, string> = {
  'Actif':     'bg-green-50  dark:bg-green-500/20  text-green-600  dark:text-green-400',
  'En pause':  'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
  'Bloqué':    'bg-red-50    dark:bg-red-500/20    text-red-600    dark:text-red-400',
  'Terminé':   'bg-slate-50  dark:bg-slate-500/20  text-slate-600  dark:text-slate-400',
}

const STATUSES = ['Tous', 'Actif', 'En pause', 'Bloqué', 'Terminé']

export default function ProjectsPage() {
  const supabase = createClient()
  const router = useRouter()

  const [projects,  setProjects]  = useState<Project[]>([])
  const [filtered,  setFiltered]  = useState<Project[]>([])
  const [loading,   setLoading]   = useState(true)
  const [isAdmin,   setIsAdmin]   = useState(false)
  const [search,    setSearch]    = useState('')
  const [filter,    setFilter]    = useState('Tous')
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const { toast, toastLeaving, showToast } = useToast()

  const [form, setForm] = useState({
    name: '', description: '', status: 'Actif',
    start_date: '', end_date: '', is_multi_activite: false,
  })

  async function loadProjects() {
    const res = await fetch('/api/projects')
    const data = await res.json()
    if (Array.isArray(data)) { setProjects(data); setFiltered(data) }
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      setIsAdmin(!!profile?.is_admin)
    }
    init()
    loadProjects()
  }, [])

  useEffect(() => {
    let result = projects
    if (filter !== 'Tous') result = result.filter(p => p.status === filter)
    if (search) result = result.filter(p =>
      p.name.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(result)
  }, [search, filter, projects])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Projet créé !')
    setShowCreate(false)
    setForm({ name: '', description: '', status: 'Actif', start_date: '', end_date: '', is_multi_activite: false })
    loadProjects()
  }

  const initials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div
          style={ToastStyle(toastLeaving)}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}
        >
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Projets</h1>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">{projects.length} projet{projects.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
            <span className="text-lg leading-none">+</span> Nouveau projet
          </button>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un projet..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#1E5F7A] transition" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {STATUSES.map(s => (
            <button key={s} onClick={() => setFilter(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${filter === s ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-600">Aucun projet trouvé</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(project => {
            const memberCount = project.project_members?.length || 0
            return (
              <div key={project.id}
                onClick={() => router.push(`/projects/${project.id}`)}
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 cursor-pointer hover:border-[#1E5F7A]/50 hover:shadow-lg hover:shadow-[#1E5F7A]/10 transition-all duration-200 group">

                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#1E5F7A]/10 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] font-bold text-sm flex-shrink-0">
                    📁
                  </div>
                  <div className="flex gap-2 items-center">
                    {project.is_multi_activite && (
                      <span className="text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-2 py-0.5 rounded-full font-semibold border border-[#F0A500]/20">
                        Multi-activité
                      </span>
                    )}
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_STYLES[project.status] || ''}`}>
                      {project.status}
                    </span>
                  </div>
                </div>

                <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-1 truncate">{project.name}</h3>
                {project.description && (
                  <p className="text-gray-400 dark:text-slate-500 text-xs line-clamp-2 mb-3">{project.description}</p>
                )}

                {/* Dates */}
                {(project.start_date || project.end_date) && (
                  <p className="text-gray-400 dark:text-slate-600 text-xs mb-3">
                    {project.start_date ? new Date(project.start_date).toLocaleDateString('fr-MA') : '—'}
                    {' → '}
                    {project.end_date ? new Date(project.end_date).toLocaleDateString('fr-MA') : '—'}
                  </p>
                )}

                {/* Members avatars */}
                <div className="flex items-center justify-between mt-auto pt-3 border-t border-gray-100 dark:border-white/5">
                  <div className="flex -space-x-2">
                    {project.project_members?.slice(0, 4).map((m, i) => (
                      <div key={i} title={m.profiles?.full_name}
                        className="w-7 h-7 rounded-full bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-[#0a0f1e]">
                        {initials(m.profiles?.full_name || '?')}
                      </div>
                    ))}
                    {memberCount > 4 && (
                      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-400 text-[10px] flex items-center justify-center border-2 border-white dark:border-[#0a0f1e]">
                        +{memberCount - 4}
                      </div>
                    )}
                  </div>
                  <span className="text-gray-400 dark:text-slate-600 text-xs">{memberCount} membre{memberCount !== 1 ? 's' : ''}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Modal */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 dark:text-white font-bold text-lg">Nouveau projet</h2>
              <button type="button" onClick={() => setShowCreate(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition text-lg">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Nom *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Nom du projet"
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle..."
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition resize-none" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Statut</label>
                  <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                    {['Actif', 'En pause', 'Bloqué', 'Terminé'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Multi-activité</label>
                  <div
                    onClick={() => setForm(f => ({ ...f, is_multi_activite: !f.is_multi_activite }))}
                    className={`mt-1 w-10 h-6 rounded-full transition-colors duration-200 relative cursor-pointer ${form.is_multi_activite ? 'bg-[#1E5F7A]' : 'bg-gray-200 dark:bg-white/10'}`}>
                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${form.is_multi_activite ? 'left-5' : 'left-1'}`} />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Date début</label>
                  <input type="date" value={form.start_date} onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Date fin</label>
                  <input type="date" value={form.end_date} onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                  {submitting ? 'Création…' : 'Créer le projet'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}