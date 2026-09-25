'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'

// ─── Types ─────────────────────────────────────────────────────
interface HealthData {
  maintenance_mode: boolean
  health: {
    database: string
    total_users: number
    last_notification: string | null
    email_queue: {
      count:       number
      status:      'healthy' | 'warning' | 'critical'
      oldest_item: { send_after: string; action_type: string; recipient_email: string } | null
    }
  }
  timestamp: string
}

interface QueueItem {
  id:              string
  recipient_email: string
  recipient_name:  string
  action_type:     string
  send_after:      string
}

interface Member { id: string; full_name: string; username: string }

type OpStatus = 'idle' | 'loading' | 'success' | 'error'
interface OpResult { status: OpStatus; message: string }

// ─── Helpers ───────────────────────────────────────────────────
function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime()
  const m    = Math.floor(diff / 60000)
  if (m < 1)  return 'À l\'instant'
  if (m < 60) return `il y a ${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `il y a ${h}h`
  return `il y a ${Math.floor(h / 24)}j`
}

// ─── Sub-components ────────────────────────────────────────────
function OpFeedback({ result }: { result: OpResult }) {
  if (result.status === 'idle') return null
  if (result.status === 'loading') return (
    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-white/50 mt-2">
      <div className="w-3 h-3 border border-gray-300 dark:border-white/30 border-t-transparent rounded-full animate-spin" />
      En cours…
    </div>
  )
  return (
    <div className={`mt-2 text-xs px-3 py-2 rounded-lg border ${
      result.status === 'success'
        ? 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
        : 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20 text-red-700 dark:text-red-400'
    }`}>
      {result.status === 'success' ? '✓ ' : '✗ '}{result.message}
    </div>
  )
}

function Card({ title, icon, children, className = '' }: {
  title: string; icon: string; children: React.ReactNode; className?: string
}) {
  return (
    <div className={`bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden shadow-sm ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-4 border-b border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-transparent">
        <span className="text-lg">{icon}</span>
        <h3 className="text-gray-800 dark:text-white font-semibold text-sm">{title}</h3>
      </div>
      <div className="p-5">{children}</div>
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────
export default function MaintenancePage() {
  const supabase = createClient()

  const [profile,       setProfile]       = useState<{ is_admin: boolean; is_backoffice: boolean } | null>(null)
  const [health,        setHealth]        = useState<HealthData | null>(null)
  const [queue,         setQueue]         = useState<QueueItem[]>([])
  const [members,       setMembers]       = useState<Member[]>([])
  const [loading,       setLoading]       = useState(true)

  const [maintenanceOp, setMaintenanceOp] = useState<OpResult>({ status: 'idle', message: '' })
  const [smtpOp,        setSmtpOp]        = useState<OpResult>({ status: 'idle', message: '' })
  const [cronOp,        setCronOp]        = useState<OpResult>({ status: 'idle', message: '' })
  const [queueFlushOp,  setQueueFlushOp]  = useState<OpResult>({ status: 'idle', message: '' })
  const [notifOp,       setNotifOp]       = useState<OpResult>({ status: 'idle', message: '' })
  const [emailTestOp,   setEmailTestOp]   = useState<OpResult>({ status: 'idle', message: '' })

  const [notifTarget,   setNotifTarget]   = useState<'user' | 'all'>('user')
  const [notifUserId,   setNotifUserId]   = useState('')
  const [notifMessage,  setNotifMessage]  = useState('')
  const [emailTarget,   setEmailTarget]   = useState<'user' | 'all'>('user')
  const [emailUserId,   setEmailUserId]   = useState('')

  const loadAll = useCallback(async () => {
    const [healthRes, queueRes] = await Promise.all([
      fetch('/api/maintenance/status'),
      fetch('/api/maintenance/queue'),
    ])
    if (healthRes.ok) setHealth(await healthRes.json())
    if (queueRes.ok)  setQueue(await queueRes.json())
  }, [])

  useEffect(() => {
    async function init() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase
        .from('profiles')
        .select('is_admin, is_backoffice')
        .eq('id', user.id)
        .single()
      setProfile(data)

      const { data: memberData } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .order('full_name')
      if (memberData) {
        setMembers(memberData)
        setNotifUserId(user.id)
        setEmailUserId(user.id)
      }
      await loadAll()
      setLoading(false)
    }
    init()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Handlers ──────────────────────────────────────────────────
  async function toggleMaintenance() {
    if (!health) return
    setMaintenanceOp({ status: 'loading', message: '' })
    const next = !health.maintenance_mode
    const res  = await fetch('/api/maintenance/status', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ enabled: next }),
    })
    if (res.ok) {
      setMaintenanceOp({ status: 'success', message: `Mode maintenance ${next ? 'activé' : 'désactivé'}` })
      await loadAll()
    } else {
      const d = await res.json()
      setMaintenanceOp({ status: 'error', message: d.error || 'Erreur' })
    }
  }

  async function checkSmtp() {
    setSmtpOp({ status: 'loading', message: '' })
    const res = await fetch('/api/maintenance/smtp-check', { method: 'POST' })
    const d   = await res.json()
    setSmtpOp({ status: d.success ? 'success' : 'error', message: d.success ? `OK — ${d.account}` : (d.error || 'Échec') })
  }

  async function triggerCron() {
    setCronOp({ status: 'loading', message: '' })
    const res = await fetch('/api/maintenance/cron-trigger', { method: 'POST' })
    const d   = await res.json()
    if (d.success) {
      setCronOp({ status: 'success', message: `Cron exécuté — ${d.sent ?? 0} email(s) envoyé(s)` })
      await loadAll()
    } else {
      setCronOp({ status: 'error', message: d.error || 'Erreur inconnue' })
    }
  }

  async function flushQueue() {
    setQueueFlushOp({ status: 'loading', message: '' })
    const res = await fetch('/api/maintenance/queue', { method: 'DELETE' })
    const d   = await res.json()
    if (res.ok) {
      setQueueFlushOp({ status: 'success', message: `${d.sent} email(s) envoyé(s) sur ${d.total} en queue` })
      await loadAll()
    } else {
      setQueueFlushOp({ status: 'error', message: d.error || 'Erreur' })
    }
  }

  async function sendTestNotif() {
    setNotifOp({ status: 'loading', message: '' })
    const res = await fetch('/api/maintenance/notify-test', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ target: notifTarget, userId: notifUserId || undefined, message: notifMessage || undefined }),
    })
    const d = await res.json()
    setNotifOp({
      status:  d.success ? 'success' : 'error',
      message: d.success ? `Notification envoyée à ${d.sent_to} utilisateur(s)` : (d.error || 'Erreur'),
    })
  }

  async function sendTestEmail() {
    setEmailTestOp({ status: 'loading', message: '' })
    const res = await fetch('/api/maintenance/email-test', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ target: emailTarget, userId: emailUserId || undefined }),
    })
    const d = await res.json()
    setEmailTestOp({
      status:  d.success ? 'success' : 'error',
      message: d.success ? `Email envoyé à ${d.sent}/${d.total} destinataire(s)` : (d.errors?.[0] || d.error || 'Erreur'),
    })
  }

  // ── Render ─────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!profile?.is_admin && !profile?.is_backoffice) return (
    <div className="flex items-center justify-center h-64">
      <p className="text-gray-400 text-sm">Accès restreint au Backoffice</p>
    </div>
  )

  const queueStatus = health?.health.email_queue.status ?? 'healthy'

  // Queue status styles — light + dark
  const queueColors = {
    critical: 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20',
    warning:  'text-amber-600 dark:text-[#F0A500] bg-amber-50 dark:bg-[#F0A500]/10 border-amber-200 dark:border-[#F0A500]/20',
    healthy:  'text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20',
  }
  const queueLabel  = { critical: '🔴 Bloquée', warning: '🟡 Retard', healthy: '🟢 OK' }

  // Health stat cards
  const stats = [
    { label: 'Base de données',  value: health?.health.database === 'ok' ? 'En ligne' : 'Erreur', icon: '🗄️',  ok: health?.health.database === 'ok' },
    { label: 'Utilisateurs',     value: `${health?.health.total_users ?? '—'} membres`,              icon: '👥',  ok: true },
    { label: 'Queue email',      value: `${health?.health.email_queue.count ?? '—'} en attente`,     icon: '📧',  ok: queueStatus === 'healthy' },
    { label: 'Dernière notif',   value: health?.health.last_notification ? timeAgo(health.health.last_notification) : 'Aucune', icon: '🔔', ok: !!health?.health.last_notification },
  ]

  // Shared input classes
  const inputCls = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 text-gray-800 dark:text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-[#1E5F7A]/50 placeholder-gray-400 dark:placeholder-white/20"
  const selectCls = `${inputCls} cursor-pointer`

  // Tab button factory
  const tabBtn = (active: boolean) =>
    `flex-1 py-2 rounded-lg text-xs font-semibold border transition ${
      active
        ? 'bg-[#1E5F7A]/10 dark:bg-[#1E5F7A]/30 border-[#1E5F7A]/40 dark:border-[#1E5F7A]/50 text-[#1E5F7A] dark:text-[#5bbcde]'
        : 'bg-gray-50 dark:bg-white/5 border-gray-200 dark:border-white/10 text-gray-500 dark:text-white/40 hover:text-gray-700 dark:hover:text-white/60'
    }`

  return (
    <div className="space-y-6 max-w-5xl mx-auto">

      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-white dark:bg-gradient-to-br dark:from-[#0f1f2e] dark:via-[#0a1828] dark:to-[#050c18] border border-gray-200 dark:border-white/10 rounded-2xl p-6 shadow-sm">
        {/* Glow — dark mode only */}
        <div className="hidden dark:block absolute top-0 right-0 w-64 h-64 bg-[#1E5F7A]/10 rounded-full -translate-y-1/3 translate-x-1/4 blur-2xl pointer-events-none" />
        <div className="relative flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#1E5F7A]/10 dark:bg-[#1E5F7A]/20 border border-[#1E5F7A]/20 dark:border-[#1E5F7A]/30 flex items-center justify-center text-xl flex-shrink-0">
            🛠️
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <h1 className="text-gray-900 dark:text-white font-bold text-lg">Maintenance</h1>
              <span className="text-[10px] bg-[#F0A500]/15 text-[#b87800] dark:text-[#F0A500] border border-[#F0A500]/30 px-2 py-0.5 rounded-full font-semibold">
                BACKOFFICE
              </span>
            </div>
            <p className="text-gray-400 dark:text-white/40 text-xs">Outils de diagnostic et de contrôle système</p>
          </div>
          {health && (
            <div className="ml-auto text-right flex-shrink-0">
              <p className="text-gray-400 dark:text-white/30 text-[10px]">Dernière sync</p>
              <p className="text-gray-500 dark:text-white/50 text-xs">{timeAgo(health.timestamp)}</p>
            </div>
          )}
        </div>
      </div>

      {/* ── Health Stats ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map(s => (
          <div key={s.label} className={`border rounded-2xl p-4 shadow-sm ${
            s.ok
              ? 'bg-white dark:bg-white/5 border-gray-200 dark:border-white/10'
              : 'bg-red-50 dark:bg-red-500/5 border-red-200 dark:border-red-500/20'
          }`}>
            <div className="flex items-center gap-2 mb-1">
              <span>{s.icon}</span>
              <span className={`text-[10px] font-semibold ${s.ok ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {s.ok ? '● En ligne' : '● Erreur'}
              </span>
            </div>
            <p className="text-gray-900 dark:text-white text-sm font-bold">{s.value}</p>
            <p className="text-gray-400 dark:text-white/40 text-[10px] mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── Main Grid ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

        {/* Maintenance Mode Toggle */}
        <Card title="Mode Maintenance" icon="🔒">
          <div className="flex items-center justify-between mb-4">
            <p className="text-gray-500 dark:text-white/70 text-sm pr-3">
              {health?.maintenance_mode
                ? 'La plateforme est actuellement bloquée pour les utilisateurs standard.'
                : 'La plateforme est accessible à tous les utilisateurs.'}
            </p>
            <div className={`text-xs font-bold px-3 py-1.5 rounded-full border flex-shrink-0 ${
              health?.maintenance_mode
                ? 'bg-amber-50 dark:bg-[#F0A500]/10 border-amber-300 dark:border-[#F0A500]/20 text-amber-700 dark:text-[#F0A500]'
                : 'bg-green-50 dark:bg-green-500/10 border-green-200 dark:border-green-500/20 text-green-700 dark:text-green-400'
            }`}>
              {health?.maintenance_mode ? '🔒 ACTIF' : '🟢 INACTIF'}
            </div>
          </div>
          <button
            onClick={toggleMaintenance}
            disabled={maintenanceOp.status === 'loading'}
            className={`w-full py-2.5 rounded-xl text-sm font-semibold transition border ${
              health?.maintenance_mode
                ? 'bg-green-50 dark:bg-green-500/10 border-green-300 dark:border-green-500/20 text-green-700 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-500/20'
                : 'bg-amber-50 dark:bg-[#F0A500]/10 border-amber-300 dark:border-[#F0A500]/20 text-amber-700 dark:text-[#F0A500] hover:bg-amber-100 dark:hover:bg-[#F0A500]/20'
            } disabled:opacity-50`}
          >
            {maintenanceOp.status === 'loading' ? '⏳ En cours…' :
              health?.maintenance_mode ? '✓ Désactiver la maintenance' : '🔒 Activer la maintenance'}
          </button>
          <OpFeedback result={maintenanceOp} />
          <p className="text-gray-400 dark:text-white/25 text-[10px] mt-3">
            Les admins et backoffice restent accessibles en tout temps.
          </p>
        </Card>

        {/* SMTP Check */}
        <Card title="Vérification SMTP" icon="📨">
          <p className="text-gray-500 dark:text-white/50 text-sm mb-4">
            Teste la connexion Gmail SMTP sans envoyer d'email. Vérifie que les credentials sont valides.
          </p>
          <div className="flex items-center gap-2 mb-3 text-xs text-gray-400 dark:text-white/30 bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2 border border-gray-200 dark:border-white/5">
            <span>📬</span>
            <span className="font-mono">smtp.gmail.com:465</span>
          </div>
          <button
            onClick={checkSmtp}
            disabled={smtpOp.status === 'loading'}
            className="w-full py-2.5 bg-[#1E5F7A]/10 dark:bg-[#1E5F7A]/20 border border-[#1E5F7A]/30 text-[#1E5F7A] dark:text-[#5bbcde] rounded-xl text-sm font-semibold hover:bg-[#1E5F7A]/20 dark:hover:bg-[#1E5F7A]/30 transition disabled:opacity-50"
          >
            {smtpOp.status === 'loading' ? '⏳ Connexion…' : '🔌 Tester la connexion SMTP'}
          </button>
          <OpFeedback result={smtpOp} />
        </Card>

        {/* Email Queue */}
        <Card title="Queue Email" icon="📧">
          <div className={`flex items-center justify-between mb-4 text-xs px-3 py-2 rounded-lg border ${queueColors[queueStatus]}`}>
            <span className="font-semibold">{queueLabel[queueStatus]}</span>
            <span>{health?.health.email_queue.count ?? 0} items en attente</span>
          </div>

          {queue.length > 0 ? (
            <div className="space-y-1.5 max-h-36 overflow-y-auto mb-4">
              {queue.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-xs bg-gray-50 dark:bg-white/5 rounded-lg px-3 py-2 border border-gray-200 dark:border-white/5">
                  <span className="text-gray-300 dark:text-white/30">📧</span>
                  <span className="text-gray-600 dark:text-white/60 truncate flex-1">{item.recipient_email}</span>
                  <span className="text-gray-400 dark:text-white/30 flex-shrink-0">{item.action_type}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 dark:text-white/30 text-xs text-center py-3 mb-4">Queue vide ✅</p>
          )}

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={triggerCron}
              disabled={cronOp.status === 'loading'}
              className="py-2.5 bg-[#1E5F7A]/10 dark:bg-[#1E5F7A]/20 border border-[#1E5F7A]/30 text-[#1E5F7A] dark:text-[#5bbcde] rounded-xl text-xs font-semibold hover:bg-[#1E5F7A]/20 dark:hover:bg-[#1E5F7A]/30 transition disabled:opacity-50"
            >
              {cronOp.status === 'loading' ? '⏳…' : '⚡ Déclencher cron'}
            </button>
            <button
              onClick={flushQueue}
              disabled={queueFlushOp.status === 'loading' || queue.length === 0}
              className="py-2.5 bg-amber-50 dark:bg-[#F0A500]/10 border border-amber-300 dark:border-[#F0A500]/20 text-amber-700 dark:text-[#F0A500] rounded-xl text-xs font-semibold hover:bg-amber-100 dark:hover:bg-[#F0A500]/20 transition disabled:opacity-50"
            >
              {queueFlushOp.status === 'loading' ? '⏳…' : '🚀 Forcer envoi'}
            </button>
          </div>
          <OpFeedback result={cronOp.status !== 'idle' ? cronOp : queueFlushOp} />
        </Card>

        {/* Test Notification In-app */}
        <Card title="Test Notification In-app" icon="🔔">
          <p className="text-gray-500 dark:text-white/50 text-xs mb-4">
            Envoie une notification dans la cloche 🔔 d'un utilisateur pour tester le système Realtime.
          </p>
          <div className="flex gap-2 mb-3">
            {(['user', 'all'] as const).map(t => (
              <button key={t} onClick={() => setNotifTarget(t)} className={tabBtn(notifTarget === t)}>
                {t === 'user' ? '👤 Un utilisateur' : '👥 Tous les membres'}
              </button>
            ))}
          </div>
          {notifTarget === 'user' && (
            <select value={notifUserId} onChange={e => setNotifUserId(e.target.value)} className={`${selectCls} mb-3`}>
              {members.map(m => (
                <option key={m.id} value={m.id} className="bg-white dark:bg-[#0e1628]">
                  {m.full_name} (@{m.username})
                </option>
              ))}
            </select>
          )}
          <input
            type="text"
            placeholder="Message personnalisé (optionnel)"
            value={notifMessage}
            onChange={e => setNotifMessage(e.target.value)}
            className={`${inputCls} mb-3`}
          />
          <button
            onClick={sendTestNotif}
            disabled={notifOp.status === 'loading'}
            className="w-full py-2.5 bg-[#1E5F7A]/10 dark:bg-[#1E5F7A]/20 border border-[#1E5F7A]/30 text-[#1E5F7A] dark:text-[#5bbcde] rounded-xl text-sm font-semibold hover:bg-[#1E5F7A]/20 dark:hover:bg-[#1E5F7A]/30 transition disabled:opacity-50"
          >
            {notifOp.status === 'loading' ? '⏳ Envoi…' : '🔔 Envoyer la notification'}
          </button>
          <OpFeedback result={notifOp} />
        </Card>

        {/* Test Email — full width */}
        <Card title="Test Email" icon="✉️" className="lg:col-span-2">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <p className="text-gray-500 dark:text-white/50 text-xs mb-4">
                Envoie un email de test via Gmail SMTP avec le template Solident. Vérifie l'envoi complet end-to-end.
              </p>
              <div className="flex gap-2 mb-3">
                {(['user', 'all'] as const).map(t => (
                  <button key={t} onClick={() => setEmailTarget(t)} className={tabBtn(emailTarget === t)}>
                    {t === 'user' ? '👤 Un utilisateur' : '👥 Tous les membres'}
                  </button>
                ))}
              </div>
              {emailTarget === 'user' && (
                <select value={emailUserId} onChange={e => setEmailUserId(e.target.value)} className={selectCls}>
                  {members.map(m => (
                    <option key={m.id} value={m.id} className="bg-white dark:bg-[#0e1628]">
                      {m.full_name} (@{m.username})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <div className="flex flex-col justify-end">
              <div className="bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/5 rounded-xl p-3 mb-3">
                <p className="text-gray-400 dark:text-white/30 text-[10px] mb-1">Email qui sera envoyé :</p>
                <p className="text-gray-600 dark:text-white/60 text-xs font-mono">action_type: task_assigned</p>
                <p className="text-gray-400 dark:text-white/40 text-[10px] mt-0.5">Template digest Solident</p>
              </div>
              <button
                onClick={sendTestEmail}
                disabled={emailTestOp.status === 'loading'}
                className="w-full py-2.5 bg-[#1E5F7A]/10 dark:bg-[#1E5F7A]/20 border border-[#1E5F7A]/30 text-[#1E5F7A] dark:text-[#5bbcde] rounded-xl text-sm font-semibold hover:bg-[#1E5F7A]/20 dark:hover:bg-[#1E5F7A]/30 transition disabled:opacity-50"
              >
                {emailTestOp.status === 'loading' ? '⏳ Envoi…' : '✉️ Envoyer l\'email de test'}
              </button>
              <OpFeedback result={emailTestOp} />
            </div>
          </div>
        </Card>

      </div>

      <p className="text-gray-400 dark:text-white/20 text-[11px] text-center pb-2">
        Module Maintenance · Backoffice Solident · Accès restreint
      </p>
    </div>
  )
}