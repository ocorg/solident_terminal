'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast, ToastStyle } from '@/hooks/useToast'

// ─── Types ───────────────────────────────────────────────────
interface UserRef { id: string; full_name: string; username: string }
interface Proposal {
  id: string; title: string; description: string | null
  status: string; type: string; is_activity: boolean
  proposed_at: string; reviewed_at: string | null
  review_notes: string | null
  proposer: UserRef | null
  reviewer: UserRef | null
  chef:     UserRef | null
  parent:   { id: string; name: string } | null
}
interface Profile { id: string; full_name: string; username: string }
interface Project { id: string; name: string }

const STATUS_STYLES: Record<string, string> = {
  'En attente': 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border-yellow-200 dark:border-yellow-500/20',
  'Approuvé':   'bg-green-50  dark:bg-green-500/20  text-green-600  dark:text-green-400  border-green-200  dark:border-green-500/20',
  'Rejeté':     'bg-red-50    dark:bg-red-500/20    text-red-600    dark:text-red-400    border-red-200    dark:border-red-500/20',
}

const FILTERS = ['Toutes', 'En attente', 'Approuvé', 'Rejeté']

function parseExtras(review_notes: string | null) {
  if (!review_notes) return { estimated_budget: null, timeline: null, motivation: null, admin_note: null }
  try {
    const parsed = JSON.parse(review_notes)
    if (typeof parsed === 'object' && parsed !== null) return { ...parsed, admin_note: null }
  } catch {
    return { estimated_budget: null, timeline: null, motivation: null, admin_note: review_notes }
  }
  return { estimated_budget: null, timeline: null, motivation: null, admin_note: review_notes }
}

