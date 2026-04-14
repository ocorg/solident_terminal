'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useTheme } from 'next-themes'
import { useToast, ToastStyle } from '@/hooks/useToast'

interface Profile {
  full_name: string; username: string; is_admin: boolean; avatar_url?: string
}

function SectionCard({ title, icon, children }: { title: string; icon: string; children: React.ReactNode }) {
  return (
    <div className="bg-white dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-2xl overflow-hidden">
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 dark:border-white/10">
        <span className="text-lg">{icon}</span>
        <h2 className="text-gray-900 dark:text-white font-semibold text-sm">{title}</h2>
      </div>
      <div className="p-6">{children}</div>
    </div>
  )
}

export default function SettingsPage() {
  const supabase = createClient()
  const { theme, setTheme } = useTheme()

  const [profile,       setProfile]       = useState<Profile | null>(null)
  const [avatarUrl,     setAvatarUrl]     = useState<string | null>(null)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [userId,        setUserId]        = useState<string | null>(null)
  const [emailEnabled,  setEmailEnabled]  = useState(true)
  const [loading,       setLoading]       = useState(true)
  const { toast, toastLeaving, showToast } = useToast()

  // Profile form
  const [fullName,  setFullName]  = useState('')
  const [username,  setUsername]  = useState('')
  const [savingProfile, setSavingProfile] = useState(false)

  // Password form
  const [currentPass, setCurrentPass] = useState('')
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [savingPass,  setSavingPass]  = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setUserId(user.id)

      const { data: prof } = await supabase
        .from('profiles').select('*').eq('id', user.id).single()
      if (prof) {
        setProfile(prof)
        setFullName(prof.full_name)
        setUsername(prof.username)
        setAvatarUrl(prof.avatar_url || null)
      }

      const { data: prefs } = await supabase
        .from('user_email_prefs').select('email_enabled').eq('user_id', user.id).maybeSingle()
      if (prefs) setEmailEnabled(prefs.email_enabled)

      setLoading(false)
    }
    load()
  }, [])

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !userId) return
    if (file.size > 204800) { showToast('Image trop lourde — maximum 200 Ko', false); return }
    if (!file.type.startsWith('image/')) { showToast('Format invalide — images uniquement', false); return }
    setUploadingAvatar(true)
    const { error: uploadError } = await supabase.storage
      .from('avatars').upload(userId, file, { upsert: true, contentType: file.type })
    if (uploadError) { showToast(uploadError.message, false); setUploadingAvatar(false); return }
    const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(userId)
    const newUrl = `${publicUrl}?t=${Date.now()}`
    await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, avatar_url: newUrl }),
    })
    setAvatarUrl(newUrl)
    setUploadingAvatar(false)
    showToast('Photo de profil mise à jour !')
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault()
    setSavingProfile(true)
    const res = await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, email_enabled: emailEnabled }),
    })
    const data = await res.json()
    setSavingProfile(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Profil mis à jour !')
    setProfile(p => p ? { ...p, full_name: fullName, username } : p)
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (newPass !== confirmPass) { showToast('Les mots de passe ne correspondent pas', false); return }
    if (newPass.length < 8)     { showToast('Minimum 8 caractères requis', false); return }

    setSavingPass(true)
    const res = await fetch('/api/settings/password', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ current_password: currentPass, new_password: newPass }),
    })
    const data = await res.json()
    setSavingPass(false)
    if (!res.ok) { showToast(data.error, false); return }
    showToast('Mot de passe mis à jour !')
    setCurrentPass(''); setNewPass(''); setConfirmPass('')
  }

  async function toggleEmailPref() {
    const next = !emailEnabled
    setEmailEnabled(next)
    await fetch('/api/settings/profile', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ full_name: fullName, username, email_enabled: next }),
    })
    showToast(next ? 'Emails activés' : 'Emails désactivés')
  }

  const inputCls = "w-full bg-gray-50 dark:bg-white/5 border border-gray-200 dark:border-white/10 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-[#1E5F7A] transition"


  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-[#1E5F7A] border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-2xl mx-auto">

      {/* Toast */}
      {toast && (
        <div style={ToastStyle(toastLeaving)}
          className={`fixed top-6 left-0 right-0 mx-auto w-fit z-50 px-6 py-3 rounded-2xl text-sm font-semibold shadow-2xl border ${toast.ok ? 'bg-green-500 border-green-600 text-white' : 'bg-red-500 border-red-600 text-white'}`}>
          {toast.msg}
        </div>
      )}

      <div>
        <h1 className="text-gray-900 dark:text-white text-2xl font-bold">Paramètres</h1>
        <p className="text-gray-500 dark:text-slate-500 text-sm mt-0.5">Gérez votre compte et vos préférences</p>
      </div>

      {/* ── Mon Profil ── */}
      <SectionCard title="Mon profil" icon="👤">
        <form onSubmit={saveProfile} className="space-y-4">
          <div className="flex items-center gap-4 mb-5">
            <label className="relative cursor-pointer group flex-shrink-0">
              <div className="w-16 h-16 rounded-2xl overflow-hidden bg-[#1E5F7A]/20 text-[#1E5F7A] dark:text-[#5bbcde] font-bold text-lg flex items-center justify-center">
                {avatarUrl
                  ? <img src={avatarUrl} alt="avatar" className="w-full h-full object-cover" />
                  : <span>{fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}</span>
                }
                <div className="absolute inset-0 bg-black/40 rounded-2xl opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                  <span className="text-white text-xs font-semibold">{uploadingAvatar ? '…' : '📷'}</span>
                </div>
              </div>
              <input type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </label>
            <div>
              <p className="text-gray-900 dark:text-white font-semibold">{fullName}</p>
              <p className="text-gray-400 dark:text-slate-500 text-sm">@{username}</p>
              {profile?.is_admin && (
                <span className="text-[10px] bg-[#F0A500]/20 text-[#F0A500] px-2 py-0.5 rounded-full font-semibold border border-[#F0A500]/20 mt-1 inline-block">Administrateur</span>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Nom complet</label>
            <input value={fullName} onChange={e => setFullName(e.target.value)} required className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Nom d'utilisateur</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm">@</span>
              <input value={username} onChange={e => setUsername(e.target.value)} required
                className={`${inputCls} pl-8`} />
            </div>
          </div>

          <button type="submit" disabled={savingProfile}
            className="bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition active:scale-[0.98]">
            {savingProfile ? 'Enregistrement…' : 'Enregistrer le profil'}
          </button>
        </form>
      </SectionCard>

      {/* ── Sécurité ── */}
      <SectionCard title="Sécurité" icon="🔒">
        <form onSubmit={savePassword} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Mot de passe actuel</label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} required value={currentPass}
                onChange={e => setCurrentPass(e.target.value)} placeholder="••••••••"
                className={`${inputCls} pr-12`} />
              <button type="button" onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-[#1E5F7A] transition">
                {showPass ? (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94"/><path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                )}
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Nouveau mot de passe</label>
            <input type={showPass ? 'text' : 'password'} required value={newPass}
              onChange={e => setNewPass(e.target.value)} placeholder="Min. 8 caractères"
              className={inputCls} />
          </div>
          <div>
            <label className="block text-sm text-gray-500 dark:text-slate-400 mb-1.5">Confirmer le nouveau mot de passe</label>
            <input type={showPass ? 'text' : 'password'} required value={confirmPass}
              onChange={e => setConfirmPass(e.target.value)} placeholder="••••••••"
              className={inputCls} />
          </div>

          {/* Strength bar */}
          {newPass && (
            <div className="space-y-1">
              <div className="flex gap-1">
                {[1,2,3,4].map(i => (
                  <div key={i} className={`h-1 flex-1 rounded-full transition-all duration-300 ${
                    newPass.length < 6  && i === 1 ? 'bg-red-400' :
                    newPass.length < 8  && i <= 2 ? 'bg-orange-400' :
                    newPass.length < 12 && i <= 3 ? 'bg-yellow-400' :
                    i <= 4 ? 'bg-green-400' : 'bg-gray-200 dark:bg-white/10'
                  }`} />
                ))}
              </div>
              <p className="text-xs text-gray-400 dark:text-slate-500">
                {newPass.length < 6 ? 'Trop court' : newPass.length < 8 ? 'Faible' : newPass.length < 12 ? 'Correct' : 'Fort'}
              </p>
            </div>
          )}

          <button type="submit" disabled={savingPass}
            className="bg-[#1E5F7A] hover:bg-[#2a7a9a] disabled:opacity-50 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition active:scale-[0.98]">
            {savingPass ? 'Mise à jour…' : 'Changer le mot de passe'}
          </button>
        </form>
      </SectionCard>

      {/* ── Notifications ── */}
      <SectionCard title="Notifications" icon="🔔">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-900 dark:text-white text-sm font-medium">Notifications par email</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">
              Recevoir des emails pour les tâches, événements et propositions
            </p>
          </div>
          <div onClick={toggleEmailPref}
            className={`w-11 h-6 rounded-full transition-colors duration-200 relative cursor-pointer flex-shrink-0 ${emailEnabled ? 'bg-[#1E5F7A]' : 'bg-gray-200 dark:bg-white/10'}`}>
            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all duration-200 ${emailEnabled ? 'left-6' : 'left-1'}`} />
          </div>
        </div>
      </SectionCard>

      {/* ── Apparence ── */}
      <SectionCard title="Apparence" icon="🎨">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-gray-900 dark:text-white text-sm font-medium">Thème</p>
            <p className="text-gray-400 dark:text-slate-500 text-xs mt-0.5">
              {theme === 'dark' ? 'Mode sombre activé' : 'Mode clair activé'}
            </p>
          </div>
          <div className="flex bg-gray-100 dark:bg-white/5 rounded-xl p-1 gap-1">
            <button onClick={() => setTheme('light')}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${theme === 'light' ? 'bg-white dark:bg-[#1E5F7A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
              ☀️ Clair
            </button>
            <button onClick={() => setTheme('dark')}
              className={`px-4 py-2 rounded-lg text-xs font-medium transition flex items-center gap-1.5 ${theme === 'dark' ? 'bg-white dark:bg-[#1E5F7A] text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-slate-400 hover:text-gray-900 dark:hover:text-white'}`}>
              🌙 Sombre
            </button>
          </div>
        </div>
      </SectionCard>

    </div>
  )
}