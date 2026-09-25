'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'

interface Profile { full_name: string; username: string; is_admin: boolean; avatar_url?: string | null }
interface Task    { id: string; title: string; status: string; priority: string; due_date: string | null }
interface Project { id: string; name: string; status: string; image_url?: string | null }
interface Cellule { id: string; name: string; image_url?: string | null }
interface Event   { id: string; title: string; type: string; start_at: string; location: string | null }
interface Notification { id: string; message: string; status: string; created_at: string }
interface Proposal { id: string; title: string; proposed_at: string; type: string }

const priorityStrip: Record<string, string> = {
  '🔴 Urgent': '#ef4444', '🟠 Élevé': '#f97316',
  '🟡 Moyen':  '#eab308', '🟢 Faible': '#22c55e',
}

const statusBadge: Record<string, string> = {
  '📋 À faire':  'bg-slate-100 dark:bg-slate-500/20 text-slate-600 dark:text-slate-300',
  '🔄 En cours': 'bg-blue-50 dark:bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde]',
  '🚫 Bloqué':   'bg-red-50 dark:bg-red-500/20 text-red-500 dark:text-red-400',
  '✅ Terminé':  'bg-green-50 dark:bg-green-500/20 text-green-600 dark:text-green-400',
}

const projectStatus: Record<string, string> = {
  'Actif':    'bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-400',
  'En pause': 'bg-yellow-100 dark:bg-yellow-500/15 text-yellow-700 dark:text-yellow-400',
  'Bloqué':   'bg-red-100 dark:bg-red-500/15 text-red-600 dark:text-red-400',
  'Terminé':  'bg-gray-100 dark:bg-white/10 text-gray-500 dark:text-slate-400',
}

const eventTypeEmoji: Record<string, string> = {
  'Activité': '🏃', 'Action': '⚡', 'Réunion': '🗣️', 'Événement': '🎉', default: '📅'
}

function initials(name: string) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
}

function now() {
  return new Date().toLocaleDateString('fr-MA', { weekday: 'long', day: 'numeric', month: 'long' })
}

