'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast, ToastStyle } from '@/hooks/useToast'
import ConfirmModal from '@/components/ConfirmModal'

interface Position  { id: string; position_name: string }
interface Member    { id: string; user_id: string; profiles: { id: string; full_name: string; username: string }; project_positions: Position }
interface Task      { id: string; title: string; status: string; priority: string; due_date: string | null }
interface SubActivity { id: string; name: string; status: string; description: string | null }
interface Project {
  id: string; name: string; description: string | null; status: string
  start_date: string | null; end_date: string | null
  is_multi_activite: boolean; approval_status: string
  parent_project_id: string | null
  project_members: Member[]; project_positions: Position[]
  sub_activities: SubActivity[]; tasks: Task[]
}
interface Profile { id: string; full_name: string; username: string }

const TABS = ['Vue d\'ensemble', 'Tâches', 'Membres', 'Positions', 'Sous-activités', 'Santé']

const STATUS_STYLES: Record<string, string> = {
  'Actif':    'bg-green-50  dark:bg-green-500/20  text-green-600  dark:text-green-400  border border-green-200  dark:border-green-500/30',
  'En pause': 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-500/30',
  'Bloqué':   'bg-red-50    dark:bg-red-500/20    text-red-600    dark:text-red-400    border border-red-200    dark:border-red-500/30',
  'Terminé':  'bg-slate-50  dark:bg-slate-500/20  text-slate-600  dark:text-slate-400  border border-slate-200  dark:border-slate-500/30',
}

