'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { guardedField, hasUnsavedData, rememberBaseline, rememberPageBaseline, resetBaseline } from '@/lib/unsaved'

export type UnsavedLabels = { title: string; body: string; stay: string; leave: string }

export const unsavedLabelsFr: UnsavedLabels = {
  title: 'Des informations ne sont pas enregistrées',
  body: 'Vous avez commencé à remplir un formulaire. Si vous quittez cette page, ce que vous avez saisi sera perdu.',
  stay: 'Continuer la saisie',
  leave: 'Quitter sans enregistrer',
}

/**
 * Mounted once per root layout. When a form has unsaved data:
 * - a click on a link (menu, logo, footer…) asks for confirmation instead of leaving;
 * - closing or reloading the tab triggers the browser's own warning.
 */
export function UnsavedGuard({ labels = unsavedLabelsFr }: { labels?: UnsavedLabels }) {
  const router = useRouter()
  const [pending, setPending] = useState<string | null>(null)
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    rememberPageBaseline()
    const onFocus = (e: FocusEvent) => {
      const f = guardedField(e.target)
      if (f) rememberBaseline(f)
    }
    const onSubmit = (e: SubmitEvent) => {
      if (e.target instanceof HTMLFormElement) resetBaseline(e.target)
    }
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download')) return
      const url = new URL(a.href, location.href)
      if (url.origin === location.origin && url.pathname === location.pathname && url.search === location.search) return // same page / anchor
      if (!hasUnsavedData()) return
      e.preventDefault()
      e.stopPropagation()
      setPending(url.origin === location.origin ? url.pathname + url.search + url.hash : url.href)
    }
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (!hasUnsavedData()) return
      e.preventDefault()
      e.returnValue = ''
    }
    document.addEventListener('focusin', onFocus, true)
    document.addEventListener('submit', onSubmit, true)
    document.addEventListener('click', onClick, true)
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => {
      document.removeEventListener('focusin', onFocus, true)
      document.removeEventListener('submit', onSubmit, true)
      document.removeEventListener('click', onClick, true)
      window.removeEventListener('beforeunload', onBeforeUnload)
    }
  }, [])

  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (pending && !d.open) d.showModal()
    if (!pending && d.open) d.close()
  }, [pending])

  function leave() {
    const href = pending
    setPending(null)
    if (!href) return
    if (href.startsWith('/')) router.push(href)
    else location.href = href
  }

  return (
    <dialog
      ref={ref}
      onClose={() => setPending(null)}
      aria-labelledby="unsaved-title"
      className="m-auto w-[min(92vw,440px)] rounded-[12px] bg-white p-0 text-navy-900 shadow-card-hover backdrop:bg-navy-900/40"
    >
      {pending && (
        <div className="space-y-4 p-6">
          <h2 id="unsaved-title" className="font-heading text-lg font-bold">
            {labels.title}
          </h2>
          <p className="text-sm text-ink-600">{labels.body}</p>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <button type="button" onClick={leave} className="btn btn-ghost min-h-11 text-danger">
              {labels.leave}
            </button>
            <button type="button" autoFocus onClick={() => setPending(null)} className="btn btn-primary min-h-11">
              {labels.stay}
            </button>
          </div>
        </div>
      )}
    </dialog>
  )
}
