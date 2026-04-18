'use client'

import { useEffect, useState, useRef } from 'react'
import { useToast, ToastStyle } from '@/hooks/useToast'
import ConfirmModal from '@/components/ConfirmModal'
import { createClient } from '@/lib/supabase/client'

// ─── Types ───────────────────────────────────────────────────
interface Assignee { user_id: string; profiles: { full_name: string; username: string; avatar_url?: string | null } }
interface SecondaryContext { context_type: string; context_id: string; context_name: string }
interface Task {
  context_name?: string
  id: string; title: string; description: string | null
  status: string; priority: string; due_date: string | null
  context_type: string; context_id: string
  created_at: string; created_by: string
  task_assignees: Assignee[]
  secondary_contexts?: SecondaryContext[]
}
interface MemberWorkload {
  id: string; full_name: string; username: string
  taskCount: number; contextCount: number
  label: string; labelColor: string
}
interface Comment { id: string; content: string; created_at: string; profiles: { full_name: string; username: string } }
interface Profile { id: string; full_name: string; username: string }
interface ContextOption { id: string; name: string; type: string }

// ─── Constants ───────────────────────────────────────────────
const STATUSES = ['📋 À faire', '🔄 En cours', '🚫 Bloqué', '✅ Terminé']
const PRIORITIES = ['🔴 Urgent', '🟠 Élevé', '🟡 Moyen', '🟢 Faible']

// Priority strip colors — replaces the dot, much faster to scan
const PRIORITY_STRIP: Record<string, string> = {
  '🔴 Urgent': '#f87171',
  '🟠 Élevé':  '#fb923c',
  '🟡 Moyen':  '#facc15',
  '🟢 Faible': '#4ade80',
}

// Column top-border accent colors
const STATUS_ACCENT: Record<string, string> = {
  '📋 À faire':  '#94a3b8',
  '🔄 En cours': '#1E5F7A',
  '🚫 Bloqué':   '#f87171',
  '✅ Terminé':  '#4ade80',
}

const initials = (name: string) =>
  name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

async function loadMembersForContext(contextId: string, contextType: string): Promise<MemberWorkload[]> {
    if (!contextId) return []
    const supabase = createClient()
    let memberIds: string[] = []
    if (contextType === 'project') {
      const { data } = await supabase.from('project_members').select('user_id').eq('project_id', contextId)
      memberIds = (data || []).map(r => r.user_id)
    } else {
      const { data } = await supabase.from('cellule_members').select('user_id').eq('cellule_id', contextId)
      memberIds = (data || []).map(r => r.user_id)
    }
    if (memberIds.length === 0) return []
    const { data: profs } = await supabase.from('profiles').select('id, full_name, username, avatar_url').in('id', memberIds)
    const { data: assigneeRows } = await supabase.from('task_assignees').select('user_id').in('user_id', memberIds)
    const taskCountMap: Record<string, number> = {}
    ;(assigneeRows || []).forEach((r: any) => { taskCountMap[r.user_id] = (taskCountMap[r.user_id] || 0) + 1 })
    return (profs || []).map(p => {
      const count = taskCountMap[p.id] || 0
      const label = count >= 6 ? 'Chargé 🔴' : count >= 3 ? 'Modéré 🟡' : 'Disponible 🟢'
      const labelColor = count >= 6 ? 'text-red-400' : count >= 3 ? 'text-yellow-500' : 'text-green-500'
      return { id: p.id, full_name: p.full_name, username: p.username, taskCount: count, contextCount: 0, label, labelColor }
    }).sort((a, b) => a.taskCount - b.taskCount)
  }

const isOverdue = (due: string | null) =>
  due ? new Date(due) < new Date() : false