const PRIORITY_DOT: Record<string, string> = {
  '🔴 Urgent': 'bg-red-400', '🟠 Élevé': 'bg-orange-400',
  '🟡 Moyen':  'bg-yellow-400', '🟢 Faible': 'bg-green-400',
}

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router   = useRouter()
  const supabase = createClient()
  const { toast, toastLeaving, showToast } = useToast()

  const [project,     setProject]     = useState<Project | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState(0)
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [canManage,   setCanManage]   = useState(false)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [confirm,     setConfirm]     = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Project>>({})

  const [addMemberUserId,   setAddMemberUserId]   = useState('')
  const [addMemberPosition, setAddMemberPosition] = useState('')
  const [addingMember,      setAddingMember]      = useState(false)

  const [newPositionName, setNewPositionName] = useState('')
  const [addingPosition,  setAddingPosition]  = useState(false)
  const [parentMembers,   setParentMembers]   = useState<Member[]>([])
  const [showAddTask,   setShowAddTask]   = useState(false)
  const [taskForm,      setTaskForm]      = useState({ title: '', description: '', priority: '🟡 Moyen', due_date: '', assignee_ids: [] as string[] })
  const [addingTask,    setAddingTask]    = useState(false)
  const [memberWorkloads, setMemberWorkloads] = useState<Record<string, { taskCount: number; contextCount: number }>>({})
  const [showAddSub, setShowAddSub] = useState(false)
  const [subForm,    setSubForm]    = useState({ name: '', description: '', status: 'Actif' })
  const [addingSub,  setAddingSub]  = useState(false)

  async function loadProject() {
    const res = await fetch(`/api/projects/${id}`)
    const data = await res.json()
    if (res.ok) {
      setProject(data)
      setEditForm(data)
      // If this is a sub-activity, fetch parent project members for task assignment
      if (data.parent_project_id) {
        const parentRes = await fetch(`/api/projects/${data.parent_project_id}`)
        const parentData = await parentRes.json()
        if (parentRes.ok) setParentMembers(parentData.project_members || [])
      }
    }
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

      const { data: profiles } = await supabase.from('profiles').select('id, full_name, username')
      if (profiles) setAllProfiles(profiles)

      await loadProject()

      if (!admin) {
        const { data: positions } = await supabase
          .from('project_positions').select('id, position_name').eq('project_id', id)
        const { data: membership } = await supabase
          .from('project_members').select('position_id').eq('project_id', id).eq('user_id', user.id).single()
        const mgmtIds = new Set((positions || []).filter(p => !p.position_name.toLowerCase().includes('membre')).map(p => p.id))
        setCanManage(membership ? mgmtIds.has(membership.position_id) : false)
      } else {
        setCanManage(true)
      }
    }
    init()
  }, [id])

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name:              editForm.name,
        description:       editForm.description,
        status:            editForm.status,
        start_date:        editForm.start_date,
        end_date:          editForm.end_date,
        is_multi_activite: editForm.is_multi_activite,
      }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Projet mis à jour !')
    setEditMode(false)
    loadProject()
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    setAddingMember(true)
    const res = await fetch(`/api/projects/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: addMemberUserId, position_id: addMemberPosition }),
    })
    const data = await res.json()
    setAddingMember(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Membre ajouté !')
    setAddMemberUserId(''); setAddMemberPosition('')
    loadProject()
  }

  async function addPosition(e: React.FormEvent) {
    e.preventDefault()
    setAddingPosition(true)
    const res = await fetch(`/api/projects/${id}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position_name: newPositionName }),
    })
    const data = await res.json()
    setAddingPosition(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Position ajoutée !')
    setNewPositionName('')
    loadProject()
  }

  async function openAddTask() {
    setShowAddTask(true)
    // Sub-activities are limited to parent project's members
    const sourceMembers = (project?.parent_project_id && parentMembers.length > 0)
      ? parentMembers
      : (project?.project_members || [])
    const memberIds = sourceMembers.map(m => m.user_id)
    if (memberIds.length === 0) return
    const [{ data: assigneeRows }, { data: projRows }, { data: celRows }] = await Promise.all([
      supabase.from('task_assignees').select('user_id').in('user_id', memberIds),
      supabase.from('project_members').select('user_id').in('user_id', memberIds),
      supabase.from('cellule_members').select('user_id').in('user_id', memberIds),
    ])
    const taskCountMap: Record<string, number> = {}
    ;(assigneeRows || []).forEach((r: any) => { taskCountMap[r.user_id] = (taskCountMap[r.user_id] || 0) + 1 })
    const contextCountMap: Record<string, number> = {}
    ;[...(projRows || []), ...(celRows || [])].forEach((r: any) => { contextCountMap[r.user_id] = (contextCountMap[r.user_id] || 0) + 1 })
    const workloads: Record<string, { taskCount: number; contextCount: number }> = {}
    memberIds.forEach(id => { workloads[id] = { taskCount: taskCountMap[id] || 0, contextCount: contextCountMap[id] || 0 } })
    setMemberWorkloads(workloads)
  }

  async function addTask(e: React.FormEvent) {
    e.preventDefault()
    setAddingTask(true)
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title:        taskForm.title,
        description:  taskForm.description || null,
        priority:     taskForm.priority,
        due_date:     taskForm.due_date || null,
        context_type: 'project',
        context_id:   id,
        assignee_ids: taskForm.assignee_ids,
      }),
    })
    const data = await res.json()
    setAddingTask(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Tâche créée !')
    setShowAddTask(false)
    setTaskForm({ title: '', description: '', priority: '🟡 Moyen', due_date: '', assignee_ids: [] })
    loadProject()
  }


  async function addSubActivity(e: React.FormEvent) {
    e.preventDefault()
    setAddingSub(true)
    const res = await fetch('/api/projects', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...subForm, parent_project_id: id }),
    })
    const data = await res.json()
    setAddingSub(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Sous-activité créée !')
    setShowAddSub(false)
    setSubForm({ name: '', description: '', status: 'Actif' })
    loadProject()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!project) return (
    <div className="text-center py-16 text-gray-400 dark:text-slate-600">Projet introuvable</div>
  )

  const doneTasks  = project.tasks.filter(t => t.status === '✅ Terminé').length
  const totalTasks = project.tasks.length
  const progress   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

  const visibleTabs = TABS.filter(t => {
  if (t === 'Positions') return canManage || isAdmin
  if (t === 'Sous-activités') return project.is_multi_activite && (canManage || isAdmin)
  if (t === 'Santé') return canManage || isAdmin
  return true
  })

  const inputCls = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition"
  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const letters  = project.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {toast && (
        <div style={ToastStyle(toastLeaving)}
          className={`fixed top-6 left-0 right-0 mx-auto w-fit z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}>
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

      {/* Back + Header */}
      <div>
        <button onClick={() => router.push('/projects')}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-[#1E5F7A] dark:hover:text-[#5bbcde] transition mb-4 group">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 group-hover:bg-[#1E5F7A]/10 transition text-base">←</span>
          <span>Retour aux projets</span>
        </button>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#1E5F7A]/20 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] font-bold text-lg flex-shrink-0">
              {letters}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-gray-900 dark:text-white text-2xl font-bold">{project.name}</h1>
                <span className={`text-xs px-3 py-1 rounded-full font-medium ${STATUS_STYLES[project.status] || ''}`}>
                  {project.status}
                </span>
                {project.is_multi_activite && (
                  <span className="text-xs bg-purple-500/20 text-purple-500 dark:text-purple-400 px-3 py-1 rounded-full font-semibold border border-purple-500/20">
                    Multi-activité
                  </span>
                )}
              </div>
              {project.description && (
                <p className="text-gray-500 dark:text-slate-400 text-sm mt-1">{project.description}</p>
              )}
            </div>
          </div>

          {canManage && (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(!editMode)}
                className="text-xs px-4 py-2 rounded-xl bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] hover:bg-[#1E5F7A]/20 transition font-medium">
                {editMode ? 'Annuler' : '✏️ Modifier'}
              </button>
              {isAdmin && (
                <button onClick={() => setConfirm({
                  title: 'Supprimer le projet',
                  message: `Êtes-vous sûr de vouloir supprimer "${project.name}" ? Cette action est irréversible.`,
                  onConfirm: async () => {
                    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE' })
                    if (!res.ok) { showToast('Erreur lors de la suppression', false); return }
                    router.push('/projects')
                  }
                })}
                  className="text-xs px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition font-medium">
                  Supprimer
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {totalTasks > 0 && (
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
            <span>Progression des tâches</span>
            <span className="font-semibold text-[#1E5F7A]">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#1E5F7A] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">{doneTasks}/{totalTasks} tâches terminées</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1 flex-wrap">
        {visibleTabs.map(t => (
          <button key={t} onClick={() => setTab(TABS.indexOf(t))}
            className={`flex-1 min-w-fit px-4 py-2 rounded-lg text-xs font-medium transition ${tab === TABS.indexOf(t) ? 'bg-white dark:bg-[#1E5F7A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
            {t}
          </button>
        ))}
      </div>

      {/* Vue d'ensemble */}
      {tab === 0 && (
        <div className="space-y-4">
          {editMode ? (
            <form onSubmit={saveEdit} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-6 space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Nom</label>
                <input value={editForm.name || ''} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} className={inputCls} required />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                <textarea rows={3} value={editForm.description || ''} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Statut</label>
                  <select value={editForm.status || ''} onChange={e => setEditForm(f => ({ ...f, status: e.target.value }))} className={inputCls}>
                    {['Actif', 'En pause', 'Bloqué', 'Terminé'].map(s => <option key={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Date début</label>
                  <input type="date" value={editForm.start_date?.slice(0, 10) || ''} onChange={e => setEditForm(f => ({ ...f, start_date: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Date fin</label>
                <input type="date" value={editForm.end_date?.slice(0, 10) || ''} onChange={e => setEditForm(f => ({ ...f, end_date: e.target.value }))} className={inputCls} />
              </div>
              <button type="submit" className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold py-2.5 rounded-xl transition">
                Enregistrer
              </button>
            </form>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Statut',      value: project.status },
                { label: 'Membres',     value: `${project.project_members.length}` },
                { label: 'Tâches',      value: `${totalTasks}` },
                { label: 'Progression', value: `${progress}%` },
              ].map(s => (
                <div key={s.label} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-center">
                  <p className="text-gray-900 dark:text-white font-bold text-xl">{s.value}</p>
                  <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{s.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tâches */}
      {tab === 1 && (
        <div className="space-y-4">
          {canManage && (
            <div className="flex justify-end">
              <button onClick={openAddTask}
                className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
                <span className="text-lg leading-none">+</span> Nouvelle tâche
              </button>
            </div>
          )}
          <div className="space-y-2">
          {project.tasks.length === 0 ? (
            <p className="text-center text-gray-400 dark:text-slate-600 py-12">Aucune tâche pour ce projet</p>
          ) : project.tasks.map(task => (
            <div key={task.id} className="flex items-center gap-4 px-5 py-3.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${PRIORITY_DOT[task.priority] || 'bg-gray-400'}`} />
              <p className="text-gray-900 dark:text-white text-sm flex-1 truncate">{task.title}</p>
              {task.due_date && (
                <span className="text-xs text-gray-400 dark:text-slate-600 hidden sm:block">
                  {new Date(task.due_date).toLocaleDateString('fr-MA')}
                </span>
              )}
              <span className={`text-xs px-2 py-1 rounded-lg flex-shrink-0 ${
                task.status === '✅ Terminé'  ? 'bg-green-50 dark:bg-green-500/20 text-green-600 dark:text-green-400' :
                task.status === '🚫 Bloqué'   ? 'bg-red-50 dark:bg-red-500/20 text-red-500 dark:text-red-400' :
                task.status === '🔄 En cours' ? 'bg-blue-50 dark:bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde]' :
                'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300'
              }`}>{task.status}</span>
            </div>
          ))}
          </div>

          {showAddTask && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddTask(false)} />
              <div className="relative w-full max-w-md bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-900 dark:text-white font-bold text-lg">Nouvelle tâche</h2>
                  <button onClick={() => setShowAddTask(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition text-lg">×</button>
                </div>
                <form onSubmit={addTask} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Titre *</label>
                    <input required value={taskForm.title} onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
                      placeholder="Titre de la tâche" className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                    <textarea rows={3} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
                      placeholder="Description optionnelle..." className={`${inputCls} resize-none`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Priorité</label>
                      <select value={taskForm.priority} onChange={e => setTaskForm(f => ({ ...f, priority: e.target.value }))} className={inputCls}>
                        {['🔴 Urgent', '🟠 Élevé', '🟡 Moyen', '🟢 Faible'].map(p => <option key={p}>{p}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Échéance</label>
                      <input type="datetime-local" value={taskForm.due_date} onChange={e => setTaskForm(f => ({ ...f, due_date: e.target.value }))}
                        className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Assigner à</label>
                    <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                      {[...(project.parent_project_id && parentMembers.length > 0 ? parentMembers : project.project_members || [])].sort((a, b) =>
                        (memberWorkloads[a.user_id]?.taskCount || 0) - (memberWorkloads[b.user_id]?.taskCount || 0)
                      ).map(m => {
                        const selected = taskForm.assignee_ids.includes(m.user_id)
                        const wl = memberWorkloads[m.user_id] || { taskCount: 0, contextCount: 0 }
                        const label = wl.taskCount >= 6 ? 'Chargé 🔴' : wl.taskCount >= 3 ? 'Modéré 🟡' : 'Disponible 🟢'
                        const labelColor = wl.taskCount >= 6 ? 'text-red-400' : wl.taskCount >= 3 ? 'text-yellow-500' : 'text-green-500'
                        const ini = (m.profiles?.full_name || '?').split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
                        return (
                          <button type="button" key={m.user_id}
                            onClick={() => setTaskForm(f => ({
                              ...f,
                              assignee_ids: selected
                                ? f.assignee_ids.filter(i => i !== m.user_id)
                                : [...f.assignee_ids, m.user_id]
                            }))}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition text-left ${selected ? 'bg-[#1E5F7A]/10 border-[#1E5F7A]/40' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10 hover:border-[#1E5F7A]/40'}`}>
                            <div className="w-7 h-7 rounded-lg bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{ini}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-gray-900 dark:text-white text-xs font-medium truncate">{m.profiles?.full_name}</p>
                              <p className="text-gray-400 dark:text-slate-500 text-[10px]">{wl.contextCount} contexte{wl.contextCount !== 1 ? 's' : ''} · {wl.taskCount} tâche{wl.taskCount !== 1 ? 's' : ''} active{wl.taskCount !== 1 ? 's' : ''}</p>
                            </div>
                            <span className={`text-[10px] font-semibold flex-shrink-0 ${labelColor}`}>{label}</span>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-slate-500">Contexte : <strong>{project.name}</strong> (projet)</p>
                  <div className="flex gap-3 pt-2">
                    <button type="button" onClick={() => setShowAddTask(false)}
                      className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                      Annuler
                    </button>
                    <button type="submit" disabled={addingTask}
                      className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                      {addingTask ? 'Création…' : 'Créer la tâche'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Membres */}
      {tab === 2 && (
        <div className="space-y-4">
          {canManage && (
            <form onSubmit={addMember} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
              <div className="flex-1 min-w-40">
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Membre</label>
                <select value={addMemberUserId} onChange={e => setAddMemberUserId(e.target.value)} required className={inputCls}>
                  <option value="">Sélectionner…</option>
                  {allProfiles.map(p => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                </select>
              </div>
              <div className="flex-1 min-w-40">
                <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Position</label>
                <select value={addMemberPosition} onChange={e => setAddMemberPosition(e.target.value)} required className={inputCls}>
                  <option value="">Sélectionner…</option>
                  {project.project_positions.map(p => <option key={p.id} value={p.id}>{p.position_name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={addingMember}
                className="bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50">
                {addingMember ? '…' : '+ Ajouter'}
              </button>
            </form>
          )}
          <div className="space-y-2">
            {project.project_members.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-slate-600 py-8">Aucun membre</p>
            ) : project.project_members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {initials(m.profiles?.full_name || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{m.profiles?.full_name}</p>
                  <p className="text-gray-400 dark:text-slate-500 text-xs">@{m.profiles?.username}</p>
                </div>
                <span className="text-xs bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] px-3 py-1 rounded-lg font-medium">
                  {m.project_positions?.position_name}
                </span>
                {canManage && (
                  <button onClick={() => setConfirm({
                    title: 'Retirer le membre',
                    message: `Retirer ${m.profiles?.full_name} du projet ?`,
                    onConfirm: async () => {
                      const res = await fetch(`/api/projects/${id}/members`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: m.user_id }),
                      })
                      if (!res.ok) { showToast('Erreur', false); return }
                      showToast('Membre retiré.')
                      loadProject()
                    }
                  })}
                    className="text-xs text-red-400 hover:text-red-500 transition ml-1 w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Positions */}
      {tab === 3 && (canManage || isAdmin) && (
        <div className="space-y-4">
          <form onSubmit={addPosition} className="flex gap-3">
            <input value={newPositionName} onChange={e => setNewPositionName(e.target.value)}
              placeholder="Nom de la position (ex: Chef de Projet)"
              className={`${inputCls} flex-1`} required />
            <button type="submit" disabled={addingPosition}
              className="bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50 flex-shrink-0">
              {addingPosition ? '…' : '+ Ajouter'}
            </button>
          </form>
          <div className="space-y-2">
            {project.project_positions.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-slate-600 py-8">Aucune position définie</p>
            ) : project.project_positions.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                <span className="text-gray-900 dark:text-white text-sm font-medium">{p.position_name}</span>
                <button onClick={() => setConfirm({
                  title: 'Supprimer la position',
                  message: `Supprimer la position "${p.position_name}" ?`,
                  onConfirm: async () => {
                    const res = await fetch(`/api/projects/${id}/positions`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ position_id: p.id }),
                    })
                    if (!res.ok) { showToast('Erreur', false); return }
                    showToast('Position supprimée.')
                    loadProject()
                  }
                })}
                  className="text-xs text-red-400 hover:text-red-500 transition px-3 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-500/10">
                  Supprimer
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sous-activités */}
      {tab === 4 && project.is_multi_activite && (
        <div className="space-y-4">
          {canManage && (
            <button onClick={() => setShowAddSub(true)}
              className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30">
              + Nouvelle sous-activité
            </button>
          )}
          <div className="space-y-3">
            {project.sub_activities.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-slate-600 py-8">Aucune sous-activité</p>
            ) : project.sub_activities.map(sub => (
              <div key={sub.id} onClick={() => router.push(`/projects/${sub.id}`)}
                className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl cursor-pointer hover:border-[#1E5F7A]/50 transition">
                <div className="w-9 h-9 rounded-xl bg-[#1E5F7A]/10 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] font-bold text-sm">
                  {sub.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div className="flex-1">
                  <p className="text-gray-900 dark:text-white text-sm font-medium">{sub.name}</p>
                  {sub.description && <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">{sub.description}</p>}
                </div>
                <span className={`text-xs px-2 py-1 rounded-lg ${STATUS_STYLES[sub.status] || ''}`}>{sub.status}</span>
              </div>
            ))}
          </div>

          {showAddSub && (
            <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
              <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddSub(false)} />
              <div className="relative w-full max-w-md bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
                <div className="flex items-center justify-between mb-5">
                  <h2 className="text-gray-900 dark:text-white font-bold text-lg">Nouvelle sous-activité</h2>
                  <button onClick={() => setShowAddSub(false)}
                    className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition text-lg">×</button>
                </div>
                <form onSubmit={addSubActivity} className="space-y-4">
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Nom *</label>
                    <input required value={subForm.name} onChange={e => setSubForm(f => ({ ...f, name: e.target.value }))} className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                    <textarea rows={2} value={subForm.description} onChange={e => setSubForm(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} />
                  </div>
                  <div className="flex gap-3">
                    <button type="button" onClick={() => setShowAddSub(false)} className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm py-2.5 rounded-xl hover:bg-gray-200 transition">Annuler</button>
                    <button type="submit" disabled={addingSub} className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition">
                      {addingSub ? '…' : 'Créer'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Santé */}
      {tab === 5 && (canManage || isAdmin) && (() => {
        const overdueTasks = project.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== '✅ Terminé').length
        const blockedTasks = project.tasks.filter(t => t.status === '🚫 Bloqué').length
        const inProgressTasks = project.tasks.filter(t => t.status === '🔄 En cours').length
        const healthScore = totalTasks === 0 ? 100 : Math.max(0, Math.round(100 - (overdueTasks * 20) - (blockedTasks * 15) + (progress * 0.3)))
        const clampedScore = Math.min(100, healthScore)
        const scoreColor = clampedScore >= 70 ? 'text-green-500' : clampedScore >= 40 ? 'text-yellow-500' : 'text-red-400'
        const scoreBg = clampedScore >= 70 ? 'bg-green-500' : clampedScore >= 40 ? 'bg-yellow-500' : 'bg-red-400'
        return (
          <div className="space-y-4">
            {/* Score global */}
            <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Score de santé global</p>
                <p className={`text-3xl font-bold ${scoreColor}`}>{clampedScore}/100</p>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${scoreBg} rounded-full transition-all duration-700`} style={{ width: `${clampedScore}%` }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-600 mt-2">
                {clampedScore >= 70 ? '✅ Projet en bonne santé' : clampedScore >= 40 ? '⚠️ Attention requise' : '🔴 Projet en difficulté'}
              </p>
            </div>
            {/* KPI Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Tâches terminées',  value: `${doneTasks}/${totalTasks}`,  color: 'text-green-500' },
                { label: 'En retard',         value: overdueTasks,                  color: overdueTasks > 0 ? 'text-red-400' : 'text-green-500' },
                { label: 'Bloquées',          value: blockedTasks,                  color: blockedTasks > 0 ? 'text-red-400' : 'text-green-500' },
                { label: 'En cours',          value: inProgressTasks,               color: 'text-[#5bbcde]' },
              ].map(k => (
                <div key={k.label} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-center">
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{k.label}</p>
                </div>
              ))}
            </div>
            {/* Members workload */}
            <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5">
              <p className="text-gray-900 dark:text-white text-sm font-semibold mb-3">Charge des membres</p>
              <div className="space-y-2">
                {project.project_members.length === 0 ? (
                  <p className="text-gray-400 dark:text-slate-600 text-xs text-center py-4">Aucun membre</p>
                ) : project.project_members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                    <div className="w-7 h-7 rounded-lg bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {initials(m.profiles?.full_name || '?')}
                    </div>
                    <p className="text-gray-800 dark:text-slate-200 text-sm flex-1 truncate">{m.profiles?.full_name}</p>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{m.project_positions?.position_name}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      })()}

    </div>
  )
}