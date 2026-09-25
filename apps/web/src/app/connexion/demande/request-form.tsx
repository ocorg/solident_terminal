'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Spinner } from '@/components/spinner'
import { requestAccess } from './actions'

const inputClass =
  'w-full rounded-[10px] border border-navy-100 bg-white px-4 py-3 outline-none transition focus:border-navy-700 focus:ring-2 focus:ring-navy-100'

export function RequestForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '', website: '' })
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      await requestAccess({ ...form, message: form.message || undefined, website: form.website || undefined })
      setDone(true)
      toast.success('Demande envoyée')
    } catch {
      toast.error("La demande n'a pas pu être envoyée. Vérifiez les champs et réessayez.")
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-2 text-center">
        <p className="text-lg font-semibold text-navy-700">Demande reçue</p>
        <p className="text-ink-600">
          Un administrateur va l&apos;examiner. Une fois votre accès validé, vous pourrez vous connecter avec{' '}
          <strong>{form.email}</strong>.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-1">
        <label htmlFor="req-name" className="block text-sm font-medium">Nom complet</label>
        <input id="req-name" required minLength={2} maxLength={80} value={form.name} onChange={set('name')} className={inputClass} />
      </div>
      <div className="space-y-1">
        <label htmlFor="req-email" className="block text-sm font-medium">Adresse e-mail</label>
        <input id="req-email" type="email" required autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} />
      </div>
      <div className="space-y-1">
        <label htmlFor="req-message" className="block text-sm font-medium">
          Message <span className="font-normal text-ink-600">(optionnel : votre rôle, votre cellule…)</span>
        </label>
        <textarea id="req-message" rows={3} maxLength={500} value={form.message} onChange={set('message')} className={inputClass} />
      </div>
      {/* Honeypot, hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
      <button
        type="submit"
        disabled={loading}
        className="flex w-full items-center justify-center gap-2 rounded-[10px] bg-navy-700 px-4 py-3 font-semibold text-white transition hover:brightness-90 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {loading && <Spinner />}
        Envoyer la demande
      </button>
    </form>
  )
}
