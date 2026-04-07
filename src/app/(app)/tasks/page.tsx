'use client'

import { useEffect, useState, useRef } from 'react'
import { useToast, ToastStyle } from '@/hooks/useToast'
import ConfirmModal from '@/components/ConfirmModal'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────
interface Assignee { user_id: string; profiles: { full_name: string; username: string } }
interface Task {
  id: string; title: string; description: string | null
  status: string; priority: string; due_date: string | null
  context_type: string; context_id: string
  created_at: string; created_by: string
  task_assignees: Assignee[]
}
interface Comment { id: string; content: string; created_at: string; profiles: { full_name: string; username: string } }
interface Profile { id: string; full_name: string; username: string }
interface ContextOption { id: string; name: string; type: string }

// ─── Constants ───────────────────────────────────────────────
const STATUSES = ['📋 À faire', '🔄 En cours', '🚫 Bloqué', '✅ Terminé']

const PRIORITIES = ['🔴 Urgent', '🟠 Élevé', '🟡 Moyen', '🟢 Faible']

const STATUS_STYLES: Record<string, string> = {
  '📋 À faire':  'border-t-slate-400',
  '🔄 En cours': 'border-t-[#1E5F7A]',
  '🚫 Bloqué':   'border-t-red-400',
  '✅ Terminé':  'border-t-green-400',
}

const PRIORITY_DOT: Record<string, string> = {
  '🔴 Urgent': 'bg-red-400',
  '🟠 Élevé':  'bg-orange-400',
  '🟡 Moyen':  'bg-yellow-400',
  '🟢 Faible': 'bg-green-400',
}

// ─── Helpers ─────────────────────────────────────────────────
const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

const isOverdue = (due: string | null) =>
  due && new Date(due) < new Date() ? true : false

