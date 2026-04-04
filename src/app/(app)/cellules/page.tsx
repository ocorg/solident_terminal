'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

interface Cellule {
  id: string; name: string; description: string | null
  cellule_members: { user_id: string; profiles: { full_name: string } }[]
}

export default function CellulesPage() {
  const supabase = createClient()
  const router = useRouter()

  const [cellules,   setCellules]   = useState<Cellule[]>([])
  const [filtered,   setFiltered]   = useState<Cellule[]>([])
  const [loading,    setLoading]    = useState(true)
  const [isAdmin,    setIsAdmin]    = useState(false)
  const [search,     setSearch]     = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [toast,      setToast]      = useState<{ msg: string; ok: boolean } | null>(null)
  const [toastLeaving, setToastLeaving] = useState(false)
  const [form, setForm] = useState({ name: '', description: '' })

  function showToast(msg: string, ok = true) {
    setToastLeaving(false)
    setToast({ msg, ok })
    setTimeout(() => setToastLeaving(true), 2800)
    setTimeout(() => { setToast(null); setToastLeaving(false) }, 3500)
  }

  async function loadCellules() {
    const res = await fetch('/api/cellules')
    const data = await res.json()
    if (Array.isArray(data)) { setCellules(data); setFiltered(data) }
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
    loadCellules()
  }, [])

  useEffect(() => {
    if (!search) { setFiltered(cellules); return }
    setFiltered(cellules.filter(c =>
      c.name.toLowerCase().includes(search.toLowerCase())
    ))
  }, [search, cellules])

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/cellules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Cellule créée !')
    setShowCreate(false)
    setForm({ name: '', description: '' })
    loadCellules()
  }

  const initials = (name: string) =>
    name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">

      {toast && (
        <div style={{ animation: toastLeaving ? 'toastOut 0.4s cubic-bezier(0.36,0,0.66,0) forwards' : 'toastIn 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}
          className={`fixed top-6 left-1/2 -translate-x-1/2 z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Cellules</h1>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">{cellules.length} cellule{cellules.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
            <span className="text-lg leading-none">+</span> Nouvelle cellule
          </button>
        )}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Rechercher une cellule..."
          className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#1E5F7A] transition" />
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-600">Aucune cellule trouvée</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(cellule => {
            const memberCount = cellule.cellule_members?.length || 0
            return (
              <div key={cellule.id}
                onClick={() => router.push(`/cellules/${cellule.id}`)}
                className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 cursor-pointer hover:border-[#1E5F7A]/50 hover:shadow-lg hover:shadow-[#1E5F7A]/10 transition-all duration-200 group">

                <div className="flex items-start gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-[#F0A500]/10 flex items-center justify-center text-xl flex-shrink-0">
                    🏛️
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-gray-900 dark:text-white font-semibold text-sm truncate">{cellule.name}</h3>
                    {cellule.description && (
                      <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 line-clamp-2">{cellule.description}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-white/5">
                  <div className="flex -space-x-2">
                    {cellule.cellule_members?.slice(0, 4).map((m, i) => (
                      <div key={i} title={m.profiles?.full_name}
                        className="w-7 h-7 rounded-full bg-[#F0A500]/20 text-[#F0A500] text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-[#0a0f1e]">
                        {initials(m.profiles?.full_name || '?')}
                      </div>
                    ))}
                    {memberCount > 4 && (
                      <div className="w-7 h-7 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 text-[10px] flex items-center justify-center border-2 border-white dark:border-[#0a0f1e]">
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
          <div className="relative w-full max-w-md bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <h2 className="text-gray-900 dark:text-white font-bold text-lg mb-5">Nouvelle cellule</h2>
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Nom *</label>
                <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="ex: Cellule Organisation & Logistique"
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Rôle et responsabilités de cette cellule..."
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition resize-none" />
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                  {submitting ? 'Création…' : 'Créer'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}