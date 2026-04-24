'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast, ToastStyle } from '@/hooks/useToast'
import ConfirmModal from '@/components/ConfirmModal'

// ─── Types ───────────────────────────────────────────────────
interface Attendee {
  user_id: string; rsvp_status: string
  profiles: { full_name: string }
}
interface Event {
  id: string; title: string; description: string | null
  type: string; context_type: string; visibility: string
  start_at: string; end_at: string | null; location: string | null
  created_by: string
  creator: { id: string; full_name: string; username: string } | null
  event_attendees: Attendee[]
}
interface Profile { id: string; full_name: string; username: string }

// ─── Constants ───────────────────────────────────────────────
const EVENT_TYPES   = ['Activité', 'Action', 'Réunion', 'Événement']
const CONTEXT_TYPES = ['global', 'project', 'cellule']
const RSVP_STYLES: Record<string, string> = {
  'Oui':        'bg-green-50  dark:bg-green-500/20  text-green-600  dark:text-green-400',
  'Non':        'bg-red-50    dark:bg-red-500/20    text-red-500    dark:text-red-400',
  'En attente': 'bg-yellow-50 dark:bg-yellow-500/20 text-yellow-600 dark:text-yellow-400',
}
const TYPE_ICONS: Record<string, string> = {
  'Activité': '🏃', 'Action': '⚡', 'Réunion': '🗣️', 'Événement': '🎉',
}
const MONTHS_FR = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre']

// ─── Calendar helpers ────────────────────────────────────────
function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate()
}
function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay()
}

