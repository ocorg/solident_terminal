'use client'

import { useTranslations } from 'next-intl'
import { useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { sendInquiry, type InquiryError } from '@/lib/inquiry-actions'

/** Contact form (kind="contact") and sponsor inquiry (kind="sponsor", spec §5 field ids sp-*). */
export function InquiryForm({ kind, tiers = [] }: { kind: 'contact' | 'sponsor'; tiers?: { id: string; name: string }[] }) {
  const t = useTranslations('Inquiry')
  const p = kind === 'sponsor' ? 'sp' : 'ct'
  const empty = { fullName: '', organisation: '', email: '', phone: '', tierId: '', message: '', website: '' }
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }))

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    try {
      const res = await sendInquiry({ kind, ...form, website: form.website || undefined })
      if (res.status === 'error') return void toast.error(t(res.message as InquiryError))
      setDone(true)
      toast.success(t('sentTitle'))
    } catch {
      toast.error(t('errGeneric'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="font-heading text-2xl font-bold text-navy-700">{t('sentTitle')}</p>
        <p className="text-ink-600">{t('sentText')}</p>
        <button type="button" className="btn btn-ghost" onClick={() => (setForm(empty), setDone(false))}>
          {t('another')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {kind === 'sponsor' && (
          <Field id={`${p}-org`} label={`${t('org')} *`}>
            <input id={`${p}-org`} required maxLength={120} autoComplete="organization" value={form.organisation} onChange={set('organisation')} className={inputClass} />
          </Field>
        )}
        <Field id={`${p}-name`} label={kind === 'contact' ? `${t('name')} *` : t('name')}>
          <input id={`${p}-name`} required={kind === 'contact'} maxLength={80} autoComplete="name" value={form.fullName} onChange={set('fullName')} className={inputClass} />
        </Field>
        <Field id={`${p}-email`} label={`${t('email')} *`}>
          <input id={`${p}-email`} type="email" required autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} />
        </Field>
        <Field id={`${p}-phone`} label={t('phone')}>
          <input id={`${p}-phone`} type="tel" dir="ltr" maxLength={30} autoComplete="tel" value={form.phone} onChange={set('phone')} className={`${inputClass} text-start`} placeholder={t('phoneHint')} />
        </Field>
        {kind === 'sponsor' && tiers.length > 0 && (
          <Field id={`${p}-tier`} label={t('tier')}>
            <select id={`${p}-tier`} value={form.tierId} onChange={set('tierId')} className={inputClass}>
              <option value="">{t('tierNone')}</option>
              {tiers.map((tier) => (
                <option key={tier.id} value={tier.id}>
                  {tier.name}
                </option>
              ))}
            </select>
          </Field>
        )}
      </div>
      <Field id={`${p}-message`} label={kind === 'contact' ? `${t('message')} *` : t('message')}>
        <textarea id={`${p}-message`} rows={5} required={kind === 'contact'} maxLength={2000} value={form.message} onChange={set('message')} className={inputClass} />
      </Field>
      {/* Honeypot, hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
      <SubmitButton loading={loading}>{t('send')}</SubmitButton>
    </form>
  )
}
