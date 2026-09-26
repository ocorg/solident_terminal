'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { applyAsVolunteer, type VolunteerError } from './actions'

export function VolunteerForm() {
  const t = useTranslations('Volunteer')
  const empty = { fullName: '', phone: '', email: '', city: '', profile: 'etudiant' as 'etudiant' | 'praticien' | 'public', skills: '', availability: '', motivation: '', website: '' }
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await applyAsVolunteer({ ...form, website: form.website || undefined })
      if (res.status === 'error') return void toast.error(t(res.message as VolunteerError))
      setDone(true)
      toast.success(t('successTitle'))
    } catch {
      toast.error(t('errGeneric'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-2 py-6 text-center">
        <p className="font-heading text-2xl font-bold text-navy-700">{t('successTitle')}</p>
        <p className="text-ink-600">{t('successText')}</p>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="vol-name" label={`${t('name')} *`}>
          <input id="vol-name" required minLength={2} maxLength={80} autoComplete="name" value={form.fullName} onChange={set('fullName')} className={inputClass} />
        </Field>
        <Field id="vol-phone" label={`${t('phone')} *`}>
          <input id="vol-phone" type="tel" dir="ltr" required maxLength={30} autoComplete="tel" value={form.phone} onChange={set('phone')} className={`${inputClass} text-start`} />
        </Field>
        <Field id="vol-email" label={t('email')}>
          <input id="vol-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} />
        </Field>
        <Field id="vol-city" label={t('city')}>
          <input id="vol-city" maxLength={80} autoComplete="address-level2" value={form.city} onChange={set('city')} className={inputClass} />
        </Field>
      </div>
      <Field id="vol-profile" label={t('profile')}>
        <select id="vol-profile" value={form.profile} onChange={set('profile')} className={inputClass}>
          {(['etudiant', 'praticien', 'public'] as const).map((p) => (
            <option key={p} value={p}>
              {t(`profiles.${p}`)}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="vol-skills" label={t('skills')}>
          <input id="vol-skills" maxLength={500} value={form.skills} onChange={set('skills')} placeholder={t('skillsHint')} className={inputClass} />
        </Field>
        <Field id="vol-availability" label={t('availability')}>
          <input id="vol-availability" maxLength={300} value={form.availability} onChange={set('availability')} placeholder={t('availabilityHint')} className={inputClass} />
        </Field>
      </div>
      <Field id="vol-motivation" label={t('motivation')}>
        <textarea id="vol-motivation" rows={4} maxLength={1500} value={form.motivation} onChange={set('motivation')} className={inputClass} />
      </Field>
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
      <SubmitButton loading={loading}>{t('submit')}</SubmitButton>
    </form>
  )
}
