'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Profile {
  full_name: string
  username: string
  is_admin: boolean
  last_login: string | null
}

interface Task { id: string; title: string; status: string; priority: string; due_date: string | null }
interface Project { id: string; name: string; status: string }
interface Event { id: string; title: string; type: string; start_at: string; location: string | null }
interface Notification { id: string; message: string; status: string }
interface Proposal { id: string; title: string; proposed_at: string; type: string }

const statusColor: Record<string, string> = {
  '📋 À faire':   'bg-slate-500/20 text-slate-300',
  '🔄 En cours':  'bg-[#1E5F7A]/20 text-[#5bbcde]',
  '🚫 Bloqué':    'bg-red-500/20 text-red-400',
  '✅ Terminé':   'bg-green-500/20 text-green-400',
}

const priorityColor: Record<string, string> = {
  '🔴 Urgent': 'text-red-400',
  '🟠 Élevé':  'text-orange-400',
  '🟡 Moyen':  'text-yellow-400',
  '🟢 Faible': 'text-green-400',
}

function Widget({ title, children, className = '' }: { title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 ${className}`}>
      <h3 className="text-gray-900 dark:text-white font-semibold text-sm mb-4">{title}</h3>
      {children}
    </div>
  )
}

export default function DashboardPage() {
  const supabase = createClient()

  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [tasks,         setTasks]         = useState<Task[]>([])
  const [projects,      setProjects]      = useState<Project[]>([])
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
        supabase.from('notifications').select('*').eq('recipient_id', user.id).eq('status', 'Non lu').limit(5),
        supabase.from('events').select('*').gte('start_at', new Date().toISOString()).order('start_at').limit(5),
        supabase.from('project_proposals').select('*').eq('status', 'En attente').order('proposed_at', { ascending: false }).limit(5),
      ])

      if (profileRes.data) setProfile(profileRes.data)
      if (notifsRes.data)  setNotifications(notifsRes.data)
      if (eventsRes.data)  setEvents(eventsRes.data)
      if (proposalsRes.data && profileRes.data?.is_admin) setProposals(proposalsRes.data)

      // Tasks assigned to user
      const { data: assigneeRows } = await supabase
        .from('task_assignees')
        .select('task_id')
        .eq('user_id', user.id)

      if (assigneeRows && assigneeRows.length > 0) {
        const taskIds = assigneeRows.map(r => r.task_id)
        const { data: taskData } = await supabase
          .from('tasks')
          .select('*')
          .in('id', taskIds)
          .neq('status', '✅ Terminé')
          .order('due_date', { ascending: true })
          .limit(5)
        if (taskData) setTasks(taskData)
      }

      // Projects user is member of
      const { data: memberRows } = await supabase
        .from('project_members')
        .select('project_id')
        .eq('user_id', user.id)

      if (memberRows && memberRows.length > 0) {
        const projIds = memberRows.map(r => r.project_id)
        const { data: projData } = await supabase
          .from('projects')
          .select('*')
          .in('id', projIds)
          .limit(6)
        if (projData) setProjects(projData)
      }

      setLoading(false)
    }
    load()
  }, [])

  const taskStats = {
    todo:        tasks.filter(t => t.status === '📋 À faire').length,
    in_progress: tasks.filter(t => t.status === '🔄 En cours').length,
    blocked:     tasks.filter(t => t.status === '🚫 Bloqué').length,
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#1E5F7A]/20 to-gray-50 dark:from-[#1E5F7A]/30 dark:to-[#0a0f1e] border border-[#1E5F7A]/30 rounded-2xl p-6 flex items-center justify-between">
        <div>
          <p className="text-gray-500 dark:text-slate-400 text-sm">Bienvenue,</p>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold mt-0.5">{profile?.full_name}</h1>
          <p className="text-gray-400 dark:text-slate-500 text-xs mt-1">@{profile?.username}</p>
        </div>
        <div className="text-right hidden sm:block">
          {profile?.is_admin && (
            <span className="bg-[#F0A500]/20 text-[#F0A500] text-xs font-semibold px-3 py-1 rounded-full border border-[#F0A500]/20">
              Administrateur
            </span>
          )}
          <p className="text-slate-600 text-xs mt-2">
            {new Date().toLocaleDateString('fr-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Admin Stats Bar */}
      {profile?.is_admin && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Propositions en attente', value: proposals.length, color: 'text-[#F0A500]' },
            { label: 'Tâches bloquées',         value: taskStats.blocked, color: 'text-red-400'   },
            { label: 'Projets actifs',           value: projects.filter(p => p.status === 'Actif').length, color: 'text-[#5bbcde]' },
            { label: 'Événements à venir',       value: events.length,    color: 'text-green-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-4 text-center">
              <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
              <p className="text-gray-500 dark:text-slate-500 text-xs mt-1">{stat.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Masonry Grid */}
      <div className="columns-1 sm:columns-2 lg:columns-3 gap-4 space-y-4">

        {/* My Tasks */}
        <Widget title="🗂️ Mes tâches actives" className="break-inside-avoid">
          <div className="flex gap-2 mb-4">
            {[
              { label: 'À faire',   value: taskStats.todo,        color: 'bg-slate-500/20 text-slate-300' },
              { label: 'En cours',  value: taskStats.in_progress,  color: 'bg-[#1E5F7A]/20 text-[#5bbcde]' },
              { label: 'Bloqué',    value: taskStats.blocked,      color: 'bg-red-500/20 text-red-400'    },
            ].map(s => (
              <div key={s.label} className={`flex-1 rounded-xl px-2 py-2 text-center ${s.color}`}>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-xs">{s.label}</p>
              </div>
            ))}
          </div>
          <div className="space-y-2">
            {tasks.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-2">Aucune tâche active</p>
            ) : tasks.map(task => (
              <div key={task.id} className="flex items-start gap-2 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer">
                <span className={`text-xs mt-0.5 ${priorityColor[task.priority] || 'text-slate-400'}`}>●</span>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 dark:text-slate-200 text-sm truncate">{task.title}</p>
                  {task.due_date && (
                    <p className="text-slate-600 text-xs mt-0.5">
                      Échéance: {new Date(task.due_date).toLocaleDateString('fr-MA')}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-lg flex-shrink-0 ${statusColor[task.status] || ''}`}>
                  {task.status.split(' ')[0]}
                </span>
              </div>
            ))}
          </div>
        </Widget>

        {/* Upcoming Events */}
        <Widget title="📅 Événements à venir" className="break-inside-avoid">
          <div className="space-y-2">
            {events.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-2">Aucun événement prévu</p>
            ) : events.map(event => (
              <div key={event.id} className="flex gap-3 p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition cursor-pointer">
                <div className="bg-[#1E5F7A]/20 rounded-lg p-2 flex-shrink-0 text-center min-w-[44px]">
                  <p className="text-[#5bbcde] text-xs font-bold">
                    {new Date(event.start_at).toLocaleDateString('fr-MA', { day: '2-digit' })}
                  </p>
                  <p className="text-slate-500 text-[10px]">
                    {new Date(event.start_at).toLocaleDateString('fr-MA', { month: 'short' })}
                  </p>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-slate-200 text-sm truncate">{event.title}</p>
                  <p className="text-slate-500 text-xs mt-0.5 truncate">
                    {event.type}{event.location ? ` · ${event.location}` : ''}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Widget>

        {/* My Projects */}
        <Widget title="📁 Mes projets" className="break-inside-avoid">
          <div className="space-y-2">
            {projects.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-2">Aucun projet</p>
            ) : projects.map(project => (
              <div key={project.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer">
                <div className="w-8 h-8 rounded-lg bg-[#1E5F7A]/30 flex items-center justify-center text-sm flex-shrink-0">
                  📁
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-gray-800 dark:text-slate-200 text-sm truncate">{project.name}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded-lg flex-shrink-0 ${
                  project.status === 'Actif'    ? 'bg-green-500/20 text-green-400'   :
                  project.status === 'En pause' ? 'bg-yellow-500/20 text-yellow-400' :
                  project.status === 'Bloqué'   ? 'bg-red-500/20 text-red-400'       :
                  'bg-slate-500/20 text-slate-400'
                }`}>
                  {project.status}
                </span>
              </div>
            ))}
          </div>
        </Widget>

        {/* Notifications */}
        <Widget title="🔔 Notifications récentes" className="break-inside-avoid">
          <div className="space-y-2">
            {notifications.length === 0 ? (
              <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-2">Aucune notification</p>
            ) : notifications.map(n => (
              <div key={n.id} className="flex gap-2 p-2.5 rounded-xl bg-[#1E5F7A]/10 border border-[#1E5F7A]/20">
                <span className="text-sm flex-shrink-0">🔔</span>
                <p className="text-slate-300 text-xs leading-relaxed">{n.message}</p>
              </div>
            ))}
          </div>
        </Widget>

        {/* Admin: Pending Proposals */}
        {profile?.is_admin && (
          <Widget title="💡 Propositions en attente" className="break-inside-avoid">
            <div className="space-y-2">
              {proposals.length === 0 ? (
                <p className="text-gray-400 dark:text-slate-600 text-sm text-center py-2">Aucune proposition</p>
              ) : proposals.map(p => (
                <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-xl bg-gray-50 dark:bg-white/5 hover:bg-gray-100 dark:hover:bg-white/10 transition cursor-pointer">
                  <div className="flex-1 min-w-0">
                    <p className="text-slate-200 text-sm truncate">{p.title}</p>
                    <p className="text-slate-500 text-xs mt-0.5">
                      {p.type} · {new Date(p.proposed_at).toLocaleDateString('fr-MA')}
                    </p>
                  </div>
                  <div className="flex gap-1.5 flex-shrink-0">
                    <button className="w-7 h-7 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition text-xs">✓</button>
                    <button className="w-7 h-7 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
          </Widget>
        )}

      </div>
    </div>
  )
}