export default function ProposalsPage() {
  const supabase = createClient()

  const [proposals,  setProposals]  = useState<Proposal[]>([])
  const [filtered,   setFiltered]   = useState<Proposal[]>([])
  const [loading,    setLoading]    = useState(true)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [currentId,  setCurrentId]  = useState('')
  const [search,     setSearch]     = useState('')
  const [filter,     setFilter]     = useState('Toutes')
  const [showCreate, setShowCreate] = useState(false)
  const [detail,     setDetail]     = useState<Proposal | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [reviewNote, setReviewNote] = useState('')
  const [reviewing,  setReviewing]  = useState(false)
  const [profiles,   setProfiles]   = useState<Profile[]>([])
  const [projects,   setProjects]   = useState<Project[]>([])
  const { toast, toastLeaving, showToast } = useToast()

  const [form, setForm] = useState({
    title: '', description: '', type: 'Projet',
    is_activity: false, parent_project_id: '',
    suggested_chef: '', estimated_budget: '',
    timeline: '', motivation: '',
  })

  async function loadProposals() {
    const res = await fetch('/api/proposals')
    const data = await res.json()
    if (Array.isArray(data)) { setProposals(data); setFiltered(data) }
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      setIsAdmin(!!profile?.is_admin)

      const [profsRes, projsRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username'),
        supabase.from('projects').select('id, name').eq('is_multi_activite', true),
      ])
      if (profsRes.data) setProfiles(profsRes.data)
      if (projsRes.data) setProjects(projsRes.data)
    }
    init()
    loadProposals()
  }, [])

  useEffect(() => {
    let result = proposals
    if (filter !== 'Toutes') result = result.filter(p => p.status === filter)
    if (search) result = result.filter(p =>
      p.title.toLowerCase().includes(search.toLowerCase())
    )
    setFiltered(result)
  }, [search, filter, proposals])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/proposals', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Proposition soumise !')
    setShowCreate(false)
    setForm({ title: '', description: '', type: 'Projet', is_activity: false, parent_project_id: '', suggested_chef: '', estimated_budget: '', timeline: '', motivation: '' })
    loadProposals()
  }

  async function handleReview(status: 'Approuvé' | 'Rejeté') {
    if (!detail) return
    setReviewing(true)
    const res = await fetch(`/api/proposals/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, review_notes: reviewNote }),
    })
    const data = await res.json()
    setReviewing(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast(status === 'Approuvé' ? 'Proposition approuvée — projet créé !' : 'Proposition rejetée.')
    setDetail(null)
    setReviewNote('')
    loadProposals()
  }

  async function handleDelete(id: string) {
    if (!confirm('Supprimer cette proposition ?')) return
    const res = await fetch(`/api/proposals/${id}`, { method: 'DELETE' })
    if (!res.ok) { showToast('Erreur lors de la suppression', false); return }
    showToast('Proposition supprimée.')
    if (detail?.id === id) setDetail(null)
    loadProposals()
  }

  const inputCls = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition"
  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  const pendingCount = proposals.filter(p => p.status === 'En attente').length

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div style={ToastStyle(toastLeaving)}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Propositions</h1>
            {pendingCount > 0 && (
              <span className="bg-[#F0A500]/20 text-[#F0A500] text-xs font-bold px-2.5 py-1 rounded-full border border-[#F0A500]/20">
                {pendingCount} en attente
              </span>
            )}
          </div>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">{proposals.length} proposition{proposals.length !== 1 ? 's' : ''}</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
          <span className="text-lg leading-none">+</span> Soumettre une proposition
        </button>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une proposition..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#1E5F7A] transition" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {FILTERS.map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${filter === f ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-600">Aucune proposition</div>
      ) : (
        <div className="space-y-3">
          {filtered.map(proposal => {
            const extras = parseExtras(proposal.review_notes)
            const isOwner = proposal.proposer?.id === currentId
            return (
              <div key={proposal.id}
                onClick={() => { setDetail(proposal); setReviewNote('') }}
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 cursor-pointer hover:border-[#1E5F7A]/50 hover:shadow-md transition-all duration-200">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="text-gray-900 dark:text-white font-semibold text-sm truncate">{proposal.title}</h3>
                      <span className="text-[10px] bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                        {proposal.type}
                      </span>
                      {proposal.is_activity && proposal.parent && (
                        <span className="text-[10px] bg-[#F0A500]/10 text-[#F0A500] px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                          → {proposal.parent.name}
                        </span>
                      )}
                    </div>
                    {proposal.description && (
                      <p className="text-gray-400 dark:text-slate-500 text-xs line-clamp-1">{proposal.description}</p>
                    )}
                    <div className="flex items-center gap-3 mt-2 flex-wrap">
                      {proposal.proposer && (
                        <div className="flex items-center gap-1.5">
                          <div className="w-5 h-5 rounded-full bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[9px] font-bold flex items-center justify-center">
                            {initials(proposal.proposer.full_name)}
                          </div>
                          <span className="text-xs text-gray-400 dark:text-slate-500">{proposal.proposer.full_name}</span>
                        </div>
                      )}
                      <span className="text-gray-300 dark:text-slate-700 text-xs">·</span>
                      <span className="text-gray-400 dark:text-slate-600 text-xs">
                        {new Date(proposal.proposed_at).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' })}
                      </span>
                      {extras.estimated_budget && (
                        <>
                          <span className="text-gray-300 dark:text-slate-700 text-xs">·</span>
                          <span className="text-gray-400 dark:text-slate-500 text-xs">💰 {extras.estimated_budget}</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium border ${STATUS_STYLES[proposal.status] || ''}`}>
                      {proposal.status}
                    </span>
                    {(isOwner || isAdmin) && proposal.status === 'En attente' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleDelete(proposal.id) }}
                        className="text-xs text-red-400 hover:text-red-500 transition px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Detail Slide-Over ── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-lg bg-white dark:bg-[#0e1628] border-l border-gray-200 dark:border-white/10 h-full flex flex-col animate-in slide-in-from-right duration-300">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              <h2 className="text-gray-900 dark:text-white font-bold truncate flex-1 mr-4">{detail.title}</h2>
              <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition text-xl">×</button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Status + Type */}
              <div className="flex gap-2 flex-wrap">
                <span className={`text-xs px-3 py-1 rounded-full font-medium border ${STATUS_STYLES[detail.status] || ''}`}>
                  {detail.status}
                </span>
                <span className="text-xs px-3 py-1 rounded-full bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] font-medium">
                  {detail.type}
                </span>
                {detail.is_activity && (
                  <span className="text-xs px-3 py-1 rounded-full bg-[#F0A500]/10 text-[#F0A500] font-medium">
                    Activité
                  </span>
                )}
              </div>

              {/* Description */}
              {detail.description && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Description</p>
                  <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed">{detail.description}</p>
                </div>
              )}

              {/* Extra fields */}
              {(() => {
                const extras = parseExtras(detail.review_notes)
                return (
                  <div className="space-y-3">
                    {extras.motivation && (
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
                        <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-semibold">Motivation</p>
                        <p className="text-gray-700 dark:text-slate-300 text-sm">{extras.motivation}</p>
                      </div>
                    )}
                    {extras.estimated_budget && (
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
                        <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-semibold">Budget estimé</p>
                        <p className="text-gray-700 dark:text-slate-300 text-sm">💰 {extras.estimated_budget}</p>
                      </div>
                    )}
                    {extras.timeline && (
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4">
                        <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-1 font-semibold">Calendrier envisagé</p>
                        <p className="text-gray-700 dark:text-slate-300 text-sm">📅 {extras.timeline}</p>
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Meta */}
              <div className="grid grid-cols-2 gap-3">
                {detail.proposer && (
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Proposé par</p>
                    <p className="text-gray-800 dark:text-slate-200 text-sm font-medium">{detail.proposer.full_name}</p>
                    <p className="text-gray-400 dark:text-slate-600 text-xs">@{detail.proposer.username}</p>
                  </div>
                )}
                {detail.chef && (
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Chef suggéré</p>
                    <p className="text-gray-800 dark:text-slate-200 text-sm font-medium">{detail.chef.full_name}</p>
                    <p className="text-gray-400 dark:text-slate-600 text-xs">@{detail.chef.username}</p>
                  </div>
                )}
                {detail.parent && (
                  <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                    <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Projet parent</p>
                    <p className="text-gray-800 dark:text-slate-200 text-sm font-medium">{detail.parent.name}</p>
                  </div>
                )}
                <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                  <p className="text-xs text-gray-400 dark:text-slate-500 mb-1">Soumis le</p>
                  <p className="text-gray-800 dark:text-slate-200 text-sm">
                    {new Date(detail.proposed_at).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
                  </p>
                </div>
              </div>

              {/* Review info if already reviewed */}
              {detail.reviewer && detail.status !== 'En attente' && (
                <div className={`rounded-xl p-4 border ${detail.status === 'Approuvé' ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20' : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20'}`}>
                  <p className="text-xs font-semibold uppercase tracking-wider mb-2 text-gray-500 dark:text-slate-400">Décision administrative</p>
                  <p className="text-sm text-gray-700 dark:text-slate-300">
                    {detail.status === 'Approuvé' ? '✅' : '❌'} {detail.status} par <strong>{detail.reviewer.full_name}</strong>
                  </p>
                  {detail.reviewed_at && (
                    <p className="text-xs text-gray-400 dark:text-slate-500 mt-1">
                      {new Date(detail.reviewed_at).toLocaleDateString('fr-MA', { day: '2-digit', month: 'long', year: 'numeric' })}
                    </p>
                  )}
                </div>
              )}

              {/* Admin review form */}
              {isAdmin && detail.status === 'En attente' && (
                <div className="border-t border-gray-100 dark:border-white/10 pt-5 space-y-3">
                  <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider font-semibold">Décision</p>
                  <textarea
                    value={reviewNote}
                    onChange={e => setReviewNote(e.target.value)}
                    placeholder="Note de révision (optionnelle)..."
                    rows={3}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#1E5F7A] transition resize-none"
                  />
                  <div className="flex gap-3">
                    <button onClick={() => handleReview('Rejeté')} disabled={reviewing}
                      className="flex-1 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 text-red-500 dark:text-red-400 text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50">
                      {reviewing ? '…' : '❌ Rejeter'}
                    </button>
                    <button onClick={() => handleReview('Approuvé')} disabled={reviewing}
                      className="flex-1 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold py-2.5 rounded-xl transition disabled:opacity-50 shadow-lg shadow-green-500/30">
                      {reviewing ? '…' : '✅ Approuver'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Submit Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-1">Soumettre une proposition</h2>
            <p className="text-gray-400 dark:text-slate-500 text-xs mb-5">Votre proposition sera examinée par un administrateur.</p>

            <form onSubmit={handleSubmit} className="space-y-4">

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Titre *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Titre de votre proposition"
                  className={inputCls} />
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Décrivez votre projet ou activité..."
                  className={`${inputCls} resize-none`} />
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Motivation</label>
                <textarea rows={2} value={form.motivation} onChange={e => setForm(f => ({ ...f, motivation: e.target.value }))}
                  placeholder="Pourquoi ce projet est-il important pour l'association ?"
                  className={`${inputCls} resize-none`} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Type *</label>
                  <select value={form.type}
                    onChange={e => setForm(f => ({ ...f, type: e.target.value, is_activity: e.target.value === 'Activité' }))}
                    className={inputCls}>
                    <option>Projet</option>
                    <option>Activité</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Budget estimé</label>
                  <input value={form.estimated_budget} onChange={e => setForm(f => ({ ...f, estimated_budget: e.target.value }))}
                    placeholder="ex: 5 000 MAD"
                    className={inputCls} />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Calendrier envisagé</label>
                <input value={form.timeline} onChange={e => setForm(f => ({ ...f, timeline: e.target.value }))}
                  placeholder="ex: Mars 2026, 3 jours"
                  className={inputCls} />
              </div>

              {form.type === 'Activité' && projects.length > 0 && (
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Projet parent</label>
                  <select value={form.parent_project_id} onChange={e => setForm(f => ({ ...f, parent_project_id: e.target.value }))}
                    className={inputCls}>
                    <option value="">Sélectionner…</option>
                    {projects.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Chef de projet suggéré</label>
                <select value={form.suggested_chef} onChange={e => setForm(f => ({ ...f, suggested_chef: e.target.value }))}
                  className={inputCls}>
                  <option value="">Sélectionner…</option>
                  {profiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                  {submitting ? 'Envoi…' : 'Soumettre'}
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}