'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { channels } from '@/lib/realtime'
import { useRealtime } from '@/lib/use-realtime'
import { registerForEvent, type RegistrationError } from './actions'

/** Places left (live via Pusher channel event-{id}) + registration form; closes itself when full (spec §6). */
export function RegistrationPanel({ eventId, initial }: { eventId: string; initial: { open: boolean; placesLeft: number | null } }) {
  const t = useTranslations('Registration')
  const te = useTranslations('Events')
  const locale = useLocale() as 'fr' | 'ar' | 'en'
  const [state, setState] = useState(initial)
  const empty = { fullName: '', phone: '', email: '', city: '', profile: 'public' as 'etudiant' | 'praticien' | 'public', note: '', website: '' }
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  useRealtime(channels.event(eventId), 'places-updated', (p) => setState({ open: p.registrationOpen, placesLeft: p.placesLeft }))

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await registerForEvent({ locale, eventId, ...form, website: form.website || undefined })
      if (res.status === 'error') {
        if (res.message === 'errFull') setState((s) => ({ ...s, open: false, placesLeft: 0 }))
        return void toast.error(t(res.message as RegistrationError))
      }
      setDone(true)
      toast.success(t('successTitle'))
    } catch {
      toast.error(t('errGeneric'))
    } finally {
      setLoading(false)
    }
  }

  const badge =
    state.placesLeft === 0 ? te('full') : !state.open ? te('closed') : state.placesLeft === null ? te('open') : te('placesLeft', { count: state.placesLeft })

  return (
    <div className="card p-6 md:p-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-2xl font-bold text-navy-700">{te('registerTitle')}</h2>
        <span className={`rounded-full px-3 py-1 text-sm font-semibold ${state.open ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'}`}>{badge}</span>
      </div>

      {done ? (
        <div className="space-y-3 py-4 text-center">
          <p className="font-heading text-xl font-bold text-navy-700">{t('successTitle')}</p>
          <p className="text-ink-600">{t('successText')}</p>
          {state.open && (
            <button type="button" className="btn btn-ghost" onClick={() => (setForm(empty), setDone(false))}>
              {t('another')}
            </button>
          )}
        </div>
      ) : !state.open ? (
        <p className="text-ink-600">{state.placesLeft === 0 ? t('errFull') : t('errClosed')}</p>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="reg-name" label={`${t('name')} *`}>
              <input id="reg-name" required minLength={2} maxLength={80} autoComplete="name" value={form.fullName} onChange={set('fullName')} className={inputClass} />
            </Field>
            <Field id="reg-phone" label={`${t('phone')} *`}>
              <input id="reg-phone" type="tel" dir="ltr" required maxLength={30} autoComplete="tel" value={form.phone} onChange={set('phone')} className={`${inputClass} text-start`} />
              <p className="text-xs text-ink-600">{t('phoneHint')}</p>
            </Field>
            <Field id="reg-email" label={t('email')}>
              <input id="reg-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} />
              <p className="text-xs text-ink-600">{t('emailHint')}</p>
            </Field>
            <Field id="reg-city" label={t('city')}>
              <input id="reg-city" maxLength={80} autoComplete="address-level2" value={form.city} onChange={set('city')} className={inputClass} placeholder={t('cityHint')} />
            </Field>
          </div>
          <Field id="reg-profile" label={t('profile')}>
            <select id="reg-profile" value={form.profile} onChange={set('profile')} className={inputClass}>
              {(['public', 'etudiant', 'praticien'] as const).map((p) => (
                <option key={p} value={p}>
                  {t(`profiles.${p}`)}
                </option>
              ))}
            </select>
          </Field>
          <Field id="reg-note" label={t('note')}>
            <textarea id="reg-note" rows={3} maxLength={500} value={form.note} onChange={set('note')} className={inputClass} placeholder={t('noteHint')} />
          </Field>
          {/* Honeypot, hidden from humans */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
          <SubmitButton loading={loading}>{t('submit')}</SubmitButton>
        </form>
      )}
    </div>
  )
}