export default function EventsPage() {
  const supabase = createClient()

  const [events,      setEvents]      = useState<Event[]>([])
  const [loading,     setLoading]     = useState(true)
  const [view,        setView]        = useState<'calendar' | 'list'>('calendar')
  const [detail,      setDetail]      = useState<Event | null>(null)
  const [showCreate,  setShowCreate]  = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [canCreate,   setCanCreate]   = useState(false)
  const [isAdmin,     setIsAdmin]     = useState(false)
  const [currentId,   setCurrentId]   = useState('')
  const [profiles,    setProfiles]    = useState<Profile[]>([])
  const [calYear,     setCalYear]     = useState(new Date().getFullYear())
  const [calMonth,    setCalMonth]    = useState(new Date().getMonth())
  const [filterType,  setFilterType]  = useState('Tous')
  const [search,      setSearch]      = useState('')
  const [inviteeSearch,       setInviteeSearch]       = useState('')
  const [contexts,            setContexts]            = useState<Array<{id: string; name: string; type: string}>>([])
  const [inviteContextId,     setInviteContextId]     = useState('')
  const [inviteContextType,   setInviteContextType]   = useState('project')
  const [inviteContextMembers,setInviteContextMembers]= useState<Array<{id: string; full_name: string; avatar_url?: string | null}>>([])
  const [inviteContextSearch, setInviteContextSearch] = useState('')
  const [editInviteeIds,      setEditInviteeIds]      = useState<string[]>([])
  // Same for edit form
  const [editInviteContextId,      setEditInviteContextId]      = useState('')
  const [editInviteContextType,    setEditInviteContextType]    = useState('project')
  const [editInviteContextMembers, setEditInviteContextMembers] = useState<Array<{id: string; full_name: string; avatar_url?: string | null}>>([])
  const [editInviteContextSearch,  setEditInviteContextSearch]  = useState('')
  const { toast, toastLeaving, showToast } = useToast()
  const [leaveConfirm, setLeaveConfirm] = useState<{ onConfirm: () => void } | null>(null)
  const [editEvent, setEditEvent] = useState<Partial<typeof form> | null>(null)
  const [savingEvent, setSavingEvent] = useState(false)
  const [confirm, setConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null)

  const [form, setForm] = useState({
    title: '', description: '', type: 'Réunion',
    context_type: 'global', context_id: '',
    start_at: '', end_at: '', location: '',
    visibility: 'Tous', invitee_ids: [] as string[],
  })

  function handleCloseCreate() {
    if (form.title) {
      setLeaveConfirm({ onConfirm: () => { setShowCreate(false); setLeaveConfirm(null) } })
      return
    }
    setShowCreate(false)
    setForm({ title: '', description: '', type: 'Réunion', context_type: 'global', context_id: '', start_at: '', end_at: '', location: '', visibility: 'Tous', invitee_ids: [] })
  }

  async function loadEvents() {
    const res = await fetch('/api/events')
    const data = await res.json()
    if (Array.isArray(data)) setEvents(data)
    setLoading(false)
  }

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCurrentId(user.id)

      const { data: profile } = await supabase
        .from('profiles').select('is_admin').eq('id', user.id).single()
      const admin = !!profile?.is_admin
      setIsAdmin(admin)
      if (admin) { setCanCreate(true) }
      else {
        const { data: pmRows } = await supabase
          .from('project_members').select('project_positions(position_name)').eq('user_id', user.id)
        const { data: cmRows } = await supabase
          .from('cellule_members').select('cellule_positions(position_name)').eq('user_id', user.id)
        const positions = [
          ...(pmRows || []).map((r: any) => r.project_positions?.position_name || ''),
          ...(cmRows || []).map((r: any) => r.cellule_positions?.position_name || ''),
        ]
        setCanCreate(positions.some(p => !p.toLowerCase().includes('membre')))
      }

      const { data: profs } = await supabase.from('profiles').select('id, full_name, username, avatar_url')
      if (profs) setProfiles(profs)

      const [{ data: projData }, { data: celData }] = await Promise.all([
        supabase.from('projects').select('id, name'),
        supabase.from('cellules').select('id, name'),
      ])
      setContexts([
        ...(projData || []).map(p => ({ id: p.id, name: p.name, type: 'project' })),
        ...(celData  || []).map(c => ({ id: c.id, name: c.name, type: 'cellule' })),
      ].sort((a, b) => {
        if (a.type !== b.type) return a.type === 'project' ? -1 : 1
        return a.name.localeCompare(b.name, 'fr')
      }))
    }
    init()
    loadEvents()
  }, [])

  async function loadEventContextMembers(contextId: string, contextType: string) {
    if (!contextId) return []
    let memberIds: string[] = []
    if (contextType === 'project') {
      const { data } = await supabase.from('project_members').select('user_id').eq('project_id', contextId)
      memberIds = (data || []).map(r => r.user_id)
    } else {
      const { data } = await supabase.from('cellule_members').select('user_id').eq('cellule_id', contextId)
      memberIds = (data || []).map(r => r.user_id)
    }
    if (memberIds.length === 0) return []
    const { data: profs } = await supabase.from('profiles').select('id, full_name, avatar_url').in('id', memberIds)
    return profs || []
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    const res = await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    })
    const data = await res.json()
    setSubmitting(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Événement créé !')
    setShowCreate(false)
    setForm({ title: '', description: '', type: 'Réunion', context_type: 'global', context_id: '', start_at: '', end_at: '', location: '', visibility: 'Tous', invitee_ids: [] })
    await loadEvents()
  }

  async function handleSaveEvent(e: React.FormEvent) {
    e.preventDefault()
    if (!detail || !editEvent) return
    setSavingEvent(true)
    const res = await fetch(`/api/events/${detail.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...editEvent,
        invitee_ids: editEvent.visibility === 'Invités seulement' ? editInviteeIds : [],
      }),
    })
    const data = await res.json()
    setSavingEvent(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Événement mis à jour !')
    setEditEvent(null)
    await loadEvents()
    setDetail(prev => prev ? { ...prev, ...data } : null)
  }

  async function handleRsvp(eventId: string, rsvp_status: string) {
    const res = await fetch(`/api/events/${eventId}/rsvp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rsvp_status }),
    })
    if (!res.ok) { showToast('Erreur RSVP', false); return }
    showToast(`RSVP: ${rsvp_status}`)
    loadEvents()
    if (detail?.id === eventId) {
      const updated = events.map(ev => {
        if (ev.id !== eventId) return ev
        const existing = ev.event_attendees.find(a => a.user_id === currentId)
        if (existing) {
          return { ...ev, event_attendees: ev.event_attendees.map(a => a.user_id === currentId ? { ...a, rsvp_status } : a) }
        }
        return { ...ev, event_attendees: [...ev.event_attendees, { user_id: currentId, rsvp_status, profiles: { full_name: '' } }] }
      })
      const updatedDetail = updated.find(ev => ev.id === eventId)
      if (updatedDetail) setDetail(updatedDetail)
    }
  }

  function handleDelete(id: string) {
    setConfirm({
      title: 'Supprimer l\'événement',
      message: 'Êtes-vous sûr de vouloir supprimer cet événement ?',
      onConfirm: async () => {
        const res = await fetch(`/api/events/${id}`, { method: 'DELETE' })
        if (!res.ok) { showToast('Erreur lors de la suppression', false); return }
        showToast('Événement supprimé.')
        if (detail?.id === id) setDetail(null)
        await loadEvents()
      }
    })
  }

  // ─── Filtered events ─────────────────────────────────────
  const displayed = events.filter(ev => {
    const matchType   = filterType === 'Tous' || ev.type === filterType
    const matchSearch = !search || ev.title.toLowerCase().includes(search.toLowerCase())
    return matchType && matchSearch
  })

  // ─── Calendar logic ──────────────────────────────────────
  const daysInMonth  = getDaysInMonth(calYear, calMonth)
  const firstDay     = (getFirstDayOfMonth(calYear, calMonth) + 6) % 7 // Mon=0
  const calendarDays = Array.from({ length: 42 }, (_, i) => {
    const day = i - firstDay + 1
    return day >= 1 && day <= daysInMonth ? day : null
  })

  function eventsOnDay(day: number) {
    return displayed.filter(ev => {
      const d = new Date(ev.start_at)
      return d.getFullYear() === calYear && d.getMonth() === calMonth && d.getDate() === day
    })
  }

  const inputCls = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition [color-scheme:light] dark:[color-scheme:dark]"
  const initials = (name: string) => name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <div className="space-y-6">

      {/* Toast */}
      {toast && (
        <div style={ToastStyle(toastLeaving)}
          className={`fixed top-6 left-0 right-0 mx-auto w-fit z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      {leaveConfirm && (
        <ConfirmModal
          title="Quitter le formulaire"
          message="Vos données seront perdues. Quitter quand même ?"
          confirmLabel="Quitter"
          danger
          onConfirm={leaveConfirm.onConfirm}
          onCancel={() => setLeaveConfirm(null)}
        />
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Événements</h1>
          <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">{events.length} événement{events.length !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1 gap-1">
            {(['calendar', 'list'] as const).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${view === v ? 'bg-white dark:bg-[#1E5F7A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
                {v === 'calendar' ? '📅 Calendrier' : '☰ Liste'}
              </button>
            ))}
          </div>
          {canCreate && (
            <button onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 bg-[#1E5F7A] hover:bg-[#2a7a9a] text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition shadow-lg shadow-[#1E5F7A]/30 active:scale-[0.98]">
              <span className="text-lg leading-none">+</span> Nouvel événement
            </button>
          )}
        </div>
      </div>

      {/* Search + Type filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">🔍</span>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Rechercher un événement..."
            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl text-sm text-gray-900 dark:text-white placeholder:text-gray-400 focus:outline-none focus:border-[#1E5F7A] transition" />
        </div>
        <div className="flex gap-2 flex-wrap">
          {['Tous', ...EVENT_TYPES].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              className={`px-3 py-2 rounded-xl text-xs font-medium transition ${filterType === t ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-500 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
              {t}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
        </div>

      /* ── Calendar View ── */
      ) : view === 'calendar' ? (
        <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
          {/* Month nav */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-white/10">
            <button onClick={() => { if (calMonth === 0) { setCalMonth(11); setCalYear(y => y - 1) } else setCalMonth(m => m - 1) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-slate-400 transition">‹</button>
            <h2 className="text-gray-900 dark:text-white font-semibold">{MONTHS_FR[calMonth]} {calYear}</h2>
            <button onClick={() => { if (calMonth === 11) { setCalMonth(0); setCalYear(y => y + 1) } else setCalMonth(m => m + 1) }}
              className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-white/10 text-gray-500 dark:text-slate-400 transition">›</button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 border-b border-gray-100 dark:border-white/10">
            {['Lun','Mar','Mer','Jeu','Ven','Sam','Dim'].map(d => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 dark:text-slate-500 py-2">{d}</div>
            ))}
          </div>

          {/* Days grid */}
          <div className="grid grid-cols-7">
            {calendarDays.map((day, i) => {
              const isToday = day === new Date().getDate() && calMonth === new Date().getMonth() && calYear === new Date().getFullYear()
              const dayEvents = day ? eventsOnDay(day) : []
              return (
                <div key={i} className={`min-h-[80px] p-1.5 border-b border-r border-gray-50 dark:border-white/5 ${!day ? 'bg-gray-50/50 dark:bg-white/[0.01]' : ''}`}>
                  {day && (
                    <>
                      <div className={`w-6 h-6 flex items-center justify-center text-xs font-medium rounded-full mb-1 ${isToday ? 'bg-[#1E5F7A] text-white' : 'text-gray-500 dark:text-slate-400'}`}>
                        {day}
                      </div>
                      <div className="space-y-0.5">
                        {dayEvents.slice(0, 3).map(ev => (
                          <div key={ev.id} onClick={() => setDetail(ev)}
                            className="text-[10px] px-1.5 py-0.5 rounded bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] truncate cursor-pointer hover:bg-[#1E5F7A]/20 transition">
                            {TYPE_ICONS[ev.type]} {ev.title}
                          </div>
                        ))}
                        {dayEvents.length > 3 && (
                          <div className="text-[10px] text-gray-400 dark:text-slate-600 px-1">+{dayEvents.length - 3}</div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>

      /* ── List View ── */
      ) : displayed.length === 0 ? (
        <div className="text-center py-16 text-gray-400 dark:text-slate-600">Aucun événement</div>
      ) : (
        <div className="space-y-3">
          {displayed.map(ev => {
            const myRsvp = ev.event_attendees.find(a => a.user_id === currentId)
            const isPast = new Date(ev.start_at) < new Date()
            return (
              <div key={ev.id} onClick={() => setDetail(ev)}
                className={`bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl p-5 cursor-pointer hover:border-[#1E5F7A]/50 hover:shadow-md transition-all duration-200 ${isPast ? 'opacity-60' : ''}`}>
                <div className="flex items-start gap-4">
                  {/* Date block */}
                  <div className="bg-[#1E5F7A]/10 rounded-xl p-2.5 text-center min-w-[52px] flex-shrink-0">
                    <p className="text-[#1E5F7A] dark:text-[#5bbcde] text-lg font-bold leading-none">
                      {new Date(ev.start_at).getDate()}
                    </p>
                    <p className="text-gray-400 dark:text-slate-500 text-[10px] mt-0.5 uppercase">
                      {MONTHS_FR[new Date(ev.start_at).getMonth()].slice(0, 3)}
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <span className="text-base">{TYPE_ICONS[ev.type]}</span>
                      <h3 className="text-gray-900 dark:text-white font-semibold text-sm truncate">{ev.title}</h3>
                      <span className="text-[10px] bg-gray-100 dark:bg-white/5 text-gray-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{ev.type}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-gray-400 dark:text-slate-500 flex-wrap">
                      <span>🕐 {new Date(ev.start_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}</span>
                      {ev.location && <span>📍 {ev.location}</span>}
                      <span>👥 {ev.event_attendees.length} participant{ev.event_attendees.length !== 1 ? 's' : ''}</span>
                    </div>
                  </div>
                  {myRsvp && (
                    <span className={`text-xs px-2 py-1 rounded-lg font-medium flex-shrink-0 ${RSVP_STYLES[myRsvp.rsvp_status] || ''}`}>
                      {myRsvp.rsvp_status}
                    </span>
                  )}
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
              <div className="flex items-center gap-2 flex-1 min-w-0 mr-4">
                <span className="text-xl flex-shrink-0">{TYPE_ICONS[detail.type]}</span>
                <h2 className="text-gray-900 dark:text-white font-bold truncate">{detail.title}</h2>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {(isAdmin || detail.created_by === currentId) && (
                  <>
                    <button onClick={() => {
                      if (editEvent) {
                        setEditEvent(null)
                        setEditInviteeIds([])
                        setEditInviteContextMembers([])
                        setEditInviteContextId('')
                      } else {
                        setEditEvent({
                          title: detail.title,
                          description: detail.description || '',
                          type: detail.type,
                          location: detail.location || '',
                          start_at: detail.start_at?.slice(0, 16),
                          end_at: detail.end_at?.slice(0, 16) || '',
                          visibility: detail.visibility,
                        })
                        if (detail.visibility === 'Invités seulement') {
                          setEditInviteeIds(detail.event_attendees.map(a => a.user_id))
                        }
                      }
                    }}
                      className="text-xs px-3 py-1.5 rounded-lg bg-[#1E5F7A]/10 text-[#1E5F7A] dark:text-[#5bbcde] hover:bg-[#1E5F7A]/20 transition">
                      {editEvent ? 'Annuler' : 'Modifier'}
                    </button>
                    <button onClick={() => handleDelete(detail.id)}
                      className="text-xs px-3 py-1.5 rounded-lg bg-red-50 dark:bg-red-500/10 text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 transition">
                      Supprimer
                    </button>
                  </>
                )}
                <button onClick={() => setDetail(null)} className="text-gray-400 hover:text-gray-900 dark:hover:text-white transition text-xl">×</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-5">

              {/* Edit form */}
              {editEvent && (
                <form onSubmit={handleSaveEvent} className="space-y-4 pb-4 border-b border-gray-100 dark:border-white/10">
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Titre</label>
                    <input value={editEvent.title || ''} onChange={e => setEditEvent(f => ({ ...f, title: e.target.value }))} required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                    <textarea rows={2} value={editEvent.description || ''} onChange={e => setEditEvent(f => ({ ...f, description: e.target.value }))} className={`${inputCls} resize-none`} />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Type</label>
                      <select value={editEvent.type || ''} onChange={e => setEditEvent(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                        {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Visibilité</label>
                      <select value={editEvent.visibility || 'Tous'}
                        onChange={e => {
                          setEditEvent(f => ({ ...f, visibility: e.target.value }))
                          if (e.target.value !== 'Invités seulement') {
                            setEditInviteeIds([])
                            setEditInviteContextMembers([])
                          } else {
                            setEditInviteeIds((detail?.event_attendees || []).map(a => a.user_id))
                          }
                        }}
                        className={inputCls}>
                        <option value="Tous">Tous</option>
                        <option value="Invités seulement">Invités seulement</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Début</label>
                      <input type="datetime-local" value={editEvent.start_at || ''} onChange={e => setEditEvent(f => ({ ...f, start_at: e.target.value }))} className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`} />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Fin</label>
                      <input type="datetime-local" value={editEvent.end_at || ''} onChange={e => setEditEvent(f => ({ ...f, end_at: e.target.value }))} className={`${inputCls} [color-scheme:light] dark:[color-scheme:dark]`} />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs text-gray-500 dark:text-slate-400 mb-1.5">Lieu</label>
                    <input value={editEvent.location || ''} onChange={e => setEditEvent(f => ({ ...f, location: e.target.value }))} className={inputCls} />
                  </div>
                  {/* Invitees for edit */}
                  {editEvent.visibility === 'Invités seulement' && (
                    <div className="space-y-3">
                      <label className="block text-xs text-gray-500 dark:text-slate-400">Invités ({editInviteeIds.length})</label>
                      {/* Context picker for bulk selection */}
                      <div className="border border-[#1E5F7A]/20 rounded-xl p-3 space-y-2">
                        <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wider">Inviter par contexte</p>
                        <select value={editInviteContextId}
                          onChange={async e => {
                            const ctx = contexts.find(c => c.id === e.target.value)
                            setEditInviteContextId(e.target.value)
                            setEditInviteContextType(ctx?.type || 'project')
                            setEditInviteContextMembers(await loadEventContextMembers(e.target.value, ctx?.type || 'project'))
                          }}
                          className={inputCls}>
                          <option value="">— Choisir un contexte —</option>
                          {contexts.filter(c => c.type === 'project').map(c => <option key={c.id} value={c.id}>[Projet] {c.name}</option>)}
                          {contexts.filter(c => c.type === 'cellule').map(c => <option key={c.id} value={c.id}>[Cellule] {c.name}</option>)}
                        </select>
                        {editInviteContextMembers.length > 0 && (
                          <>
                            <div className="flex justify-between items-center">
                              <span className="text-[10px] text-gray-400">{editInviteContextMembers.length} membres</span>
                              <button type="button"
                                onClick={() => setEditInviteeIds(prev => [...new Set([...prev, ...editInviteContextMembers.map(m => m.id)])])}
                                className="text-[10px] text-[#1E5F7A] dark:text-[#5bbcde] hover:underline font-semibold">Tout sélectionner</button>
                            </div>
                            <input value={editInviteContextSearch} onChange={e => setEditInviteContextSearch(e.target.value)}
                              placeholder="Rechercher dans ce contexte…"
                              className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#1E5F7A] transition text-gray-900 dark:text-white" />
                            <div className="space-y-1 max-h-32 overflow-y-auto">
                              {editInviteContextMembers.filter(m => m.full_name.toLowerCase().includes(editInviteContextSearch.toLowerCase())).map(m => {
                                const selected = editInviteeIds.includes(m.id)
                                return (
                                  <button type="button" key={m.id}
                                    onClick={() => setEditInviteeIds(prev => selected ? prev.filter(id => id !== m.id) : [...prev, m.id])}
                                    className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left text-xs ${selected ? 'bg-[#1E5F7A]/10 border-[#1E5F7A]/40' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10'}`}>
                                    <div className="w-5 h-5 rounded-full overflow-hidden bg-[#1E5F7A]/20 flex items-center justify-center flex-shrink-0">
                                      {m.avatar_url
                                        ? <img src={m.avatar_url} className="w-full h-full object-cover" alt={m.full_name} />
                                        : <span className="text-[#1E5F7A] text-[8px] font-bold">{m.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}</span>
                                      }
                                    </div>
                                    <span className="flex-1 truncate text-gray-800 dark:text-slate-200">{m.full_name}</span>
                                    {selected && <span className="text-[#1E5F7A] text-[10px]">✓</span>}
                                  </button>
                                )
                              })}
                            </div>
                          </>
                        )}
                      </div>
                      {/* Manual search from all profiles */}
                      <input value={inviteeSearch} onChange={e => setInviteeSearch(e.target.value)}
                        placeholder="Ou rechercher dans tous les membres…" className={inputCls} />
                      <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                        {profiles.filter(p => p.full_name.toLowerCase().includes(inviteeSearch.toLowerCase())).map(p => {
                          const selected = editInviteeIds.includes(p.id)
                          return (
                            <button type="button" key={p.id}
                              onClick={() => setEditInviteeIds(prev => selected ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                              className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${selected ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
                              {p.full_name}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  )}
                  <button type="submit" disabled={savingEvent}
                    className="w-full bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition flex items-center justify-center gap-2">
                    {savingEvent ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> Enregistrement…</> : 'Enregistrer'}
                  </button>
                </form>
              )}

              {/* Date/Time */}
              <div className="bg-[#1E5F7A]/10 rounded-2xl p-4">
                <div className="flex items-center gap-3">
                  <div className="text-center min-w-[48px]">
                    <p className="text-[#1E5F7A] dark:text-[#5bbcde] text-2xl font-bold">{new Date(detail.start_at).getDate()}</p>
                    <p className="text-gray-400 text-xs uppercase">{MONTHS_FR[new Date(detail.start_at).getMonth()]}</p>
                  </div>
                  <div className="flex-1">
                    <p className="text-gray-700 dark:text-slate-300 text-sm font-medium">
                      {new Date(detail.start_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}
                      {detail.end_at && ` → ${new Date(detail.end_at).toLocaleTimeString('fr-MA', { hour: '2-digit', minute: '2-digit' })}`}
                    </p>
                    {detail.location && <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">📍 {detail.location}</p>}
                  </div>
                </div>
              </div>

              {/* Description */}
              {detail.description && (
                <div>
                  <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-2 font-semibold">Description</p>
                  <p className="text-gray-700 dark:text-slate-300 text-sm leading-relaxed">{detail.description}</p>
                </div>
              )}

              {/* RSVP — only for invited attendees */}
              {(detail.event_attendees.some(a => a.user_id === currentId) || detail.visibility === 'Tous') && (
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 font-semibold">Votre réponse</p>
                <div className="flex gap-2">
                  {[
                    { label: '✅ Oui',          value: 'Oui',        cls: 'bg-green-50 dark:bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20 border border-green-200 dark:border-green-500/20' },
                    { label: '❌ Non',           value: 'Non',        cls: 'bg-red-50 dark:bg-red-500/10 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-500/20 border border-red-200 dark:border-red-500/20' },
                    { label: '⏳ En attente',   value: 'En attente', cls: 'bg-yellow-50 dark:bg-yellow-500/10 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-100 dark:hover:bg-yellow-500/20 border border-yellow-200 dark:border-yellow-500/20' },
                  ].map(opt => {
                    const myRsvp = detail.event_attendees.find(a => a.user_id === currentId)
                    const isSelected = myRsvp?.rsvp_status === opt.value
                    return (
                      <button key={opt.value}
                        onClick={() => handleRsvp(detail.id, opt.value)}
                        className={`flex-1 text-xs font-semibold py-2 rounded-xl transition ${opt.cls} ${isSelected ? 'ring-2 ring-offset-1 ring-current' : ''}`}>
                        {opt.label}
                      </button>
                    )
                  })}
                </div>
              </div>
              )}

              {/* Attendees */}
              <div>
                <p className="text-xs text-gray-400 dark:text-slate-500 uppercase tracking-wider mb-3 font-semibold">
                  Participants ({detail.event_attendees.length})
                </p>
                {detail.event_attendees.length === 0 ? (
                  <p className="text-gray-400 dark:text-slate-600 text-sm">Aucun participant enregistré</p>
                ) : (
                  <div className="space-y-2">
                    {detail.event_attendees.map((a, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-white/5 rounded-xl">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] text-[10px] font-bold flex items-center justify-center">
                            {initials(a.profiles?.full_name || '?')}
                          </div>
                          <span className="text-gray-700 dark:text-slate-300 text-sm">{a.profiles?.full_name}</span>
                        </div>
                        <span className={`text-xs px-2 py-0.5 rounded-lg ${RSVP_STYLES[a.rsvp_status] || ''}`}>{a.rsvp_status}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Creator */}
              {detail.creator && (
                <div className="text-xs text-gray-400 dark:text-slate-600 border-t border-gray-100 dark:border-white/5 pt-4">
                  Créé par {detail.creator.full_name}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Create Modal ── */}
      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCloseCreate} />
          <div className="relative w-full max-w-lg bg-white dark:bg-[#0e1628] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">

            <div className="flex items-center justify-between mb-5">
              <h2 className="text-gray-900 dark:text-white font-bold text-lg">Nouvel événement</h2>
              <button type="button" onClick={handleCloseCreate}
                className="w-8 h-8 flex items-center justify-center rounded-xl text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-white/10 transition text-lg">×</button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Titre *</label>
                <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="Titre de l'événement" className={inputCls} />
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Description</label>
                <textarea rows={2} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Description optionnelle..." className={`${inputCls} resize-none`} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Type *</label>
                  <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inputCls}>
                    {EVENT_TYPES.map(t => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Visibilité</label>
                  <select value={form.visibility} onChange={e => setForm(f => ({ ...f, visibility: e.target.value }))} className={inputCls}>
                    <option value="Tous">Tous</option>
                    <option value="Invités seulement">Invités seulement</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Début *</label>
                  <input type="datetime-local" required value={form.start_at} onChange={e => setForm(f => ({ ...f, start_at: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Fin</label>
                  <input type="datetime-local" value={form.end_at} onChange={e => setForm(f => ({ ...f, end_at: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Lieu</label>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                  placeholder="Adresse ou lien de réunion" className={inputCls} />
              </div>
              {form.visibility === 'Invités seulement' && (
                <div className="space-y-3">
                  <label className="block text-sm text-gray-500 dark:text-slate-400">Invités ({form.invitee_ids.length})</label>
                  {/* Context picker */}
                  <div className="border border-[#1E5F7A]/20 rounded-xl p-3 space-y-2">
                    <p className="text-[10px] text-gray-400 dark:text-slate-500 font-medium uppercase tracking-wider">Inviter par contexte</p>
                    <select value={inviteContextId}
                      onChange={async e => {
                        const ctx = contexts.find(c => c.id === e.target.value)
                        setInviteContextId(e.target.value)
                        setInviteContextType(ctx?.type || 'project')
                        setInviteContextMembers(await loadEventContextMembers(e.target.value, ctx?.type || 'project'))
                        setInviteContextSearch('')
                      }}
                      className={inputCls}>
                      <option value="">— Choisir un contexte —</option>
                      {contexts.filter(c => c.type === 'project').map(c => <option key={c.id} value={c.id}>[Projet] {c.name}</option>)}
                      {contexts.filter(c => c.type === 'cellule').map(c => <option key={c.id} value={c.id}>[Cellule] {c.name}</option>)}
                    </select>
                    {inviteContextMembers.length > 0 && (
                      <>
                        <div className="flex justify-between items-center">
                          <span className="text-[10px] text-gray-400">{inviteContextMembers.length} membres disponibles</span>
                          <button type="button"
                            onClick={() => setForm(f => ({ ...f, invitee_ids: [...new Set([...f.invitee_ids, ...inviteContextMembers.map(m => m.id)])] }))}
                            className="text-[10px] text-[#1E5F7A] dark:text-[#5bbcde] hover:underline font-semibold">Tout sélectionner</button>
                        </div>
                        <input value={inviteContextSearch} onChange={e => setInviteContextSearch(e.target.value)}
                          placeholder="Rechercher dans ce contexte…"
                          className="w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-[#1E5F7A] transition text-gray-900 dark:text-white" />
                        <div className="space-y-1 max-h-36 overflow-y-auto">
                          {inviteContextMembers.filter(m => m.full_name.toLowerCase().includes(inviteContextSearch.toLowerCase())).map(m => {
                            const selected = form.invitee_ids.includes(m.id)
                            return (
                              <button type="button" key={m.id}
                                onClick={() => setForm(f => ({ ...f, invitee_ids: selected ? f.invitee_ids.filter(id => id !== m.id) : [...f.invitee_ids, m.id] }))}
                                className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg border transition text-left text-xs ${selected ? 'bg-[#1E5F7A]/10 border-[#1E5F7A]/40' : 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10'}`}>
                                <div className="w-5 h-5 rounded-full overflow-hidden bg-[#1E5F7A]/20 flex items-center justify-center flex-shrink-0">
                                  {m.avatar_url
                                    ? <img src={m.avatar_url} className="w-full h-full object-cover" alt={m.full_name} />
                                    : <span className="text-[#1E5F7A] text-[8px] font-bold">{m.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0,2)}</span>
                                  }
                                </div>
                                <span className="flex-1 truncate text-gray-800 dark:text-slate-200">{m.full_name}</span>
                                {selected && <span className="text-[#1E5F7A] text-[10px]">✓</span>}
                              </button>
                            )
                          })}
                        </div>
                      </>
                    )}
                  </div>
                  {/* Manual search */}
                  <input value={inviteeSearch} onChange={e => setInviteeSearch(e.target.value)}
                    placeholder="Ou rechercher dans tous les membres…" className={inputCls} />
                  <div className="flex flex-wrap gap-2 max-h-36 overflow-y-auto p-2 bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl">
                    {profiles.filter(p => p.full_name.toLowerCase().includes(inviteeSearch.toLowerCase())).map(p => {
                      const selected = form.invitee_ids.includes(p.id)
                      return (
                        <button type="button" key={p.id}
                          onClick={() => setForm(f => ({ ...f, invitee_ids: selected ? f.invitee_ids.filter(id => id !== p.id) : [...f.invitee_ids, p.id] }))}
                          className={`text-xs px-3 py-1.5 rounded-lg transition font-medium ${selected ? 'bg-[#1E5F7A] text-white' : 'bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-600 dark:text-slate-400 hover:border-[#1E5F7A]'}`}>
                          {p.full_name}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={handleCloseCreate}
                  className="flex-1 bg-gray-100 dark:bg-white/5 text-gray-600 dark:text-slate-400 text-sm font-medium py-2.5 rounded-xl hover:bg-gray-200 dark:hover:bg-white/10 transition">
                  Annuler
                </button>
                <button type="submit" disabled={submitting}
                  className="flex-1 bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold py-2.5 rounded-xl transition active:scale-[0.98]">
                  {submitting ? 'Création…' : 'Créer l\'événement'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  )
}