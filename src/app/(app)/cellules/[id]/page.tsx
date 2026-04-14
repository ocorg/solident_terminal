'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast, ToastStyle } from '@/hooks/useToast'
import ConfirmModal from '@/components/ConfirmModal'

interface Position { id: string; position_name: string }
interface Member   { id: string; user_id: string; profiles: { id: string; full_name: string; username: string }; cellule_positions: Position }
interface Task     { id: string; title: string; status: string; priority: string; due_date: string | null }
interface Cellule  {
  id: string; name: string; description: string | null
  cellule_members: Member[]; cellule_positions: Position[]
  tasks: Task[]
}
interface Profile { id: string; full_name: string; username: string }

const TABS = ['Vue d\'ensemble', 'Tâches', 'Membres', 'Positions', 'Santé']

const PRIORITY_DOT: Record<string, string> = {
  '🔴 Urgent': 'bg-red-400', '🟠 Élevé': 'bg-orange-400',
  '🟡 Moyen':  'bg-yellow-400', '🟢 Faible': 'bg-green-400',
}

export default function CelluleDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router   = useRouter()
  const supabase = createClient()
  const { toast, toastLeaving, showToast } = useToast()

  const [cellule,     setCellule]     = useState<Cellule | null>(null)
  const [loading,     setLoading]     = useState(true)
  const [tab,         setTab]         = useState(0)
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [allProfiles, setAllProfiles] = useState<Profile[]>([])
  const [confirm,     setConfirm]     = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const [editMode, setEditMode] = useState(false)
  const [editForm, setEditForm] = useState<Partial<Cellule>>({})

  const [addMemberUserId,   setAddMemberUserId]   = useState('')
  const [addMemberPosition, setAddMemberPosition] = useState('')
  const [addingMember,      setAddingMember]      = useState(false)

  const [showAddTask,     setShowAddTask]     = useState(false)
  const [taskForm,        setTaskForm]        = useState({ title: '', description: '', priority: '🟡 Moyen', due_date: '', assignee_ids: [] as string[] })
  const [addingTask,      setAddingTask]      = useState(false)
  const [memberWorkloads, setMemberWorkloads] = useState<Record<string, { taskCount: number; contextCount: number }>>({})
  const [newPositionName, setNewPositionName] = useState('')
  const [addingPosition,  setAddingPosition]  = useState(false)

  async function loadCellule() {
    const res = await fetch(`/api/cellules/${id}`)
    const data = await res.json()
    if (res.ok) { setCellule(data); setEditForm(data) }
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      setIsAdmin(!!profile?.is_admin)
      const { data: profiles } = await supabase.from('profiles').select('id, full_name, username')
      if (profiles) setAllProfiles(profiles)
    }
    init()
    loadCellule()
  }, [id])

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault()
    const res = await fetch(`/api/cellules/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: editForm.name, description: editForm.description }),
    })
    const data = await res.json()
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Cellule mise à jour !')
    setEditMode(false)
    loadCellule()
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault()
    setAddingMember(true)
    const res = await fetch(`/api/cellules/${id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: addMemberUserId, position_id: addMemberPosition }),
    })
    const data = await res.json()
    setAddingMember(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Membre ajouté !')
    setAddMemberUserId(''); setAddMemberPosition('')
    loadCellule()
  }

  async function openAddTask() {
    setShowAddTask(true)
    const memberIds = cellule?.cellule_members.map(m => m.user_id) || []
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
        context_type: 'cellule',
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
    loadCellule()
  }


  async function addPosition(e: React.FormEvent) {
    e.preventDefault()
    setAddingPosition(true)
    const res = await fetch(`/api/cellules/${id}/positions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ position_name: newPositionName }),
    })
    const data = await res.json()
    setAddingPosition(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Position ajoutée !')
    setNewPositionName('')
    loadCellule()
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!cellule) return (
    <div className="text-center py-16 text-gray-400 dark:text-slate-600">Cellule introuvable</div>
  )

  const inputCls = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition"
  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const letters  = cellule.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
  const doneTasks  = cellule.tasks.filter(t => t.status === '✅ Terminé').length
  const totalTasks = cellule.tasks.length
  const progress   = totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0

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
        <button onClick={() => router.push('/cellules')}
          className="flex items-center gap-2 text-sm text-gray-500 dark:text-slate-400 hover:text-[#F0A500] transition mb-4 group">
          <span className="w-7 h-7 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-white/5 group-hover:bg-[#F0A500]/10 transition text-base">←</span>
          <span>Retour aux cellules</span>
        </button>

        <div className="flex items-start justify-between flex-wrap gap-3">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-[#F0A500]/20 flex items-center justify-center text-[#F0A500] font-bold text-lg flex-shrink-0">
              {letters}
            </div>
            <div>
              <h1 className="text-gray-900 dark:text-white text-2xl font-bold">{cellule.name}</h1>
              {cellule.description && (
                <p className="text-gray-500 dark:text-slate-400 text-sm mt-0.5">{cellule.description}</p>
              )}
            </div>
          </div>
          {isAdmin && (
            <div className="flex gap-2">
              <button onClick={() => setEditMode(!editMode)}
                className="text-xs px-4 py-2 rounded-xl bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] hover:bg-[#1E5F7A]/20 transition font-medium">
                {editMode ? 'Annuler' : '✏️ Modifier'}
              </button>
              <button onClick={() => setConfirm({
                title: 'Supprimer la cellule',
                message: `Êtes-vous sûr de vouloir supprimer "${cellule.name}" ? Cette action est irréversible.`,
                onConfirm: async () => {
                  const res = await fetch(`/api/cellules/${id}`, { method: 'DELETE' })
                  if (!res.ok) { showToast('Erreur lors de la suppression', false); return }
                  router.push('/cellules')
                }
              })}
                className="text-xs px-4 py-2 rounded-xl bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition font-medium">
                Supprimer
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Progress */}
      {totalTasks > 0 && (
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-slate-400 mb-2">
            <span>Progression des tâches</span>
            <span className="font-semibold text-[#F0A500]">{progress}%</span>
          </div>
          <div className="h-2 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-[#F0A500] rounded-full transition-all duration-500" style={{ width: `${progress}%` }} />
          </div>
          <p className="text-xs text-gray-400 dark:text-slate-600 mt-1">{doneTasks}/{totalTasks} tâches terminées</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-white/5 rounded-xl p-1">
        {TABS.filter(t => (t === 'Positions' || t === 'Santé') ? isAdmin : true).map(t => (
          <button key={t} onClick={() => setTab(TABS.indexOf(t))}
            className={`flex-1 px-4 py-2 rounded-lg text-xs font-medium transition ${tab === TABS.indexOf(t) ? 'bg-white dark:bg-[#1E5F7A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
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
              <button type="submit" className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold py-2.5 rounded-xl transition">
                Enregistrer
              </button>
            </form>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {[
                { label: 'Membres',     value: `${cellule.cellule_members.length}` },
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
          {isAdmin && (
            <div className="flex justify-end">
              <button onClick={openAddTask}
                className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
                <span className="text-lg leading-none">+</span> Nouvelle tâche
              </button>
            </div>
          )}
          <div className="space-y-2">
            {cellule.tasks.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-slate-600 py-12">Aucune tâche pour cette cellule</p>
            ) : cellule.tasks.map(task => (
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
                    <textarea rows={2} value={taskForm.description} onChange={e => setTaskForm(f => ({ ...f, description: e.target.value }))}
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
                      {[...(cellule.cellule_members || [])].sort((a, b) =>
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
                            <div className="w-7 h-7 rounded-lg bg-[#F0A500]/20 text-[#F0A500] text-[10px] font-bold flex items-center justify-center flex-shrink-0">{ini}</div>
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
                  <p className="text-xs text-gray-400 dark:text-slate-500">Contexte : <strong>{cellule.name}</strong> (cellule)</p>
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
          {isAdmin && (
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
                  {cellule.cellule_positions.map(p => <option key={p.id} value={p.id}>{p.position_name}</option>)}
                </select>
              </div>
              <button type="submit" disabled={addingMember}
                className="bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50">
                {addingMember ? '…' : '+ Ajouter'}
              </button>
            </form>
          )}
          <div className="space-y-2">
            {cellule.cellule_members.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-slate-600 py-8">Aucun membre</p>
            ) : cellule.cellule_members.map(m => (
              <div key={m.id} className="flex items-center gap-3 px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                <div className="w-9 h-9 rounded-xl bg-[#F0A500]/20 text-[#F0A500] text-xs font-bold flex items-center justify-center flex-shrink-0">
                  {initials(m.profiles?.full_name || '?')}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-900 dark:text-white text-sm font-medium truncate">{m.profiles?.full_name}</p>
                  <p className="text-gray-400 dark:text-slate-500 text-xs">@{m.profiles?.username}</p>
                </div>
                {isAdmin ? (
                  <select
                    defaultValue={m.cellule_positions?.id || ''}
                    onChange={async e => {
                      await fetch(`/api/cellules/${id}/members`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: m.user_id, position_id: e.target.value }),
                      })
                      showToast('Rôle mis à jour !')
                      loadCellule()
                    }}
                    className="text-xs bg-[#F0A500]/10 text-[#F0A500] px-2 py-1 rounded-lg font-medium border-0 focus:outline-none cursor-pointer">
                    {cellule.cellule_positions.map(p => (
                      <option key={p.id} value={p.id}>{p.position_name}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-xs bg-[#F0A500]/10 text-[#F0A500] px-3 py-1 rounded-lg font-medium">
                    {m.cellule_positions?.position_name}
                  </span>
                )}
                {isAdmin && (
                  <button onClick={() => setConfirm({
                    title: 'Retirer le membre',
                    message: `Retirer ${m.profiles?.full_name} de la cellule ?`,
                    onConfirm: async () => {
                      const res = await fetch(`/api/cellules/${id}/members`, {
                        method: 'DELETE',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ user_id: m.user_id }),
                      })
                      if (!res.ok) { showToast('Erreur', false); return }
                      showToast('Membre retiré.')
                      loadCellule()
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
      {tab === 3 && isAdmin && (
        <div className="space-y-4">
          <form onSubmit={addPosition} className="flex gap-3">
            <input value={newPositionName} onChange={e => setNewPositionName(e.target.value)}
              placeholder="Nom de la position (ex: Responsable Logistique)"
              className={`${inputCls} flex-1`} required />
            <button type="submit" disabled={addingPosition}
              className="bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition disabled:opacity-50 flex-shrink-0">
              {addingPosition ? '…' : '+ Ajouter'}
            </button>
          </form>
          <div className="space-y-2">
            {cellule.cellule_positions.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-slate-600 py-8">Aucune position définie</p>
            ) : cellule.cellule_positions.map(p => (
              <div key={p.id} className="flex items-center justify-between px-4 py-3 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                <span className="text-gray-900 dark:text-white text-sm font-medium">{p.position_name}</span>
                <button onClick={() => setConfirm({
                  title: 'Supprimer la position',
                  message: `Supprimer la position "${p.position_name}" ?`,
                  onConfirm: async () => {
                    const res = await fetch(`/api/cellules/${id}/positions`, {
                      method: 'DELETE',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ position_id: p.id }),
                    })
                    if (!res.ok) { showToast('Erreur', false); return }
                    showToast('Position supprimée.')
                    loadCellule()
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

      {/* Santé */}
      {tab === 4 && isAdmin && (() => {
        const overdueTasks = cellule.tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== '✅ Terminé').length
        const blockedTasks = cellule.tasks.filter(t => t.status === '🚫 Bloqué').length
        const inProgressTasks = cellule.tasks.filter(t => t.status === '🔄 En cours').length
        const healthScore = totalTasks === 0 ? 100 : Math.min(100, Math.max(0, Math.round(100 - (overdueTasks * 20) - (blockedTasks * 15) + (progress * 0.3))))
        const scoreColor = healthScore >= 70 ? 'text-green-500' : healthScore >= 40 ? 'text-yellow-500' : 'text-red-400'
        const scoreBg = healthScore >= 70 ? 'bg-green-500' : healthScore >= 40 ? 'bg-yellow-500' : 'bg-red-400'
        const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        return (
          <div className="space-y-4">
            <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-3">
                <p className="text-gray-500 dark:text-slate-400 text-sm font-medium">Score de santé global</p>
                <p className={`text-3xl font-bold ${scoreColor}`}>{healthScore}/100</p>
              </div>
              <div className="h-3 bg-gray-100 dark:bg-white/10 rounded-full overflow-hidden">
                <div className={`h-full ${scoreBg} rounded-full transition-all duration-700`} style={{ width: `${healthScore}%` }} />
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-600 mt-2">
                {healthScore >= 70 ? '✅ Cellule en bonne santé' : healthScore >= 40 ? '⚠️ Attention requise' : '🔴 Cellule en difficulté'}
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Tâches terminées', value: `${doneTasks}/${totalTasks}`, color: 'text-green-500' },
                { label: 'En retard',        value: overdueTasks,                 color: overdueTasks > 0 ? 'text-red-400' : 'text-green-500' },
                { label: 'Bloquées',         value: blockedTasks,                 color: blockedTasks > 0 ? 'text-red-400' : 'text-green-500' },
                { label: 'En cours',         value: inProgressTasks,              color: 'text-[#5bbcde]' },
              ].map(k => (
                <div key={k.label} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-center">
                  <p className={`text-2xl font-bold ${k.color}`}>{k.value}</p>
                  <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">{k.label}</p>
                </div>
              ))}
            </div>
            <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5">
              <p className="text-gray-900 dark:text-white text-sm font-semibold mb-3">Membres ({cellule.cellule_members.length})</p>
              <div className="space-y-2">
                {cellule.cellule_members.map(m => (
                  <div key={m.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5">
                    <div className="w-7 h-7 rounded-lg bg-[#F0A500]/20 text-[#F0A500] text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                      {initials(m.profiles?.full_name || '?')}
                    </div>
                    <p className="text-gray-800 dark:text-slate-200 text-sm flex-1 truncate">{m.profiles?.full_name}</p>
                    <span className="text-xs text-gray-400 dark:text-slate-500">{m.cellule_positions?.position_name}</span>
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