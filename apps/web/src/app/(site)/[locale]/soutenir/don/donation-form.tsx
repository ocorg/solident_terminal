'use client'

import { useLocale, useTranslations } from 'next-intl'
import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { Field, inputClass, SubmitButton } from '@/components/form-fields'
import { declareDonation, getProofUploadUrl, type DonateError } from './actions'

const PROOF_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const PROOF_MAX = 5 * 1024 * 1024

export function DonationForm({ campaigns }: { campaigns: { id: string; title: string }[] }) {
  const t = useTranslations('Donate')
  const locale = useLocale() as 'fr' | 'ar' | 'en'
  const fileRef = useRef<HTMLInputElement>(null)
  const empty = { campaignId: campaigns[0]?.id ?? '', donorName: '', showOnWall: false, amount: '', email: '', phone: '', website: '' }
  const [form, setForm] = useState(empty)
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  async function uploadProof(file: File): Promise<string | undefined> {
    const res = await getProofUploadUrl({ contentType: file.type, size: file.size })
    if (res.status === 'error') throw new Error(res.message)
    const put = await fetch(res.data.uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
    if (!put.ok) throw new Error('errUpload')
    return res.data.key
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    const file = fileRef.current?.files?.[0]
    if (file && (!PROOF_TYPES.includes(file.type) || file.size > PROOF_MAX)) return void toast.error(t('errFile'))
    if (form.showOnWall && form.donorName.trim().length < 2) return void toast.error(t('errName'))
    setLoading(true)
    try {
      const proofKey = file ? await uploadProof(file) : undefined
      const res = await declareDonation({
        locale,
        campaignId: form.campaignId,
        donorName: form.donorName.trim() || undefined,
        showOnWall: form.showOnWall,
        amountDh: Number(form.amount),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        proofKey,
        website: form.website || undefined,
      })
      if (res.status === 'error') return void toast.error(t(res.message as DonateError))
      setDone(true)
      toast.success(t('successTitle'))
    } catch (err) {
      const code = err instanceof Error && err.message.startsWith('err') ? err.message : 'errUpload'
      toast.error(t(code as DonateError | 'errUpload'))
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="space-y-3 py-6 text-center">
        <p className="font-heading text-2xl font-bold text-navy-700">{t('successTitle')}</p>
        <p className="text-ink-600">{t('successText')}</p>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => {
            setForm(empty)
            setDone(false)
          }}
        >
          {t('another')}
        </button>
      </div>
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {campaigns.length > 1 && (
        <Field id="don-campaign" label={t('campaign')}>
          <select id="don-campaign" value={form.campaignId} onChange={set('campaignId')} className={inputClass}>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </Field>
      )}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field id="don-amount" label={t('amount')}>
          <input id="don-amount" type="number" inputMode="numeric" required min={10} step={1} value={form.amount} onChange={set('amount')} className={inputClass} />
          <p className="text-xs text-ink-600">{t('amountHint')}</p>
        </Field>
        <Field id="don-name" label={t('name')}>
          <input id="don-name" autoComplete="name" maxLength={80} value={form.donorName} onChange={set('donorName')} className={inputClass} />
          <p className="text-xs text-ink-600">{t('nameHint')}</p>
        </Field>
        <Field id="don-email" label={t('email')}>
          <input id="don-email" type="email" autoComplete="email" value={form.email} onChange={set('email')} className={inputClass} />
          <p className="text-xs text-ink-600">{t('emailHint')}</p>
        </Field>
        <Field id="don-phone" label={t('phone')}>
          <input id="don-phone" type="tel" dir="ltr" autoComplete="tel" maxLength={30} value={form.phone} onChange={set('phone')} className={`${inputClass} text-start`} />
          <p className="text-xs text-ink-600">{t('phoneHint')}</p>
        </Field>
      </div>
      <Field id="don-proof" label={t('proof')}>
        <input id="don-proof" ref={fileRef} type="file" accept={PROOF_TYPES.join(',')} className="block w-full text-sm file:me-3 file:rounded-[10px] file:border-0 file:bg-navy-100 file:px-4 file:py-2 file:font-semibold file:text-navy-700" />
        <p className="text-xs text-ink-600">{t('proofHint')}</p>
      </Field>
      <label htmlFor="don-anon" className="flex items-start gap-3 text-sm">
        <input id="don-anon" type="checkbox" checked={form.showOnWall} onChange={set('showOnWall')} className="mt-1 size-4 accent-navy-700" />
        {t('showOnWall')}
      </label>
      {/* Honeypot, hidden from humans */}
      <input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} className="hidden" aria-hidden />
      <SubmitButton loading={loading}>{t('submit')}</SubmitButton>
    </form>
  )
}