export default function DashboardPage() {
  const supabase = createClient()

  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [projects,      setProjects]      = useState<Project[]>([])
  const [cellules,      setCellules]      = useState<Cellule[]>([])
  const [events,        setEvents]        = useState<Event[]>([])
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [proposals,     setProposals]     = useState<Proposal[]>([])
  const [loading,       setLoading]       = useState(true)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [profileRes, notifsRes, eventsRes, proposalsRes] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).single(),
        supabase.from('notifications').select('*').eq('recipient_id', user.id).eq('status', 'Non lu').order('created_at', { ascending: false }).limit(5),
        supabase.from('events').select('*').gte('start_at', new Date().toISOString()).order('start_at').limit(5),
        supabase.from('project_proposals').select('*').eq('status', 'En attente').order('proposed_at', { ascending: false }).limit(5),
      ])

      const prof = profileRes.data
      if (prof) setProfile(prof)
      if (notifsRes.data) setNotifications(notifsRes.data)
      if (eventsRes.data) setEvents(eventsRes.data)
      if (proposalsRes.data && prof?.is_admin) setProposals(proposalsRes.data)

      const { data: assigneeRows } = await supabase.from('task_assignees').select('task_id').eq('user_id', user.id)
      if (assigneeRows?.length) {
        const { data: taskData } = await supabase
          .from('tasks').select('*').in('id', assigneeRows.map(r => r.task_id))
          .neq('status', '✅ Terminé').order('due_date', { ascending: true }).limit(8)
        if (taskData) setTasks(taskData)
      }

      const isAdmin = !!prof?.is_admin
      if (isAdmin) {
        const [{ data: allProj }, { data: allCel }] = await Promise.all([
          supabase.from('projects').select('id,name,status,image_url').neq('status', 'Terminé').order('name').limit(8),
          supabase.from('cellules').select('id,name,image_url').order('name').limit(8),
        ])
        if (allProj) setProjects(allProj)
        if (allCel)  setCellules(allCel)
      } else {
        const [{ data: pmRows }, { data: cmRows }] = await Promise.all([
          supabase.from('project_members').select('project_id').eq('user_id', user.id),
          supabase.from('cellule_members').select('cellule_id').eq('user_id', user.id),
        ])
        if (pmRows?.length) {
          const { data: projData } = await supabase.from('projects').select('id,name,status,image_url').in('id', pmRows.map(r => r.project_id)).limit(8)
          if (projData) setProjects(projData)
        }
        if (cmRows?.length) {
          const { data: celData } = await supabase.from('cellules').select('id,name,image_url').in('id', cmRows.map(r => r.cellule_id)).limit(8)
          if (celData) setCellules(celData)
        }
      }

      setLoading(false)
    }
    load()
  }, [])

  const todo       = tasks.filter(t => t.status === '📋 À faire').length
  const inProgress = tasks.filter(t => t.status === '🔄 En cours').length
  const blocked    = tasks.filter(t => t.status === '🚫 Bloqué').length
  const overdue    = tasks.filter(t => t.due_date && new Date(t.due_date) < new Date()).length

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-7xl mx-auto">

      {/* ── Welcome Banner ── */}
      <div className="relative overflow-hidden bg-gradient-to-br from-[#1E5F7A] via-[#1a5269] to-[#0f3344] rounded-2xl p-6">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-0 right-0 w-64 h-64 bg-white rounded-full -translate-y-1/2 translate-x-1/4" />
          <div className="absolute bottom-0 left-1/3 w-32 h-32 bg-[#F0A500] rounded-full translate-y-1/2" />
        </div>
        <div className="relative flex items-center gap-4">
          <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/20 border-2 border-white/30 flex items-center justify-center text-white text-xl font-bold flex-shrink-0 shadow-lg">
            {profile?.avatar_url
              ? <img src={profile.avatar_url} alt="avatar" className="w-full h-full object-cover" />
              : <span>{initials(profile?.full_name || 'U')}</span>
            }
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/60 text-sm capitalize">{now()}</p>
            <h1 className="text-white text-2xl font-bold mt-0.5 truncate">Bonjour, {profile?.full_name?.split(' ')[0]} 👋</h1>
            <p className="text-white/50 text-xs mt-0.5">@{profile?.username}</p>
          </div>
          {profile?.is_admin && (
            <span className="hidden sm:flex items-center gap-1.5 bg-[#F0A500]/25 text-[#F0A500] border border-[#F0A500]/30 text-xs font-semibold px-3 py-1.5 rounded-full flex-shrink-0">
              ⭐ Administrateur
            </span>
          )}
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'À faire',      value: todo,       color: 'text-slate-600 dark:text-slate-300',   bg: 'bg-slate-50 dark:bg-white/5',         icon: '📋' },
          { label: 'En cours',     value: inProgress, color: 'text-[#1E5F7A] dark:text-[#5bbcde]',  bg: 'bg-blue-50 dark:bg-[#1E5F7A]/10',     icon: '🔄' },
          { label: 'Bloquées',     value: blocked,    color: blocked > 0 ? 'text-red-500' : 'text-green-500',    bg: 'bg-red-50 dark:bg-red-500/10',        icon: '🚫' },
          { label: 'En retard',    value: overdue,    color: overdue > 0 ? 'text-orange-500' : 'text-green-500', bg: 'bg-orange-50 dark:bg-orange-500/10',  icon: '⏰' },
        ].map(s => (
          <div key={s.label} className={`${s.bg} border border-gray-200 dark:border-white/10 rounded-2xl p-4 flex items-center gap-3`}>
            <span className="text-2xl">{s.icon}</span>
            <div>
              <p className={`text-2xl font-bold leading-none ${s.color}`}>{s.value}</p>
              <p className="text-gray-500 dark:text-slate-500 text-xs mt-0.5">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* My Tasks */}
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">🗂️ Mes tâches actives</h3>
            <Link href="/tasks" className="text-[#1E5F7A] dark:text-[#5bbcde] text-xs hover:underline">Voir tout →</Link>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {tasks.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-6">Aucune tâche active ✅</p>
            ) : tasks.map(task => (
              <div key={task.id} className="relative flex items-center gap-3 pl-3 pr-4 py-3 bg-gray-50 dark:bg-white/5 rounded-xl overflow-hidden hover:bg-gray-100 dark:hover:bg-white/10 transition">
                <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl" style={{ background: priorityStrip[task.priority] || '#94a3b8' }} />
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 dark:text-slate-200 text-sm font-medium truncate">{task.title}</p>
                  {task.due_date && (
                    <p className={`text-xs mt-0.5 ${new Date(task.due_date) < new Date() ? 'text-red-400' : 'text-gray-400 dark:text-slate-500'}`}>
                      📅 {new Date(task.due_date).toLocaleDateString('fr-MA')}
                    </p>
                  )}
                </div>
                <span className={`text-[11px] px-2 py-1 rounded-lg flex-shrink-0 font-medium ${statusBadge[task.status] || ''}`}>
                  {task.status.replace(/^\S+\s/, '')}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Events */}
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">📅 Événements à venir</h3>
            <Link href="/events" className="text-[#1E5F7A] dark:text-[#5bbcde] text-xs hover:underline">Voir tout →</Link>
          </div>
          <div className="p-4 space-y-2 max-h-72 overflow-y-auto">
            {events.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-6">Aucun événement prévu</p>
            ) : events.map(event => {
              const d = new Date(event.start_at)
              return (
                <div key={event.id} className="flex gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition">
                  <div className="bg-[#1E5F7A]/15 dark:bg-[#1E5F7A]/25 rounded-xl p-2.5 flex-shrink-0 text-center w-12">
                    <p className="text-[#1E5F7A] dark:text-[#5bbcde] text-sm font-bold leading-none">{d.getDate()}</p>
                    <p className="text-gray-400 dark:text-slate-500 text-[10px] mt-0.5 uppercase">{d.toLocaleDateString('fr-MA', { month: 'short' })}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 dark:text-slate-200 text-sm font-medium truncate">{event.title}</p>
                    <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5 truncate">
                      {eventTypeEmoji[event.type] || '📅'} {event.type}{event.location ? ` · ${event.location}` : ''}
                    </p>
                  </div>
                  <p className="text-gray-300 dark:text-slate-600 text-[10px] flex-shrink-0 mt-0.5">
                    {d.toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── Projects + Cellules ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* My Projects */}
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">📁 Mes projets</h3>
            <Link href="/projects" className="text-[#1E5F7A] dark:text-[#5bbcde] text-xs hover:underline">Voir tout →</Link>
          </div>
          <div className="p-4">
            {projects.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-4">Aucun projet</p>
            ) : (
              <div className="space-y-2">
                {projects.map(p => (
                  <Link key={p.id} href={`/projects/${p.id}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition group">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#1E5F7A]/20 flex items-center justify-center text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex-shrink-0">
                      {p.image_url
                        ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" />
                        : initials(p.name)
                      }
                    </div>
                    <p className="text-gray-800 dark:text-slate-200 text-sm font-medium flex-1 truncate group-hover:text-[#1E5F7A] dark:group-hover:text-[#5bbcde] transition">{p.name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold flex-shrink-0 ${projectStatus[p.status] || ''}`}>{p.status}</span>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* My Cellules */}
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">🏛️ Mes cellules</h3>
            <Link href="/cellules" className="text-[#1E5F7A] dark:text-[#5bbcde] text-xs hover:underline">Voir tout →</Link>
          </div>
          <div className="p-4">
            {cellules.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-4">Aucune cellule</p>
            ) : (
              <div className="space-y-2">
                {cellules.map(c => (
                  <Link key={c.id} href={`/cellules/${c.id}`}
                    className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl hover:bg-gray-100 dark:hover:bg-white/10 transition group">
                    <div className="w-8 h-8 rounded-lg overflow-hidden bg-[#F0A500]/20 flex items-center justify-center text-[#F0A500] text-[10px] font-bold flex-shrink-0">
                      {c.image_url
                        ? <img src={c.image_url} alt={c.name} className="w-full h-full object-cover" />
                        : initials(c.name)
                      }
                    </div>
                    <p className="text-gray-800 dark:text-slate-200 text-sm font-medium flex-1 truncate group-hover:text-[#F0A500] transition">{c.name}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Admin Row ── */}
      {profile?.is_admin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

          {/* Pending Proposals */}
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
              <h3 className="text-gray-900 dark:text-white font-semibold text-sm">💡 Propositions en attente</h3>
              <Link href="/proposals" className="text-[#1E5F7A] dark:text-[#5bbcde] text-xs hover:underline">Gérer →</Link>
            </div>
            <div className="p-4 space-y-2">
              {proposals.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-4">Aucune proposition en attente ✅</p>
              ) : proposals.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-white/5 rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-800 dark:text-slate-200 text-sm font-medium truncate">{p.title}</p>
                    <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">
                      {p.type} · {new Date(p.proposed_at).toLocaleDateString('fr-MA')}
                    </p>
                  </div>
                  <Link href="/proposals"
                    className="text-xs px-3 py-1.5 bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] rounded-lg hover:bg-[#1E5F7A]/20 transition font-medium flex-shrink-0">
                    Traiter
                  </Link>
                </div>
              ))}
            </div>
          </div>

          {/* Recent Notifications */}
          <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 dark:border-white/5">
              <h3 className="text-gray-900 dark:text-white font-semibold text-sm">
                🔔 Notifications non lues
                {notifications.length > 0 && (
                  <span className="ml-2 bg-[#F0A500] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notifications.length}</span>
                )}
              </h3>
            </div>
            <div className="p-4 space-y-2 max-h-60 overflow-y-auto">
              {notifications.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-4">Aucune notification non lue ✅</p>
              ) : notifications.map(n => (
                <div key={n.id} className="flex gap-3 p-3 bg-[#1E5F7A]/5 dark:bg-[#1E5F7A]/10 border border-[#1E5F7A]/15 rounded-xl">
                  <span className="text-base flex-shrink-0">🔔</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-gray-700 dark:text-slate-300 text-xs leading-relaxed">{n.message}</p>
                    <p className="text-gray-400 dark:text-slate-600 text-[10px] mt-1">{new Date(n.created_at).toLocaleString('fr-MA')}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Non-admin: notifications */}
      {!profile?.is_admin && notifications.length > 0 && (
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 dark:border-white/5">
            <h3 className="text-gray-900 dark:text-white font-semibold text-sm">
              🔔 Notifications non lues
              <span className="ml-2 bg-[#F0A500] text-black text-[10px] font-bold px-1.5 py-0.5 rounded-full">{notifications.length}</span>
            </h3>
          </div>
          <div className="p-4 space-y-2">
            {notifications.map(n => (
              <div key={n.id} className="flex gap-3 p-3 bg-[#1E5F7A]/5 dark:bg-[#1E5F7A]/10 border border-[#1E5F7A]/15 rounded-xl">
                <span className="text-base flex-shrink-0">🔔</span>
                <p className="text-gray-700 dark:text-slate-300 text-xs leading-relaxed">{n.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}