// ─── Main Component ──────────────────────────────────────────
export default function TasksPage() {
  const supabase = createClient()

  const [tasks,        setTasks]        = useState<Task[]>([])
  const [loading,      setLoading]      = useState(true)
  const [view,         setView]         = useState<'kanban' | 'list'>('kanban')
  const [detail,       setDetail]       = useState<Task | null>(null)
  const [comments,     setComments]     = useState<Comment[]>([])
  const [newComment,   setNewComment]   = useState('')
  const [postingComment, setPostingComment] = useState(false)
  const [showCreate,   setShowCreate]   = useState(false)
  const [profiles,     setProfiles]     = useState<Profile[]>([])
  const [contexts,     setContexts]     = useState<ContextOption[]>([])
  const [dragId,       setDragId]       = useState<string | null>(null)
  const { toast, toastLeaving, showToast } = useToast()
  const [filterStatus, setFilterStatus] = useState('Tous')
  const [search,       setSearch]       = useState('')
  const [isAdmin,        setIsAdmin]        = useState(false)
  const [showArchived,   setShowArchived]   = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const [form, setForm] = useState({
    title: '', description: '', context_type: 'project',
    context_id: '', priority: '🟡 Moyen', due_date: '', assignee_ids: [] as string[],
  })
  const [editForm, setEditForm] = useState<Partial<Task> | null>(null)
  const commentEndRef = useRef<HTMLDivElement>(null)


  // ─── Load data ─────────────────────────────────────────────
  async function loadTasks() {
    const res = await fetch(`/api/tasks?archived=${showArchived}`)
    const data = await res.json()
    if (Array.isArray(data)) setTasks(data)
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      setIsAdmin(!!profile?.is_admin)

      const [profsRes, projRes, celRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username'),
        supabase.from('projects').select('id, name'),
        supabase.from('cellules').select('id, name'),
      ])

      if (profsRes.data) setProfiles(profsRes.data)

      const ctxs: ContextOption[] = [
        ...(projRes.data || []).map(p => ({ id: p.id, name: p.name, type: 'project'  })),
        ...(celRes.data  || []).map(c => ({ id: c.id, name: c.name, type: 'cellule'  })),
      ]
      setContexts(ctxs)
      if (ctxs.length > 0) setForm(f => ({ ...f, context_id: ctxs[0].id, context_type: ctxs[0].type }))
    }
    init()
  }, [])

  useEffect(() => {
    loadTasks()
  }, [showArchived])

  // ─── Comments ──────────────────────────────────────────────
  async function loadComments(taskId: string) {
    const res = await fetch(`/api/comments/${taskId}`)
    const data = await res.json()
    if (Array.isArray(data)) setComments(data)
  }

  async function submitComment() {
    if (!detail || !newComment.trim()) return
    setPostingComment(true)
    const res = await fetch('/api/comments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: detail.id, content: newComment }),
    })
    const data = await res.json()
    setPostingComment(false)
    if (!res.ok) { showToast(data.error, false); return }
    setComments(c => [...c, data])
    setNewComment('')
    setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // ─── Create task ───────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Tâche créée !')
    setShowCreate(false)
    setForm(f => ({ ...f, title: '', description: '', due_date: '', assignee_ids: [] }))
    loadTasks()
  }

  // ─── Update task ───────────────────────────────────────────
  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error, false); return }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    if (detail?.id === id) setDetail(d => d ? { ...d, ...data } : d)
    return data
  }

  // ─── Delete task ───────────────────────────────────────────
  function deleteTask(id: string) {
    setConfirm({
      title: 'Supprimer la tâche',
      message: 'Êtes-vous sûr de vouloir supprimer cette tâche ?',
      onConfirm: async () => {
        const res = await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
        if (!res.ok) { showToast('Erreur lors de la suppression', false); return }
        showToast('Tâche supprimée.')
        setTasks(prev => prev.filter(t => t.id !== id))
        if (detail?.id === id) setDetail(null)
      }
    })
  }

  // ─── Save edit ─────────────────────────────────────────────
  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!detail || !editForm) return
    await updateTask(detail.id, editForm)
    setEditForm(null)
    showToast('Tâche mise à jour !')
  }

  // ─── Drag & Drop ───────────────────────────────────────────
  function onDragStart(taskId: string) { setDragId(taskId) }
  function onDragOver(e: React.DragEvent) { e.preventDefault() }
  async function onDrop(status: string) {
    if (!dragId) return
    await updateTask(dragId, { status } as Partial<Task>)
    setDragId(null)
  }

  // ─── Filtered tasks ────────────────────────────────────────
  const displayed = tasks.filter(t => {
    const matchSearch = !search ||
      t.title.toLowerCase().includes(search.toLowerCase())
    const matchStatus = filterStatus === 'Tous' || t.status === filterStatus
    return matchSearch && matchStatus
  })

  // ─── Open detail ───────────────────────────────────────────
  function openDetail(task: Task) {
    setDetail(task)
    setEditForm(null)
    loadComments(task.id)
  }

  // ─── Render ────────────────────────────────────────────────
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
          confirmLabel="Confirmer"
          danger
          onConfirm={() => { confirm.onConfirm(); setConfirm(null) }}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Tâches</h1>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">{tasks.length} tâche{tasks.length !== 1 ? 's' : ''} au total</p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <button
            onClick={() => setShowArchived(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition border ${showArchived ? 'bg-[#F0A500]/20 text-[#F0A500] border-[#F0A500]/30' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#F0A500]'}`}>
            {showArchived ? '📦 Archivées' : '📦 Archivées'}
          </button>
          <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1 gap-1">
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === v ? 'bg-white dark:bg-[#1E5F7A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                {v === 'kanban' ? '⬛ Kanban' : '☰ Liste'}
              </button>
            ))}
          </div>
          <button onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
            <span className="text-lg leading-none">+</span> Nouvelle tâche
          </button>
        </div>
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une tâche..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#1E5F7A] transition" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['Tous', ...STATUSES].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${filterStatus === s ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Loading */}
      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
        </div>

      /* ── Kanban ── */
      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map(status => {
            const col = displayed.filter(t => t.status === status)
            return (
              <div key={status}
                onDragOver={onDragOver}
                onDrop={() => onDrop(status)}
                className={`bg-gray-50 dark:bg-white/[0.03] border border-gray-200 dark:border-white/10 rounded-2xl p-3 min-h-[300px] border-t-4 ${STATUS_STYLES[status]} transition-all duration-200`}>
                <div className="flex items-center justify-between mb-3 px-1">
                  <span className="text-gray-700 dark:text-slate-300 text-xs font-semibold">{status}</span>
                  <span className="bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-slate-400 text-xs px-2 py-0.5 rounded-full">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map(task => (
                    <div key={task.id}
                      draggable
                      onDragStart={() => onDragStart(task.id)}
                      onClick={() => openDetail(task)}
                      className={`bg-white dark:bg-[#0e1628] border rounded-xl p-3 cursor-grab active:cursor-grabbing hover:border-[#1E5F7A]/50 hover:shadow-md transition-all duration-200 ${dragId === task.id ? 'opacity-40 scale-95' : ''} ${isOverdue(task.due_date) && task.status !== '✅ Terminé' ? 'border-red-300 dark:border-red-500/30' : 'border-gray-200 dark:border-white/10'}`}>
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <p className="text-gray-900 dark:text-white text-sm font-medium leading-snug">{task.title}</p>
                        <div className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} />
                      </div>
                      {task.due_date && (
                        <p className={`text-xs mt-1 ${isOverdue(task.due_date) && task.status !== '✅ Terminé' ? 'text-red-400' : 'text-gray-400 dark:text-slate-600'}`}>
                          📅 {new Date(task.due_date).toLocaleDateString('fr-MA')}
                        </p>
                      )}
                      {task.task_assignees?.length > 0 && (
                        <div className="flex mt-2 gap-1">
                          {task.task_assignees.slice(0, 3).map(a => (
                            <div key={a.user_id} title={a.profiles?.full_name}
                              className="w-6 h-6 rounded-full bg-[#1E5F7A]/30 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center">
                              {initials(a.profiles?.full_name || '?')}
                            </div>
                          ))}
                          {task.task_assignees.length > 3 && (
                            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 text-gray-500 dark:text-slate-400 text-[10px] flex items-center justify-center">
                              +{task.task_assignees.length - 3}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                  {col.length === 0 && (
                    <p className="text-center text-gray-300 dark:text-slate-700 text-xs py-8">Aucune tâche</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      /* ── List ── */
      ) : (
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          {displayed.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-600 py-12">Aucune tâche</p>
          ) : displayed.map((task, i) => (
            <div key={task.id} onClick={() => openDetail(task)}
              className={`flex items-center gap-4 px-5 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition ${i !== displayed.length - 1 ? 'border-b border-gray-100 dark:border-white/5' : ''}`}>
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} />
              <p className="text-gray-900 dark:text-white text-sm font-medium flex-1 truncate">{task.title}</p>
              <span className="text-xs text-gray-500 dark:text-slate-500 hidden sm:block">{task.context_type}</span>
              {task.due_date && (
                <span className={`text-xs hidden md:block ${isOverdue(task.due_date) && task.status !== '✅ Terminé' ? 'text-red-400' : 'text-gray-400 dark:text-slate-600'}`}>
                  {new Date(task.due_date).toLocaleDateString('fr-MA')}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${
                task.status === '📋 À faire'  ? 'bg-slate-100  dark:bg-slate-500/20  text-slate-600  dark:text-slate-300' :
                task.status === '🔄 En cours' ? 'bg-blue-50    dark:bg-[#1E5F7A]/20  text-[#1E5F7A]  dark:text-[#5bbcde]' :
                task.status === '🚫 Bloqué'   ? 'bg-red-50     dark:bg-red-500/20    text-red-500    dark:text-red-400'   :
                                                'bg-green-50   dark:bg-green-500/20  text-green-600  dark:text-green-400'
              }`}>
                {task.status}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Slide-Over ─────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-lg bg-white dark:bg-[#0e1628] border-l border-gray-200 dark:border-white/10 h-full flex flex-col animate-in slide-in-from-right duration-300">

            {/* Slide-over header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              <h2 className="text-gray-900 dark:text-white font-bold truncate flex-1 mr-4">{detail.title}</h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => setEditForm(editForm ? null : { ...detail })}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] hover:bg-[#1E5F7A]/20 transition font-medium">
                  {editForm ? 'Annuler' : 'Modifier'}
                </button>
                <button
                  onClick={async () => {
                    setConfirm({
                      title: 'Archiver la tâche',
                      message: 'Archiver cette tâche ? Elle n\'apparaîtra plus dans la liste principale.',
                      onConfirm: async () => {
                    await updateTask(detail.id, { archived: true } as any)
                        setDetail(null)
                        showToast('Tâche archivée.')
                      }
                    })
                  }}
                  className="text-xs px-3 py-1.5 rounded-lg bg-[#F0A500]/10 text-[#F0A500] hover:bg-[#F0A500]/20 transition font-medium">
                  Archiver
                </button>
                <button onClick={() => deleteTask(detail.id)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition font-medium">
                  Supprimer
                </button>
                <button onClick={() => setDetail(null)}
                  className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition text-xl ml-1">×</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">

              {/* Edit form */}
              {editForm ? (
                <form onSubmit={saveEdit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Titre</label>
                    <input value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                    <textarea rows={3} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition resize-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Statut</label>
                      <select value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                        {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Priorité</label>
                      <select value={editForm.priority || ''} onChange={e => setEditForm(f => ({ ...f, priority: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                        {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Échéance</label>
                    <input type="datetime-local" value={editForm.due_date?.slice(0, 16) || ''} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                  </div>
                  <button type="submit"
                    className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                    Enregistrer
                  </button>
                </form>

              ) : (
                <div className="p-6 space-y-5">

                  {/* Status + Priority badges */}
                  <div className="flex gap-2 flex-wrap">
                    <span className={`text-xs px-3 py-1 rounded-full font-medium ${
                      detail.status === '📋 À faire'  ? 'bg-slate-100  dark:bg-slate-500/20 text-slate-600 dark:text-slate-300' :
                      detail.status === '🔄 En cours' ? 'bg-blue-50    dark:bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde]' :
                      detail.status === '🚫 Bloqué'   ? 'bg-red-50     dark:bg-red-500/20   text-red-500  dark:text-red-400'   :
                                                        'bg-green-50   dark:bg-green-500/20  text-green-600 dark:text-green-400'
                    }`}>{detail.status}</span>
                    <span className="text-xs px-3 py-1 rounded-full bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 font-medium">{detail.priority}</span>
                    {isOverdue(detail.due_date) && detail.status !== '✅ Terminé' && (
                      <span className="text-xs px-3 py-1 rounded-full bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 font-medium">⚠️ En retard</span>
                    )}
                  </div>

                  {/* Description */}
                  {detail.description && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Description</p>
                      <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed">{detail.description}</p>
                    </div>
                  )}

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                      <p className="text-gray-400 dark:text-slate-500 mb-1">Contexte</p>
                      <p className="text-gray-700 dark:text-slate-300 font-medium capitalize">{detail.context_type}</p>
                    </div>
                    {detail.due_date && (
                      <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3">
                        <p className="text-gray-400 dark:text-slate-500 mb-1">Échéance</p>
                        <p className={`font-medium ${isOverdue(detail.due_date) && detail.status !== '✅ Terminé' ? 'text-red-400' : 'text-gray-700 dark:text-slate-300'}`}>
                          {new Date(detail.due_date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Quick status change */}
                  <div>
                    <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Changer le statut</p>
                    <div className="flex gap-2 flex-wrap">
                      {STATUSES.map(s => (
                        <button key={s} onClick={() => updateTask(detail.id, { status: s } as Partial<Task>)}
                          className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${detail.status === s ? 'bg-[#1E5F7A] text-white' : 'bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 hover:bg-gray-200 dark:hover:bg-white/10'}`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assignees */}
                  {detail.task_assignees?.length > 0 && (
                    <div>
                      <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Assignés</p>
                      <div className="flex flex-wrap gap-2">
                        {detail.task_assignees.map(a => (
                          <div key={a.user_id} className="flex items-center gap-2 bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-1.5">
                            <div className="w-6 h-6 rounded-full bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center">
                              {initials(a.profiles?.full_name || '?')}
                            </div>
                            <span className="text-gray-700 dark:text-slate-300 text-xs">{a.profiles?.full_name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Comments */}
              <div className="px-6 pb-6 border-t border-gray-100 dark:border-white/10 pt-5">
                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 font-semibold">Commentaires ({comments.length})</p>
                <div className="space-y-3 max-h-52 overflow-y-auto mb-3">
                  {comments.length === 0 ? (
                    <p className="text-gray-400 dark:text-slate-600 text-xs text-center py-4">Aucun commentaire</p>
                  ) : comments.map(c => (
                    <div key={c.id} className="flex gap-3">
                      <div className="w-7 h-7 rounded-full bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                        {initials(c.profiles?.full_name || '?')}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-gray-700 dark:text-slate-300 text-xs font-semibold">{c.profiles?.full_name}</span>
                          <span className="text-gray-400 dark:text-slate-600 text-[10px]">{new Date(c.created_at).toLocaleString('fr-MA')}</span>
                        </div>
                        <p className="text-gray-600 dark:text-slate-400 text-xs leading-relaxed bg-gray-50 dark:bg-white/5 rounded-xl px-3 py-2">{c.content}</p>
                      </div>
                    </div>
                  ))}
                  <div ref={commentEndRef} />
                </div>
                <div className="flex gap-2">
                  <input value={newComment} onChange={e => setNewComment(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submitComment() } }}
                    placeholder="Ajouter un commentaire..."
                    className="flex-1 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#1E5F7A] transition" />
                  <button onClick={submitComment} disabled={postingComment || !newComment.trim()}
                    className="bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-40 text-white text-xs px-3 rounded-xl transition">
                    ↑
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ──────────────────────────────────── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowCreate(false)} />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 dark:text-white font-bold text-lg">Nouvelle tâche</h2>
              <button type="button" onClick={() => setShowCreate(false)}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition text-lg">×</button>
            </div>
            <form onSubmit={handleCreate} className="space-y-4">

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Titre *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Titre de la tâche"
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                <textarea rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle..."
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition resize-none" />
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Contexte *</label>
                <select
                  value={form.context_id}
                  onChange={e => {
                    const ctx = contexts.find(c => c.id === e.target.value)
                    setForm(f => ({ ...f, context_id: e.target.value, context_type: ctx?.type || 'project' }))
                  }}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                  {contexts.map(c => (
                    <option key={c.id} value={c.id}>[{c.type}] {c.name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Priorité</label>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                    {PRIORITIES.map(p => <option key={p} value={p}>{p}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Échéance</label>
                  <input type="datetime-local" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                </div>
              </div>

              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Assigner à</label>
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                  {profiles.map(p => {
                    const selected = form.assignee_ids.includes(p.id)
                    return (
                      <button type="button" key={p.id}
                        onClick={() => setForm(f => ({
                          ...f,
                          assignee_ids: selected
                            ? f.assignee_ids.filter(id => id !== p.id)
                            : [...f.assignee_ids, p.id]
                        }))}
                        className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${selected ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
                        {p.full_name}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit"
                  className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                  Créer la tâche
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  )
}