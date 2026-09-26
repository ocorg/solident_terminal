'use client'

import { useTranslations } from 'next-intl'
import { toast } from 'sonner'
import { org, ribCompact } from '@/lib/org'

export function RibCard({ qrSvg }: { qrSvg: string }) {
  const t = useTranslations('Donate')

  async function copy() {
    try {
      await navigator.clipboard.writeText(ribCompact)
      toast.success(t('copied'))
    } catch {
      toast.error(t('errGeneric'))
    }
  }

  return (
    <div className="card flex flex-col gap-6 p-6 sm:flex-row sm:items-center">
      <dl className="flex-1 space-y-3">
        <div>
          <dt className="text-sm text-ink-600">{t('bank')}</dt>
          <dd className="font-semibold">{org.bank}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-600">{t('holder')}</dt>
          <dd className="font-semibold">{org.accountHolder}</dd>
        </div>
        <div>
          <dt className="text-sm text-ink-600">{t('rib')}</dt>
          {/* Numbers always read left-to-right, even in Arabic */}
          <dd dir="ltr" className="text-start font-mono text-lg font-semibold tracking-wide text-navy-700">
            {org.rib}
          </dd>
        </div>
        <button type="button" onClick={copy} className="btn btn-primary">
          {t('copy')}
        </button>
      </dl>
      <div
        role="img"
        aria-label={t('qrAlt')}
        className="mx-auto size-40 shrink-0 rounded-lg bg-white p-2 ring-1 ring-navy-100 [&_svg]:size-full"
        dangerouslySetInnerHTML={{ __html: qrSvg }}
      />
    </div>
  )
}
