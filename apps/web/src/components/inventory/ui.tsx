'use client'

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { inputClass } from '@/components/form-fields'
import { tagTone, type Tone } from '@/lib/inventory/labels'
import { setDirtySource } from '@/lib/unsaved'

/** Uppercase status tag on a low-opacity background (no pills, no emoji). */
export function Tag({ tone, children, className = '' }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-block rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tagTone[tone]} ${className}`}>{children}</span>
}

const SheetDirtyContext = createContext<((id: string, dirty: boolean) => void) | null>(null)

/** Inside a Sheet: report whether this form holds typed data (blocks accidental closing). */
export function useSheetDirty(dirty: boolean) {
  const report = useContext(SheetDirtyContext)
  const id = useId()
  // Layout effect: the panel knows about typed data before the next click can be handled.
  useLayoutEffect(() => {
    report?.(id, dirty)
    return () => report?.(id, false)
  }, [report, id, dirty])
}

/** True once the values differ from the first render (any field touched, even one character). */
export function useChanged(values: unknown) {
  const [initial] = useState(() => JSON.stringify(values))
  return JSON.stringify(values) !== initial
}

/**
 * Side panel on desktop, bottom sheet on phones. Native <dialog>: focus trap, Escape and the
 * back gesture close it. Content is only rendered while open.
 * When a form inside holds typed data (useSheetDirty, or the `dirty` prop), a click outside,
 * Escape, the back gesture or "Fermer" ask for confirmation instead of closing.
 */
export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  dirty = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
  footer?: React.ReactNode
  dirty?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const openRef = useRef(open)
  const forms = useRef(new Map<string, boolean>())
  const [formsDirty, setFormsDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const sourceId = useId()
  const isDirty = dirty || formsDirty

  const report = useCallback((id: string, d: boolean) => {
    if (d) forms.current.set(id, true)
    else forms.current.delete(id)
    setFormsDirty(forms.current.size > 0)
  }, [])

  // Also protects against closing or reloading the tab.
  useEffect(() => {
    setDirtySource(sourceId, open && isDirty)
    return () => setDirtySource(sourceId, false)
  }, [sourceId, open, isDirty])

  useEffect(() => {
    openRef.current = open
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])

  // Read live values (not the last render) so a very fast click after typing is still caught.
  const dirtyNow = () => dirty || forms.current.size > 0

  function requestClose() {
    if (dirtyNow()) setConfirming(true)
    else onClose()
  }
  function discard() {
    setConfirming(false)
    onClose()
  }

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        // Escape / back gesture: same rule as a click outside.
        e.preventDefault()
        requestClose()
      }}
      onClose={() => {
        // The browser can force-close a dialog; reopen it if data would be lost.
        if (openRef.current && dirtyNow()) {
          ref.current?.showModal()
          setConfirming(true)
          return
        }
        if (openRef.current) onClose()
      }}
      onClick={(e) => e.target === ref.current && requestClose()}
      aria-label={title}
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none rounded-t-[12px] bg-white p-0 text-navy-900 shadow-card-hover backdrop:bg-navy-900/40 sm:me-0 sm:ms-auto sm:mt-0 sm:h-dvh sm:max-h-none sm:w-[440px] sm:rounded-none sm:rounded-s-[12px]"
    >
      {open && (
        <SheetDirtyContext.Provider value={report}>
          <div className="relative flex max-h-[92dvh] flex-col sm:h-dvh sm:max-h-none">
            <div className="flex items-center justify-between gap-3 border-b border-navy-100 px-5 py-4">
              <h2 className="font-heading text-lg font-bold">{title}</h2>
              <button type="button" onClick={requestClose} className="-me-2 rounded-[8px] px-3 py-2 text-sm font-semibold text-navy-700 transition hover:bg-navy-100" aria-label="Fermer">
                Fermer
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
            {footer && <div className="border-t border-navy-100 bg-cream-50 px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{footer}</div>}
            {confirming && (
              <div role="alertdialog" aria-labelledby={`${sourceId}-t`} aria-describedby={`${sourceId}-d`} className="absolute inset-0 z-30 flex items-end bg-navy-900/30 sm:items-center">
                <div className="m-3 w-full space-y-3 rounded-[12px] border-s-4 border-gold-500 bg-white p-5 shadow-card-hover">
                  <p id={`${sourceId}-t`} className="font-heading text-lg font-bold">
                    Des informations ne sont pas enregistrées
                  </p>
                  <p id={`${sourceId}-d`} className="text-sm text-ink-600">
                    Vous avez commencé à remplir ce formulaire. Si vous fermez maintenant, ce que vous avez saisi sera perdu.
                  </p>
                  <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <button type="button" onClick={discard} className="btn btn-ghost min-h-11 text-danger">
                      Fermer sans enregistrer
                    </button>
                    <button type="button" autoFocus onClick={() => setConfirming(false)} className="btn btn-primary min-h-11">
                      Continuer la saisie
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </SheetDirtyContext.Provider>
      )}
    </dialog>
  )
}

/** Numeric input with large − / + buttons (field use). Value is a string: "2,5" is accepted. */
export function QtyStepper({
  id,
  value,
  onChange,
  step = 1,
  min = 0,
  label,
  className = '',
}: {
  id?: string
  value: string
  onChange: (v: string) => void
  step?: number
  min?: number
  label?: string
  className?: string
}) {
  const num = Number(value.replace(',', '.'))
  const bump = (delta: number) => {
    const base = Number.isFinite(num) ? num : 0
    const next = Math.max(min, Math.round((base + delta) * 100) / 100)
    onChange(String(next))
  }
  const btn =
    'flex size-12 shrink-0 items-center justify-center rounded-[10px] border border-navy-100 bg-white text-xl font-bold text-navy-700 transition hover:bg-navy-100 active:scale-95 disabled:opacity-40'
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <button type="button" className={btn} onClick={() => bump(-step)} disabled={!value || num <= min} aria-label={`Diminuer${label ? ` ${label}` : ''}`}>
        −
      </button>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/[^\d.,]/g, ''))}
        aria-label={label}
        className={`${inputClass} h-12 min-w-0 flex-1 text-center text-lg font-semibold tabular-nums`}
      />
      <button type="button" className={btn} onClick={() => bump(step)} aria-label={`Augmenter${label ? ` ${label}` : ''}`}>
        +
      </button>
    </div>
  )
}

/** Small square item photo, or the category initial when there is none. */
export function ItemThumb({ url, name, size = 40 }: { url: string | null; name: string; size?: number }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element -- R2 images, already resized on upload
    return <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-[8px] bg-cream-100 object-cover" style={{ width: size, height: size }} />
  return (
    <span aria-hidden className="flex shrink-0 items-center justify-center rounded-[8px] bg-navy-100 font-heading font-bold text-navy-700" style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

export const selectClass = `${inputClass} h-12 py-0`