// ─── Main Component ──────────────────────────────────────────
export default function TasksPage() {
  const supabase = createClient()

  const [tasks,           setTasks]           = useState<Task[]>([])
  const [loading,         setLoading]         = useState(true)
  const [view,            setView]            = useState<'kanban' | 'list'>('kanban')
  const [detail,          setDetail]          = useState<Task | null>(null)
  const [comments,        setComments]        = useState<Comment[]>([])
  const [newComment,      setNewComment]      = useState('')
  const [postingComment,  setPostingComment]  = useState(false)
  const [showCreate,      setShowCreate]      = useState(false)
  const [creating,        setCreating]        = useState(false)
  const [profiles,        setProfiles]        = useState<Profile[]>([])
  const [contexts,        setContexts]        = useState<ContextOption[]>([])
  const [dragId,          setDragId]          = useState<string | null>(null)
  const [dragOverCol,     setDragOverCol]     = useState<string | null>(null)
  const { toast, toastLeaving, showToast } = useToast()
  const [filterStatus,    setFilterStatus]    = useState('Tous')
  const [filterContext,   setFilterContext]   = useState('Tous')
  const [search,          setSearch]          = useState('')
  const [isAdmin,         setIsAdmin]         = useState(false)
  const [showArchived,    setShowArchived]    = useState(false)
  const [confirm,         setConfirm]         = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)
  const [managedContextIds, setManagedContextIds] = useState<Set<string>>(new Set())
  const [contextMembers,  setContextMembers]  = useState<MemberWorkload[]>([])
  const [loadingMembers,  setLoadingMembers]  = useState(false)
  const [editAssigneeIds,    setEditAssigneeIds]    = useState<string[]>([])
  const [editContextId,      setEditContextId]      = useState<string>('')
  const [editContextType,    setEditContextType]    = useState<string>('project')
  const [editContextMembers, setEditContextMembers] = useState<MemberWorkload[]>([])
  const [editMemberSearch,   setEditMemberSearch]   = useState('')
  const [keepCreating,       setKeepCreating]       = useState(false)
  // Multi-context creation state (up to 4 secondary contexts)
  const [multiCtxEnabled,    setMultiCtxEnabled]    = useState(false)
  const [secondaryContexts,  setSecondaryContexts]  = useState<Array<{ contextId: string; contextType: string; assigneeIds: string[]; members: MemberWorkload[]; search: string }>>([])
  const [editSecondaryContexts, setEditSecondaryContexts] = useState<Array<{ contextId: string; contextType: string; assigneeIds: string[]; members: MemberWorkload[]; search: string }>>([])

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
      const admin = !!profile?.is_admin
      setIsAdmin(admin)

      if (!admin) {
        const [{ data: projMemberships }, { data: celMemberships }] = await Promise.all([
          supabase.from('project_members').select('project_id, project_positions(position_name)').eq('user_id', user.id),
          supabase.from('cellule_members').select('cellule_id, cellule_positions(position_name)').eq('user_id', user.id),
        ])
        const managed = new Set<string>()
        ;(projMemberships || []).forEach((m: any) => {
          if (m.project_positions?.position_name && !m.project_positions.position_name.toLowerCase().includes('membre'))
            managed.add(m.project_id)
        })
        ;(celMemberships || []).forEach((m: any) => {
          if (m.cellule_positions?.position_name && !m.cellule_positions.position_name.toLowerCase().includes('membre'))
            managed.add(m.cellule_id)
        })
        setManagedContextIds(managed)
      }

      const [profsRes, projRes, celRes] = await Promise.all([
        supabase.from('profiles').select('id, full_name, username'),
        supabase.from('projects').select('id, name'),
        supabase.from('cellules').select('id, name'),
      ])
      if (profsRes.data) setProfiles(profsRes.data)
      const ctxs: ContextOption[] = [
        ...(projRes.data || []).map(p => ({ id: p.id, name: p.name, type: 'project' })),
        ...(celRes.data  || []).map(c => ({ id: c.id, name: c.name, type: 'cellule' })),
      ].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'project' ? -1 : 1
        return a.name.localeCompare(b.name, 'fr')
      })
      setContexts(ctxs)
      if (ctxs.length > 0) setForm(f => ({ ...f, context_id: ctxs[0].id, context_type: ctxs[0].type }))
    }
    init()
  }, [])

  useEffect(() => { loadTasks() }, [showArchived])
  useEffect(() => {
    if (!editContextId) return
    loadMembersForContext(editContextId, editContextType).then(members => {
      setEditContextMembers(members)
      // Clear assignees not in new context
      setEditAssigneeIds(prev => prev.filter(id => members.some(m => m.id === id)))
    })
  }, [editContextId, editContextType]) // eslint-disable-line react-hooks/exhaustive-deps

  // Load context members when context changes (for workload display)
  useEffect(() => {
    if (!form.context_id) return
    async function loadContextMembers() {
      setLoadingMembers(true)
      let memberIds: string[] = []
      if (form.context_type === 'project') {
        const { data } = await supabase.from('project_members').select('user_id').eq('project_id', form.context_id)
        memberIds = (data || []).map(r => r.user_id)
      } else {
        const { data } = await supabase.from('cellule_members').select('user_id').eq('cellule_id', form.context_id)
        memberIds = (data || []).map(r => r.user_id)
      }
      if (memberIds.length === 0) { setContextMembers([]); setLoadingMembers(false); return }
      const { data: profs } = await supabase.from('profiles').select('id, full_name, username').in('id', memberIds)
      const { data: assigneeRows } = await supabase.from('task_assignees').select('user_id').in('user_id', memberIds)
      const taskCountMap: Record<string, number> = {}
      ;(assigneeRows || []).forEach((r: any) => { taskCountMap[r.user_id] = (taskCountMap[r.user_id] || 0) + 1 })
      const [{ data: projMemberships }, { data: celMemberships }] = await Promise.all([
        supabase.from('project_members').select('user_id').in('user_id', memberIds),
        supabase.from('cellule_members').select('user_id').in('user_id', memberIds),
      ])
      const contextCountMap: Record<string, number> = {}
      ;[...(projMemberships || []), ...(celMemberships || [])].forEach((r: any) => {
        contextCountMap[r.user_id] = (contextCountMap[r.user_id] || 0) + 1
      })
      const enriched: MemberWorkload[] = (profs || []).map(p => {
        const count = taskCountMap[p.id] || 0
        const ctxCount = contextCountMap[p.id] || 0
        let label = 'Disponible 🟢'; let labelColor = 'text-green-500'
        if (count >= 6) { label = 'Chargé 🔴'; labelColor = 'text-red-400' }
        else if (count >= 3) { label = 'Modéré 🟡'; labelColor = 'text-yellow-500' }
        return { id: p.id, full_name: p.full_name, username: p.username, taskCount: count, contextCount: ctxCount, label, labelColor }
      }).sort((a, b) => a.taskCount - b.taskCount)
      setContextMembers(enriched)
      setLoadingMembers(false)
    }
    loadContextMembers()
  }, [form.context_id])

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
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task_id: detail.id, content: newComment }),
    })
    const data = await res.json()
    setPostingComment(false)
    if (!res.ok) { showToast(data.error, false); return }
    setComments(c => [...c, data])
    setNewComment('')
    setTimeout(() => commentEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
  }

  // ─── CRUD ──────────────────────────────────────────────────
  async function handleCreate(e: React.FormEvent) {
  e.preventDefault();
  setCreating(true);
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        assignee_ids: [
          ...form.assignee_ids,
          ...secondaryContexts.flatMap(sc => sc.assigneeIds),
        ],
        secondary_contexts: secondaryContexts.map(sc => ({
          context_type: sc.contextType,
          context_id:   sc.contextId,
        })),
      }),
    });
    const data = await res.json();
    if (!res.ok) {
      showToast(data.error, false);
      return;
    }
    showToast('Tâche créée !');
    await loadTasks();
    setSecondaryContexts([])
    setMultiCtxEnabled(false)
    setForm(f => ({ ...f, title: '', description: '', due_date: '', assignee_ids: [] }));
    if (!keepCreating) {
      setShowCreate(false);
    }
  } catch (error) {
    showToast("Une erreur est survenue", false);
  } finally {
    setCreating(false);
  }
}

  async function updateTask(id: string, updates: Partial<Task>) {
    const res = await fetch(`/api/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error, false); return }
    setTasks(prev => prev.map(t => t.id === id ? { ...t, ...data } : t))
    if (detail?.id === id) setDetail(d => d ? { ...d, ...data } : d)
    return data
  }

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

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    if (!detail || !editForm) return
    const secondaryCtxPayload = editSecondaryContexts.map(sc => ({
      context_type: sc.contextType, context_id: sc.contextId
    }))
    const allAssigneeIds = [
      ...editAssigneeIds,
      ...editSecondaryContexts.flatMap(sc => sc.assigneeIds),
    ]
    await updateTask(detail.id, {
      title:              editForm.title,
      description:        editForm.description,
      status:             editForm.status,
      priority:           editForm.priority,
      due_date:           editForm.due_date,
      context_type:       editContextType,
      context_id:         editContextId,
      assignee_ids:       [...new Set(allAssigneeIds)],
      secondary_contexts: secondaryCtxPayload,
    } as any)
    // Bug 3 fix: manually rebuild task_assignees for the detail panel
    const newAssignees = [...new Set(allAssigneeIds)].map(uid => {
      const found = profiles.find(p => p.id === uid)
      return { user_id: uid, profiles: { full_name: found?.full_name || '?', username: found?.username || '', avatar_url: (found as any)?.avatar_url || null } }
    })
    const updatedCtxName = contexts.find(c => c.id === editContextId)?.name || editContextType
    setDetail(d => d ? {
      ...d,
      title: editForm.title || d.title,
      description: editForm.description ?? d.description,
      status: editForm.status || d.status,
      priority: editForm.priority || d.priority,
      due_date: editForm.due_date ?? d.due_date,
      context_id: editContextId,
      context_type: editContextType,
      context_name: updatedCtxName,
      task_assignees: newAssignees,
      secondary_contexts: secondaryCtxPayload.map(sc => ({
        ...sc, context_name: contexts.find(c => c.id === sc.context_id)?.name || sc.context_type
      })),
    } : d)
    setEditForm(null)
    setEditAssigneeIds([])
    setEditSecondaryContexts([])
    showToast('Tâche mise à jour !')
    await loadTasks()
  }

  // ─── Drag & Drop ───────────────────────────────────────────
  function onDragStart(taskId: string) { setDragId(taskId) }
  function onDragOver(e: React.DragEvent, status: string) { e.preventDefault(); setDragOverCol(status) }
  function onDragLeave() { setDragOverCol(null) }
  async function onDrop(status: string) {
    if (!dragId) return
    await updateTask(dragId, { status } as Partial<Task>)
    setDragId(null); setDragOverCol(null)
  }

  // ─── Filters ───────────────────────────────────────────────
  const displayed = tasks.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (filterStatus !== 'Tous' && t.status !== filterStatus) return false
    if (filterContext !== 'Tous') {
      const inPrimary = t.context_name === filterContext
      const inSecondary = (t.secondary_contexts || []).some(sc => sc.context_name === filterContext)
      if (!inPrimary && !inSecondary) return false
    }
    return true
  })

  const canManageTask = (task: Task) => isAdmin || managedContextIds.has(task.context_id)

  function openDetail(task: Task) {
    setDetail(task)
    setEditForm(null)
    setEditAssigneeIds([])
    setEditContextId(task.context_id)
    setEditContextType(task.context_type)
    setEditMemberSearch('')
    loadComments(task.id)
    setForm(f => ({ ...f, context_id: task.context_id, context_type: task.context_type }))
    // Pre-load member workloads for the view panel (same data the edit panel uses)
    loadMembersForContext(task.context_id, task.context_type).then(setEditContextMembers)
  }

  // ─── Render ────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {toast && (
        <div style={ToastStyle(toastLeaving)}
          className={`fixed top-6 left-0 right-0 mx-auto w-fit z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {confirm && (
        <ConfirmModal title={confirm.title} message={confirm.message} confirmLabel="Confirmer" danger
          onConfirm={() => { confirm.onConfirm(); setConfirm(null) }}
          onCancel={() => setConfirm(null)} />
      )}

      {/* ── Row 1: Title + Controls ── */}
      {/* WHY: merged the archive toggle, view switch, and create button into one tight row
          with the title. Saves a full row of vertical space. */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Tâches</h1>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">{tasks.length} tâche{tasks.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => setShowArchived(prev => !prev)}
            className={`px-3 py-2 rounded-xl text-xs font-medium transition border ${showArchived ? 'bg-[#F0A500]/20 text-[#F0A500] border-[#F0A500]/30' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#F0A500]'}`}>
            📦 Archivées
          </button>
          <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1 gap-1">
            {(['kanban', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === v ? 'bg-white dark:bg-[#1E5F7A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                {v === 'kanban' ? '⬛ Kanban' : '☰ Liste'}
              </button>
            ))}
          </div>
          {(isAdmin || managedContextIds.size > 0) && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
              <span className="text-lg leading-none">+</span> Nouvelle tâche
            </button>
          )}
        </div>
      </div>

      {/* ── Row 2: Search + Status filters (hidden in kanban — columns show status already) ── */}
      {/* WHY: In kanban mode, the 4 column headers already show À faire / En cours / etc.
          Showing status filter buttons too is redundant. We hide them in kanban view.
          The search stays always visible. */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher une tâche..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 dark:placeholder:text-slate-600 focus:outline-none focus:border-[#1E5F7A] transition" />
        </div>
        {view === 'list' && (
          <div className="flex gap-1.5 flex-wrap">
            {['Tous', ...STATUSES].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={`px-3 py-2 rounded-xl text-xs font-medium transition ${filterStatus === s ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 3: Context filter — horizontal scroll, no scrollbar ── */}
      {/* WHY: Previously context pills wrapped onto a new line when there were many projects.
          This causes the kanban board to shift down unexpectedly. A single scrollable row
          keeps the layout height fixed regardless of how many projects exist. */}
      {contexts.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          <button onClick={() => setFilterContext('Tous')}
            className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition ${filterContext === 'Tous' ? 'bg-[#F0A500] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#F0A500]'}`}>
            Tous les contextes
          </button>
          {contexts.map(c => (
            <button key={c.id} onClick={() => setFilterContext(c.name)}
              className={`flex-shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition ${filterContext === c.name ? 'bg-[#F0A500] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#F0A500]'}`}>
              {c.name}
            </button>
          ))}
        </div>
      )}

      {/* ── Kanban / List ── */}
      {loading ? (
        // Match the loading.tsx skeleton exactly so there's no visual flash between the two
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {(['#94a3b8','#1E5F7A','#f87171','#4ade80']).map((accent, ci) => (
            <div key={ci} className="bg-[#F8FAFC] dark:bg-white/5 rounded-2xl p-3 min-h-[300px]"
              style={{ borderTop: `4px solid ${accent}` }}>
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className="h-3 w-20 rounded-lg bg-gray-200 dark:bg-white/10 animate-pulse" />
                <div className="h-4 w-6 rounded-full bg-gray-200 dark:bg-white/10 animate-pulse" />
              </div>
              <div className="space-y-2">
                {[1,2,3].map(i => (
                  <div key={i} className="bg-white dark:bg-[#161B22] rounded-xl p-3 relative overflow-hidden animate-pulse">
                    <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl bg-gray-200 dark:bg-white/10" />
                    <div className="pl-2 space-y-2">
                      <div className="h-4 w-3/4 rounded-lg bg-gray-200 dark:bg-white/10" />
                      <div className="h-3 w-1/2 rounded-lg bg-gray-100 dark:bg-white/5" />
                      <div className="h-3 w-24 rounded-lg bg-gray-100 dark:bg-white/5 mt-1" />
                      <div className="flex mt-2">
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 border-2 border-white dark:border-[#161B22]" />
                        <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-white/10 border-2 border-white dark:border-[#161B22] -ml-1.5" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

      ) : view === 'kanban' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {STATUSES.map(status => {
            const col = displayed.filter(t => t.status === status)
            const isDropTarget = dragOverCol === status
            return (
              <div key={status}
                onDragOver={e => onDragOver(e, status)}
                onDragLeave={onDragLeave}
                onDrop={() => onDrop(status)}
                // WHY: removed border-gray-200. Using inline borderTop so we can set exact accent color
                // per status. The column bg is slightly off-white (#F8FAFC) in light mode and
                // deep navy (#161B22) in dark — matches the "Apple Dark" elevation spec.
                className={`rounded-2xl p-3 min-h-[300px] transition-all duration-200 ${isDropTarget ? 'ring-2 ring-[#1E5F7A]/40 ring-inset' : ''}`}
                style={{
                  background: 'var(--col-bg, #F8FAFC)',
                  borderTop: `4px solid ${STATUS_ACCENT[status]}`,
                }}>
                {/* WHY: Column header shows status name in slightly bolder weight and count
                    inline next to it — no separate pill, cleaner read */}
                <div className="flex items-center gap-2 mb-3 px-1">
                  <span className="text-gray-700 dark:text-slate-300 text-xs font-bold">{status}</span>
                  <span className="text-gray-400 dark:text-slate-500 text-xs font-medium">{col.length}</span>
                </div>
                <div className="space-y-2">
                  {col.map(task => (
                    <div key={task.id}
                      draggable
                      onDragStart={() => onDragStart(task.id)}
                      onClick={() => openDetail(task)}
                      // WHY: no border on cards in light mode — replaced with diffuse shadow.
                      // In dark mode: 1px top border rgba(255,255,255,0.08) = "edge light" effect.
                      // On drag: opacity + scale down. On hover: teal glow.
                      className={`relative bg-white dark:bg-[#1a2235] rounded-xl p-3 cursor-grab active:cursor-grabbing transition-all duration-200 overflow-hidden
                        ${dragId === task.id ? 'opacity-40 scale-95' : ''}
                        ${isOverdue(task.due_date) && task.status !== '✅ Terminé' ? '' : ''}
                      `}
                      style={{
                        boxShadow: dragId === task.id ? 'none' :
                          '0 10px 15px -3px rgba(0,0,0,0.04), 0 4px 6px -2px rgba(0,0,0,0.02)',
                        borderTop: '1px solid rgba(255,255,255,0.08)',
                      }}
                      onMouseEnter={e => {
                        if (dragId) return
                        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 0 0 1px rgba(30,95,122,0.3), 0 10px 15px -3px rgba(0,0,0,0.06)'
                      }}
                      onMouseLeave={e => {
                        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 10px 15px -3px rgba(0,0,0,0.04), 0 4px 6px -2px rgba(0,0,0,0.02)'
                      }}
                    >
                      {/* WHY: Priority strip on left edge — 3px wide colored bar.
                          Much faster to scan priority at a glance vs a small dot in the corner. */}
                      <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                        style={{ background: PRIORITY_STRIP[task.priority] || '#94a3b8' }} />

                      {/* Overdue indicator */}
                      {isOverdue(task.due_date) && task.status !== '✅ Terminé' && (
                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-400" />
                      )}

                      <div className="pl-2">
                        <p className="text-gray-900 dark:text-white text-sm font-medium leading-snug pr-3">{task.title}</p>
                        {task.due_date && (
                          <p className={`text-xs mt-1 ${isOverdue(task.due_date) && task.status !== '✅ Terminé' ? 'text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>
                            📅 {new Date(task.due_date).toLocaleDateString('fr-MA')}
                          </p>
                        )}
                        {/* WHY: Stacked avatars — overlap by 6px, saves horizontal space,
                            more modern feel. Uses -ml-1.5 on all but first avatar. */}
                        {task.task_assignees?.length > 0 && (
                          <div className="flex mt-2">
                            {task.task_assignees.slice(0, 3).map((a, i) => (
                              <div key={a.user_id} style={{ zIndex: 3 - i }}
                                className="w-5 h-5 rounded-full border border-white dark:border-[#1E5F7A]/30 bg-[#1E5F7A]/20 overflow-hidden flex items-center justify-center -ml-1 first:ml-0">
                                {a.profiles?.avatar_url
                                  ? <img src={a.profiles.avatar_url} className="w-full h-full object-cover" alt={a.profiles.full_name} />
                                  : <span className="text-[#1E5F7A] dark:text-[#5bbcde] text-[8px] font-bold">{initials(a.profiles?.full_name || '?')}</span>
                                }
                              </div>
                            ))}
                            {task.task_assignees.length > 3 && (
                              <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-400 text-[10px] font-bold flex items-center justify-center border-2 border-white dark:border-[#1a2235]"
                                style={{ marginLeft: '-6px', zIndex: 0 }}>
                                +{task.task_assignees.length - 3}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {/* WHY: Ghost card instead of text — preserves column visual height
                      and signals "drop here" without text noise. */}
                  {col.length === 0 && (
                    <div className={`border-2 border-dashed rounded-xl p-4 text-center transition-colors duration-200
                      ${isDropTarget ? 'border-[#1E5F7A]/50 bg-[#1E5F7A]/5' : 'border-gray-200 dark:border-white/10'}`}
                      style={{ minHeight: '80px' }}>
                      <p className="text-gray-300 dark:text-slate-700 text-xs mt-4">Aucune tâche</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>

      ) : (
        // ─── List view ─────────────────────────────────────
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          {displayed.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-600 py-12">Aucune tâche</p>
          ) : displayed.map((task, i) => (
            <div key={task.id} onClick={() => openDetail(task)}
              className={`flex items-center gap-3 px-5 py-3.5 cursor-pointer hover:bg-gray-50 dark:hover:bg-white/5 transition ${i !== displayed.length - 1 ? 'border-b border-gray-100 dark:border-white/5' : ''}`}>
              {/* Priority strip as a small colored bar instead of dot */}
              <div className="w-[3px] h-8 rounded-full flex-shrink-0"
                style={{ background: PRIORITY_STRIP[task.priority] || '#94a3b8' }} />
              <p className="text-gray-900 dark:text-white text-sm font-medium flex-1 truncate">{task.title}</p>
              <span className="text-xs text-gray-400 dark:text-slate-500 hidden sm:block truncate max-w-[120px]">{task.context_name || task.context_type}</span>
              {task.due_date && (
                <span className={`text-xs hidden md:block flex-shrink-0 ${isOverdue(task.due_date) && task.status !== '✅ Terminé' ? 'text-red-400' : 'text-gray-400 dark:text-slate-600'}`}>
                  {new Date(task.due_date).toLocaleDateString('fr-MA')}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${
                task.status === '📋 À faire'  ? 'bg-slate-100  dark:bg-slate-500/20  text-slate-600  dark:text-slate-300' :
                task.status === '🔄 En cours' ? 'bg-blue-50    dark:bg-[#1E5F7A]/20  text-[#1E5F7A]  dark:text-[#5bbcde]' :
                task.status === '🚫 Bloqué'   ? 'bg-red-50     dark:bg-red-500/20    text-red-500    dark:text-red-400'   :
                                                'bg-green-50   dark:bg-green-500/20  text-green-600  dark:text-green-400'
              }`}>{task.status}</span>
            </div>
          ))}
        </div>
      )}

      {/* ── Detail Slide-Over ─────────────────────────────── */}
      {detail && (
        <div className="fixed inset-0 z-50 flex">
          <div className="flex-1 bg-black/40 backdrop-blur-sm" onClick={() => setDetail(null)} />
          <div className="w-full max-w-lg bg-white dark:bg-[#0e1628] border-l border-gray-200 dark:border-white/10 h-full flex flex-col animate-in slide-in-from-right duration-300">

            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10 flex-shrink-0">
              <h2 className="text-gray-900 dark:text-white font-bold truncate flex-1 mr-4">{detail.title}</h2>
              <div className="flex items-center gap-2 flex-shrink-0">
                {canManageTask(detail) && (
                  <>
                    <button onClick={() => {
                      if (editForm) {
                        setEditForm(null)
                        setEditAssigneeIds([])
                        setEditSecondaryContexts([])
                      } else {
                        setEditForm({ ...detail })
                        setEditContextId(detail.context_id)
                        setEditContextType(detail.context_type)
                        setEditAssigneeIds(detail.task_assignees?.map(a => a.user_id) || [])
                        // Restore secondary contexts
                        const secCtxs = detail.secondary_contexts || []
                        Promise.all(secCtxs.map(async sc => {
                          const members = await loadMembersForContext(sc.context_id, sc.context_type)
                          return { contextId: sc.context_id, contextType: sc.context_type, assigneeIds: [], members, search: '' }
                        })).then(setEditSecondaryContexts)
                      }
                    }} className="text-xs px-3 py-1.5 rounded-lg bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] hover:bg-[#1E5F7A]/20 transition font-medium">
                      {editForm ? 'Annuler' : 'Modifier'}
                    </button>
                    <button onClick={async () => {
                      setConfirm({
                        title: 'Archiver la tâche',
                        message: "Archiver cette tâche ? Elle n'apparaîtra plus dans la liste principale.",
                        onConfirm: async () => {
                          await updateTask(detail.id, { archived: true } as any)
                          setDetail(null); showToast('Tâche archivée.')
                        }
                      })
                    }} className="text-xs px-3 py-1.5 rounded-lg bg-[#F0A500]/10 text-[#F0A500] hover:bg-[#F0A500]/20 transition font-medium">
                      Archiver
                    </button>
                    <button onClick={() => deleteTask(detail.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition font-medium">
                      Supprimer
                    </button>
                  </>
                )}
                <button onClick={() => setDetail(null)}
                  className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition text-xl ml-1">×</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {editForm ? (
                <form onSubmit={saveEdit} className="p-6 space-y-4">
                  {/* Title */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Titre</label>
                    <input value={editForm.title || ''} onChange={e => setEditForm(f => ({ ...f, title: e.target.value }))} required
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                  </div>
                  {/* Description */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                    <textarea rows={3} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition resize-none" />
                  </div>
                  {/* Status + Priority */}
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
                  {/* Due date */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Échéance</label>
                    <input type="datetime-local" value={editForm.due_date?.slice(0, 16) || ''} onChange={e => setEditForm(f => ({ ...f, due_date: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition [color-scheme:light] dark:[color-scheme:dark]" />
                  </div>
                  {/* Context selector */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Contexte principal</label>
                    <select value={editContextId}
                      onChange={e => {
                        const ctx = contexts.find(c => c.id === e.target.value)
                        setEditContextId(e.target.value)
                        setEditContextType(ctx?.type || 'project')
                        setEditAssigneeIds([])
                      }}
                      className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                      {contexts.filter(c => c.type === 'project').length > 0 && (
                        <optgroup label="Projets">
                          {contexts.filter(c => c.type === 'project').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      )}
                      {contexts.filter(c => c.type === 'cellule').length > 0 && (
                        <optgroup label="Cellules">
                          {contexts.filter(c => c.type === 'cellule').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  {/* Primary context assignees */}
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">
                      Assignés — contexte principal {editAssigneeIds.length > 0 && <span className="ml-1 bg-[#1E5F7A] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{editAssigneeIds.length}</span>}
                    </label>
                    <input value={editMemberSearch} onChange={e => setEditMemberSearch(e.target.value)}
                      placeholder="Rechercher un membre…"
                      className="w-full mb-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                    <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
                      {editContextMembers.length === 0 ? (
                        <p className="text-gray-400 dark:text-slate-600 text-xs text-center py-2">Chargement…</p>
                      ) : editContextMembers
                          .filter(m => m.full_name.toLowerCase().includes(editMemberSearch.toLowerCase()))
                          .map(m => {
                            const selected = editAssigneeIds.includes(m.id)
                            return (
                              <button type="button" key={m.id}
                                onClick={() => setEditAssigneeIds(prev => selected ? prev.filter(i => i !== m.id) : [...prev, m.id])}
                                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl border transition text-left ${selected ? 'bg-[#1E5F7A]/10 border-[#1E5F7A]/40' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-[#1E5F7A]/40'}`}>
                                <div className="w-6 h-6 rounded-lg overflow-hidden bg-[#1E5F7A]/20 flex items-center justify-center flex-shrink-0">
                                  {(m as any).avatar_url
                                    ? <img src={(m as any).avatar_url} className="w-full h-full object-cover" alt={m.full_name} />
                                    : <span className="text-[#1E5F7A] dark:text-[#5bbcde] text-[9px] font-bold">{initials(m.full_name)}</span>
                                  }
                                </div>
                                <p className="text-gray-900 dark:text-white text-xs font-medium flex-1 truncate">{m.full_name}</p>
                                <span className={`text-[10px] font-semibold flex-shrink-0 ${m.labelColor}`}>{m.label}</span>
                              </button>
                            )
                          })}
                    </div>
                  </div>
                  {/* Secondary contexts in edit */}
                  {editSecondaryContexts.map((sc, idx) => (
                    <div key={idx} className="border border-[#1E5F7A]/20 rounded-xl p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <label className="text-xs text-gray-500 dark:text-slate-400 font-medium">Contexte secondaire {idx + 1}</label>
                        <button type="button" onClick={() => setEditSecondaryContexts(prev => prev.filter((_, i) => i !== idx))}
                          className="text-red-400 hover:text-red-500 text-xs transition">✕ Retirer</button>
                      </div>
                      <select value={sc.contextId}
                        onChange={async e => {
                          const selectedId = e.target.value   // capture before await
                          const ctx = contexts.find(c => c.id === selectedId)
                          const members = await loadMembersForContext(selectedId, ctx?.type || 'project')
                          setEditSecondaryContexts(prev => prev.map((s, i) => i === idx
                            ? { ...s, contextId: selectedId, contextType: ctx?.type || 'project', assigneeIds: [], members }
                            : s))
                        }}
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                        {contexts.filter(c => c.id !== editContextId && !editSecondaryContexts.some((s, i) => i !== idx && s.contextId === c.id)).map(c => (
                          <option key={c.id} value={c.id}>[{c.type === 'project' ? 'Projet' : 'Cellule'}] {c.name}</option>
                        ))}
                      </select>
                      <input value={sc.search} onChange={e => setEditSecondaryContexts(prev => prev.map((s, i) => i === idx ? { ...s, search: e.target.value } : s))}
                        placeholder="Rechercher…"
                        className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-1.5 text-xs text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition" />
                      <div className="flex justify-end">
                        <button type="button" onClick={() => setEditSecondaryContexts(prev => prev.map((s, i) => i === idx ? { ...s, assigneeIds: s.members.map(m => m.id) } : s))}
                          className="text-[10px] text-[#1E5F7A] dark:text-[#5bbcde] hover:underline">Tout sélectionner</button>
                      </div>
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {sc.members.filter(m => m.full_name.toLowerCase().includes(sc.search.toLowerCase())).map(m => {
                          const selected = sc.assigneeIds.includes(m.id)
                          return (
                            <button type="button" key={m.id}
                              onClick={() => setEditSecondaryContexts(prev => prev.map((s, i) => i === idx
                                ? { ...s, assigneeIds: selected ? s.assigneeIds.filter(id => id !== m.id) : [...s.assigneeIds, m.id] }
                                : s))}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left text-xs ${selected ? 'bg-[#1E5F7A]/10 border-[#1E5F7A]/40' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10'}`}>
                              <div className="w-5 h-5 rounded-lg overflow-hidden bg-[#1E5F7A]/20 flex items-center justify-center flex-shrink-0">
                                {(m as any).avatar_url
                                  ? <img src={(m as any).avatar_url} className="w-full h-full object-cover" alt={m.full_name} />
                                  : <span className="text-[#1E5F7A] text-[8px] font-bold">{initials(m.full_name)}</span>
                                }
                              </div>
                              <span className="flex-1 truncate text-gray-800 dark:text-slate-200">{m.full_name}</span>
                              {selected && <span className="text-[#1E5F7A] dark:text-[#5bbcde] text-[10px]">✓</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))}
                  {/* Add secondary context button */}
                  {editSecondaryContexts.length < 4 && contexts.length > editSecondaryContexts.length + 1 && (
                    <button type="button"
                      onClick={async () => {
                        const available = contexts.find(c => c.id !== editContextId && !editSecondaryContexts.some(s => s.contextId === c.id))
                        if (!available) return
                        const members = await loadMembersForContext(available.id, available.type)
                        setEditSecondaryContexts(prev => [...prev, { contextId: available.id, contextType: available.type, assigneeIds: [], members, search: '' }])
                      }}
                      className="w-full border-2 border-dashed border-[#1E5F7A]/30 text-[#1E5F7A] dark:text-[#5bbcde] text-xs py-2 rounded-xl hover:border-[#1E5F7A]/60 transition">
                      + Ajouter un contexte secondaire
                    </button>
                  )}
                  <button type="submit"
                    className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                    Enregistrer
                  </button>
                </form>

              ) : (
                <div className="p-6 space-y-5">

                  {/* ── Status + Priority badges ── */}
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

                  {/* ── Description ── */}
                  {detail.description && (
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-4 border border-gray-100 dark:border-white/5">
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Description</p>
                      <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed">{detail.description}</p>
                    </div>
                  )}

                  {/* ── Meta grid: Contexte + Échéance ── */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-gray-100 dark:border-white/5">
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Contexte</p>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs">{detail.context_type === 'project' ? '📁' : '🏛️'}</span>
                        <p className="text-gray-800 dark:text-slate-200 text-xs font-semibold truncate">{detail.context_name || detail.context_type}</p>
                      </div>
                    </div>
                    <div className="bg-gray-50 dark:bg-white/5 rounded-xl p-3 border border-gray-100 dark:border-white/5">
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 mb-1.5 font-semibold uppercase tracking-wider">Échéance</p>
                      {detail.due_date ? (
                        <p className={`text-xs font-semibold ${isOverdue(detail.due_date) && detail.status !== '✅ Terminé' ? 'text-red-400' : 'text-gray-800 dark:text-slate-200'}`}>
                          {new Date(detail.due_date).toLocaleDateString('fr-MA', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </p>
                      ) : (
                        <p className="text-gray-300 dark:text-slate-700 text-xs italic">Non définie</p>
                      )}
                    </div>
                  </div>

                  {/* ── Contextes secondaires ── */}
                  {detail.secondary_contexts && detail.secondary_contexts.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Contextes secondaires</p>
                      <div className="flex flex-wrap gap-1.5">
                        {detail.secondary_contexts.map(sc => (
                          <span key={sc.context_id} className="flex items-center gap-1 text-xs px-3 py-1 rounded-full bg-[#F0A500]/10 text-[#F0A500] border border-[#F0A500]/20 font-medium">
                            <span className="text-[10px] opacity-60">{sc.context_type === 'project' ? '📁' : '🏛️'}</span>
                            {sc.context_name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* ── Assignés — workload cards ── */}
                  {detail.task_assignees?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">
                        Assignés ({detail.task_assignees.length})
                      </p>
                      <div className="space-y-1.5">
                        {detail.task_assignees.map(a => {
                          const wl = editContextMembers.find(m => m.id === a.user_id)
                          const label      = !wl ? null
                            : wl.taskCount >= 6 ? 'Chargé 🔴'
                            : wl.taskCount >= 3 ? 'Modéré 🟡'
                            : 'Disponible 🟢'
                          const labelColor = !wl ? ''
                            : wl.taskCount >= 6 ? 'text-red-400'
                            : wl.taskCount >= 3 ? 'text-yellow-500'
                            : 'text-green-500'
                          return (
                            <div key={a.user_id}
                              className="flex items-center gap-3 px-3 py-2.5 bg-gray-50 dark:bg-white/5 rounded-xl border border-gray-100 dark:border-white/5">
                              <div className="w-7 h-7 rounded-lg overflow-hidden bg-[#1E5F7A]/20 flex items-center justify-center flex-shrink-0">
                                {a.profiles?.avatar_url
                                  ? <img src={a.profiles.avatar_url} className="w-full h-full object-cover" alt={a.profiles.full_name} />
                                  : <span className="text-[#1E5F7A] dark:text-[#5bbcde] text-[9px] font-bold">{initials(a.profiles?.full_name || '?')}</span>
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-gray-800 dark:text-slate-200 text-xs font-semibold truncate">{a.profiles?.full_name}</p>
                                {wl && (
                                  <p className="text-gray-400 dark:text-slate-500 text-[10px]">
                                    {wl.taskCount} tâche{wl.taskCount !== 1 ? 's' : ''} active{wl.taskCount !== 1 ? 's' : ''}
                                  </p>
                                )}
                              </div>
                              {label && <span className={`text-[10px] font-semibold flex-shrink-0 ${labelColor}`}>{label}</span>}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* ── Changer le statut ── */}
                  <div>
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Changer le statut</p>
                    <div className="grid grid-cols-2 gap-2">
                      {STATUSES.map(s => (
                        <button key={s} onClick={() => updateTask(detail.id, { status: s } as Partial<Task>)}
                          className={`text-xs px-3 py-2 rounded-xl transition font-medium text-center border ${
                            detail.status === s
                              ? 'bg-[#1E5F7A] border-[#1E5F7A] text-white shadow-sm'
                              : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-[#1E5F7A]/50 hover:text-[#1E5F7A] dark:hover:text-[#5bbcde]'
                          }`}>
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>

                </div>
              )}

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
                    className="bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-40 text-white text-xs px-3 rounded-xl transition">↑</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ── */}
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
                <select value={form.context_id}
                  onChange={e => {
                    const ctx = contexts.find(c => c.id === e.target.value)
                    setForm(f => ({ ...f, context_id: e.target.value, context_type: ctx?.type || 'project', assignee_ids: [] }))
                  }}
                  className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition">
                  {contexts.filter(c => c.type === 'project').length > 0 && (
                    <optgroup label="Projets">
                      {contexts.filter(c => c.type === 'project').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  )}
                  {contexts.filter(c => c.type === 'cellule').length > 0 && (
                    <optgroup label="Cellules">
                      {contexts.filter(c => c.type === 'cellule').map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </optgroup>
                  )}
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
                    className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition [color-scheme:light] dark:[color-scheme:dark]" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">
                Assigner à {form.assignee_ids.length > 0 && <span className="ml-1 bg-[#1E5F7A] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{form.assignee_ids.length}</span>}
              </label>
                {loadingMembers ? (
                  <div className="flex justify-center py-4">
                    <div className="w-5 h-5 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : contextMembers.length === 0 ? (
                  <p className="text-gray-400 dark:text-slate-600 text-xs text-center py-3">Aucun membre dans ce contexte</p>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {contextMembers.map(m => {
                      const selected = form.assignee_ids.includes(m.id)
                      return (
                        <button type="button" key={m.id}
                          onClick={() => setForm(f => ({
                            ...f,
                            assignee_ids: selected ? f.assignee_ids.filter(i => i !== m.id) : [...f.assignee_ids, m.id]
                          }))}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition text-left ${selected ? 'bg-[#1E5F7A]/10 border-[#1E5F7A]/40' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-[#1E5F7A]/40'}`}>
                          <div className="w-7 h-7 rounded-lg bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {m.full_name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-900 dark:text-white text-xs font-medium truncate">{m.full_name}</p>
                            <p className="text-gray-400 dark:text-slate-500 text-[10px]">{m.contextCount} contexte{m.contextCount !== 1 ? 's' : ''} · {m.taskCount} tâche{m.taskCount !== 1 ? 's' : ''} active{m.taskCount !== 1 ? 's' : ''}</p>
                          </div>
                          <span className={`text-[10px] font-semibold flex-shrink-0 ${m.labelColor}`}>{m.label}</span>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>
              {/* ── Contextes additionnels ── */}
              {contexts.filter(c => c.id !== form.context_id).length > 0 && (
                <div className="border-t border-gray-100 dark:border-white/10 pt-3 space-y-2">
                  <label className="block text-xs text-gray-600 dark:text-slate-400 font-medium">
                    Choisir des contextes secondaires à associer (optionnel)
                    {secondaryContexts.length > 0 && (
                      <span className="ml-2 bg-[#1E5F7A] text-white text-[10px] px-1.5 py-0.5 rounded-full font-bold">{secondaryContexts.length}</span>
                    )}
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {contexts.filter(c => c.id !== form.context_id).map(c => {
                      const isSelected = secondaryContexts.some(s => s.contextId === c.id)
                      return (
                        <button type="button" key={c.id}
                          onClick={async () => {
                            if (isSelected) {
                              setSecondaryContexts(prev => prev.filter(s => s.contextId !== c.id))
                            } else {
                              const members = await loadMembersForContext(c.id, c.type)
                              setSecondaryContexts(prev => [...prev, { contextId: c.id, contextType: c.type, assigneeIds: [], members, search: '' }])
                            }
                          }}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${
                            isSelected
                              ? 'bg-[#1E5F7A] text-white border-[#1E5F7A] shadow-sm'
                              : 'bg-white dark:bg-white/5 text-gray-500 dark:text-slate-400 border-gray-200 dark:border-white/10 hover:border-[#1E5F7A]/50'
                          }`}>
                          <span className="text-[10px] opacity-60">{c.type === 'project' ? '📁' : '🏛️'}</span>
                          {c.name}
                          {isSelected && <span className="opacity-70">✓</span>}
                        </button>
                      )
                    })}
                  </div>
                  {/* Merged assignee list for secondary contexts */}
                  {secondaryContexts.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <p className="text-[10px] text-gray-400 dark:text-slate-500 uppercase tracking-wider font-semibold">
                        Membres supplémentaires à assigner
                      </p>
                      {secondaryContexts.map((sc, idx) => {
                        const ctxName = contexts.find(c => c.id === sc.contextId)?.name || sc.contextId
                        const filtered = sc.members.filter(m =>
                          !form.assignee_ids.includes(m.id) &&
                          m.full_name.toLowerCase().includes(sc.search.toLowerCase())
                        )
                        if (sc.members.length === 0) return null
                        return (
                          <div key={sc.contextId} className="border border-[#1E5F7A]/15 rounded-xl p-2.5 space-y-1.5">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] text-[#1E5F7A] dark:text-[#5bbcde] font-semibold">{ctxName}</span>
                              <div className="flex items-center gap-2">
                                <button type="button"
                                  onClick={() => setSecondaryContexts(prev => prev.map((s, i) => i === idx ? { ...s, assigneeIds: s.members.map(m => m.id) } : s))}
                                  className="text-[10px] text-[#1E5F7A] dark:text-[#5bbcde] hover:underline">Tout</button>
                                <button type="button"
                                  onClick={() => setSecondaryContexts(prev => prev.map((s, i) => i === idx ? { ...s, assigneeIds: [] } : s))}
                                  className="text-[10px] text-gray-400 hover:underline">Aucun</button>
                              </div>
                            </div>
                            <input value={sc.search}
                              onChange={e => setSecondaryContexts(prev => prev.map((s, i) => i === idx ? { ...s, search: e.target.value } : s))}
                              placeholder="Chercher avec nom..."
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-2.5 py-1 text-xs focus:outline-none focus:border-[#1E5F7A] transition text-gray-900 dark:text-white" />
                            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                              {filtered.map(m => {
                                const sel = sc.assigneeIds.includes(m.id)
                                return (
                                  <button type="button" key={m.id}
                                    onClick={() => setSecondaryContexts(prev => prev.map((s, i) => i === idx
                                      ? { ...s, assigneeIds: sel ? s.assigneeIds.filter(id => id !== m.id) : [...s.assigneeIds, m.id] }
                                      : s))}
                                    className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition ${sel ? 'bg-[#1E5F7A]/10 border-[#1E5F7A]/40 text-[#1E5F7A] dark:text-[#5bbcde]' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-[#1E5F7A]/40'}`}>
                                    {sel && <span className="text-[8px]">✓</span>}
                                    {m.full_name.split(' ')[0]}
                                  </button>
                                )
                              })}
                              {filtered.length === 0 && <p className="text-[10px] text-gray-400">Aucun membre additionnel</p>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}
              <label className="flex items-center gap-3 cursor-pointer py-1">
                <div onClick={() => setKeepCreating(k => !k)}
                  className={`w-9 h-5 rounded-full transition-colors duration-200 relative flex-shrink-0 ${keepCreating ? 'bg-[#1E5F7A]' : 'bg-gray-200 dark:bg-white/10'}`}>
                  <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${keepCreating ? 'left-4' : 'left-0.5'}`} />
                </div>
                <span className="text-xs text-gray-500 dark:text-slate-400">Plus de tâches (créer en continu)</span>
              </label>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setShowCreate(false)}
                  className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit" disabled={creating}
                  className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98] flex items-center justify-center gap-2">
                  {creating ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Création…</> : 'Créer la tâche'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}