'use client'

import { createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { tagTone, type Tone } from './tones'
import { formsDirtyIn, setDirtySource } from '@/lib/unsaved'
import { IconCheck, IconClose, IconWarning } from './icons'

/** Uppercase status tag on a low-opacity background (no pills, no emoji). */

export function Tag({ tone, children, className = '' }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-block rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tagTone[tone]} ${className}`}>{children}</span>
}

// ───────── buttons ─────────
// One clear hierarchy everywhere in the module:
// primary = the action of the screen (one per screen) · secondary = another useful action ·
// quiet = cancel / back (text weight, never as big as the action) · danger = destructive, kept apart.
const variants = {
  primary: 'bg-navy-700 text-white shadow-sm hover:bg-navy-900 disabled:bg-navy-700/50',
  secondary: 'border border-navy-100 bg-white text-navy-700 hover:border-navy-700/40 hover:bg-navy-100/50',
  quiet: 'text-ink-600 hover:bg-navy-100/60 hover:text-navy-900',
  danger: 'bg-danger text-white shadow-sm hover:brightness-90',
  dangerQuiet: 'text-danger hover:bg-danger/10',
} as const
export type BtnVariant = keyof typeof variants

export function Btn({
  variant = 'secondary',
  size = 'md',
  icon,
  busy = false,
  className = '',
  children,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md' | 'lg'; icon?: React.ReactNode; busy?: boolean }) {
  const sz = size === 'lg' ? 'min-h-12 px-5 text-base' : size === 'sm' ? 'min-h-9 px-3 text-sm' : 'min-h-11 px-4 text-sm'
  return (
    <button
      type="button"
      {...props}
      disabled={props.disabled || busy}
      className={`inline-flex items-center justify-center gap-2 rounded-[10px] font-semibold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${sz} ${variants[variant]} ${className}`}
    >
      {busy ? <Spinner /> : icon}
      {children}
    </button>
  )
}

/**
 * Bottom action area of a panel or dialog. Phone: the main action takes the full width, cancel
 * and destructive actions sit below it as light text buttons. Larger screens: destructive on the
 * start side, cancel + main action grouped on the end side.
 */
export function ActionBar({ primary, cancel, danger }: { primary: React.ReactNode; cancel?: React.ReactNode; danger?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <div className="order-2 flex items-center justify-between gap-2 sm:order-1 sm:contents">
        {danger && <div className="sm:me-auto">{danger}</div>}
        {cancel && <div className={danger ? '' : 'mx-auto sm:mx-0 sm:ms-auto'}>{cancel}</div>}
      </div>
      <div className={`order-1 sm:order-2 ${!cancel && !danger ? 'sm:ms-auto' : ''} [&>*]:w-full sm:[&>*]:w-auto sm:[&>*]:min-w-44`}>{primary}</div>
    </div>
  )
}

/** Bottom of a page form: submit (main action), quiet cancel, destructive action kept apart. */
export function FormActions({
  submit,
  loading = false,
  disabled = false,
  onCancel,
  cancelLabel = 'Annuler',
  danger,
}: {
  submit: string
  loading?: boolean
  disabled?: boolean
  onCancel?: () => void
  cancelLabel?: string
  danger?: React.ReactNode
}) {
  return (
    <div className="border-t border-navy-100 pt-4">
      <ActionBar
        primary={
          <Btn type="submit" variant="primary" size="lg" icon={<IconCheck />} busy={loading} disabled={disabled}>
            {submit}
          </Btn>
        }
        cancel={
          onCancel ? (
            <Btn variant="quiet" onClick={onCancel}>
              {cancelLabel}
            </Btn>
          ) : undefined
        }
        danger={danger}
      />
    </div>
  )
}

// ───────── panel (sheet) ─────────
const SheetDirtyContext = createContext<((id: string, dirty: boolean) => void) | null>(null)
const SheetFooterContext = createContext<HTMLElement | null>(null)
const SheetCloseContext = createContext<() => void>(() => {})

/** Inside a Sheet: close it the same way as the close button (asks first when data is typed). */
export const useSheetClose = () => useContext(SheetCloseContext)

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

/** Renders its children in the panel's fixed bottom bar (always visible, never over the fields). */
export function SheetFooter({ children }: { children: React.ReactNode }) {
  const slot = useContext(SheetFooterContext)
  return slot ? createPortal(children, slot) : null
}

/**
 * Side panel on desktop, bottom sheet on phones. Native <dialog>: focus trap, Escape and the
 * back gesture close it. Content is only rendered while open. Actions go in <SheetFooter>
 * (or the `footer` prop) so they stay in a fixed bar under the content.
 * When a form inside holds typed data (useSheetDirty, or the `dirty` prop), a click outside,
 * Escape, the back gesture or the close button ask for confirmation instead of closing.
 */
export function Sheet({
  open,
  onClose,
  title,
  subtitle,
  icon,
  children,
  footer,
  dirty = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  subtitle?: React.ReactNode
  icon?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  dirty?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  const openRef = useRef(open)
  const forms = useRef(new Map<string, boolean>())
  const [formsDirty, setFormsDirty] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [slot, setSlot] = useState<HTMLElement | null>(null)
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
  const dirtyNow = () => dirty || forms.current.size > 0 || (!!ref.current && formsDirtyIn(ref.current))

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
      className="m-0 mt-auto max-h-[92dvh] w-full max-w-none overflow-hidden rounded-t-[16px] bg-cream-50 p-0 text-navy-900 shadow-card-hover backdrop:bg-navy-900/45 sm:me-0 sm:ms-auto sm:mt-0 sm:h-dvh sm:max-h-none sm:w-[460px] sm:rounded-none sm:rounded-s-[16px]"
    >
      {open && (
        <SheetDirtyContext.Provider value={report}>
          <SheetFooterContext.Provider value={slot}>
          <SheetCloseContext.Provider value={requestClose}>
            <div className="relative flex max-h-[92dvh] flex-col sm:h-dvh sm:max-h-none">
              {/* Grab handle on phones */}
              <div aria-hidden className="mx-auto mt-2 h-1 w-10 rounded-full bg-navy-100 sm:hidden" />
              <header className="flex items-start gap-3 border-b border-navy-100 bg-white px-5 pb-4 pt-3 sm:pt-5">
                {icon && <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-navy-100 text-navy-700">{icon}</span>}
                <div className="min-w-0 flex-1">
                  <h2 className="font-heading text-lg font-bold leading-tight">{title}</h2>
                  {subtitle && <p className="mt-0.5 text-sm text-ink-600">{subtitle}</p>}
                </div>
                <button
                  type="button"
                  onClick={requestClose}
                  aria-label="Fermer"
                  className="-me-2 -mt-1 flex size-11 shrink-0 items-center justify-center rounded-[10px] text-ink-600 transition hover:bg-navy-100 hover:text-navy-900"
                >
                  <IconClose />
                </button>
              </header>
              <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
              <div ref={setSlot} className="border-t border-navy-100 bg-white px-5 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] empty:hidden">
                {footer}
              </div>
              {confirming && (
                <div role="alertdialog" aria-labelledby={`${sourceId}-t`} aria-describedby={`${sourceId}-d`} className="absolute inset-0 z-30 flex items-end bg-navy-900/35 p-3 sm:items-center">
                  <div className="w-full space-y-4 rounded-[14px] bg-white p-5 shadow-card-hover">
                    <div className="flex items-start gap-3">
                      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-gold-100 text-gold-700">
                        <IconWarning />
                      </span>
                      <div>
                        <p id={`${sourceId}-t`} className="font-heading text-lg font-bold leading-tight">
                          Des informations ne sont pas enregistrées
                        </p>
                        <p id={`${sourceId}-d`} className="mt-1 text-sm text-ink-600">
                          Vous avez commencé à remplir ce formulaire. Si vous fermez maintenant, ce que vous avez saisi sera perdu.
                        </p>
                      </div>
                    </div>
                    <ActionBar
                      primary={
                        <Btn variant="primary" size="lg" autoFocus onClick={() => setConfirming(false)}>
                          Continuer la saisie
                        </Btn>
                      }
                      cancel={
                        <Btn variant="dangerQuiet" onClick={discard}>
                          Fermer sans enregistrer
                        </Btn>
                      }
                    />
                  </div>
                </div>
              )}
            </div>
          </SheetCloseContext.Provider>
          </SheetFooterContext.Provider>
        </SheetDirtyContext.Provider>
      )}
    </dialog>
  )
}

/** A button that opens its form in a panel. `children` receives `close` (call it after a successful save). */
export function SheetButton({
  label,
  icon,
  variant = 'primary',
  size = 'md',
  className = '',
  title,
  subtitle,
  sheetIcon,
  children,
}: {
  label: React.ReactNode
  icon?: React.ReactNode
  variant?: BtnVariant
  size?: 'sm' | 'md' | 'lg'
  className?: string
  title: string
  subtitle?: React.ReactNode
  sheetIcon?: React.ReactNode
  children: (close: () => void) => React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Btn variant={variant} size={size} icon={icon} className={className} onClick={() => setOpen(true)}>
        {label}
      </Btn>
      <Sheet open={open} onClose={() => setOpen(false)} title={title} subtitle={subtitle} icon={sheetIcon ?? icon}>
        {children(() => setOpen(false))}
      </Sheet>
    </>
  )
}

/** A titled group of fields inside a panel (gives forms a readable rhythm). */
export function FormSection({ title, hint, children, htmlFor }: { title: string; hint?: React.ReactNode; children: React.ReactNode; htmlFor?: string }) {
  return (
    <section className="space-y-2">
      <div>
        {htmlFor ? (
          <label htmlFor={htmlFor} className="block text-sm font-bold text-navy-900">
            {title}
          </label>
        ) : (
          <h3 className="text-sm font-bold text-navy-900">{title}</h3>
        )}
        {hint && <p className="text-xs text-ink-600">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

// ───────── confirmation dialog ─────────
export type ConfirmOpts = { title: string; body?: React.ReactNode; confirm: string; danger?: boolean }
/** Styled replacement for window.confirm(): `const { ask, dialog } = useConfirm()`, render {dialog}, then `if (!(await ask({...}))) return`. */
export function useConfirm() {
  const [local, setLocal] = useState<(ConfirmOpts & { resolve: (v: boolean) => void }) | null>(null)
  const ask = useCallback((o: ConfirmOpts) => new Promise<boolean>((resolve) => setLocal({ ...o, resolve })), [])
  return { ask, dialog: <ConfirmDialog state={local} onDone={() => setLocal(null)} /> }
}

export function ConfirmDialog({ state, onDone }: { state: (ConfirmOpts & { resolve: (v: boolean) => void }) | null; onDone: () => void }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (state && !d.open) d.showModal()
    if (!state && d.open) d.close()
  }, [state])
  const finish = (v: boolean) => {
    state?.resolve(v)
    onDone()
  }
  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault()
        finish(false)
      }}
      onClick={(e) => e.target === ref.current && finish(false)}
      className="m-auto w-[min(92vw,440px)] rounded-[14px] bg-white p-0 text-navy-900 shadow-card-hover backdrop:bg-navy-900/45"
    >
      {state && (
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className={`flex size-10 shrink-0 items-center justify-center rounded-full ${state.danger ? 'bg-danger/10 text-danger' : 'bg-gold-100 text-gold-700'}`}>
              <IconWarning />
            </span>
            <div>
              <p className="font-heading text-lg font-bold leading-tight">{state.title}</p>
              {state.body && <div className="mt-1 text-sm text-ink-600">{state.body}</div>}
            </div>
          </div>
          <ActionBar
            primary={
              <Btn variant={state.danger ? 'danger' : 'primary'} size="lg" onClick={() => finish(true)}>
                {state.confirm}
              </Btn>
            }
            cancel={
              <Btn variant="quiet" autoFocus onClick={() => finish(false)}>
                Annuler
              </Btn>
            }
          />
        </div>
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
    'flex size-12 shrink-0 items-center justify-center rounded-[10px] bg-navy-100 text-xl font-bold text-navy-700 transition hover:bg-navy-700 hover:text-white active:scale-95 disabled:bg-navy-100/50 disabled:text-navy-700/30 disabled:hover:bg-navy-100/50'
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
        placeholder="0"
        className={`${inputClass} h-12 min-w-0 flex-1 text-center text-lg font-bold tabular-nums`}
      />
      <button type="button" className={btn} onClick={() => bump(step)} aria-label={`Augmenter${label ? ` ${label}` : ''}`}>
        +
      </button>
    </div>
  )
}

/** Category accents (inventory): consommables navy, instruments gold, équipements green. */
export const categoryAccent = {
  consommable: 'bg-navy-100 text-navy-700',
  instrument: 'bg-gold-100 text-gold-700',
  equipement: 'bg-success/10 text-success',
} as const

/** Small square item photo, or the initial on its category colour when there is none. */
export function ItemThumb({ url, name, size = 40, category }: { url: string | null; name: string; size?: number; category?: keyof typeof categoryAccent }) {
  if (url)
    // eslint-disable-next-line @next/next/no-img-element -- R2 images, already resized on upload
    return <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-[8px] bg-cream-100 object-cover" style={{ width: size, height: size }} />
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center rounded-[8px] font-heading font-bold ${categoryAccent[category ?? 'consommable']}`} style={{ width: size, height: size, fontSize: size * 0.4 }}>
      {name.slice(0, 1).toUpperCase()}
    </span>
  )
}

/** Segmented choice (category, source, type): large tap targets, one selected. */
export function Choice<T extends string>({ options, value, onChange, label, labelOf }: { options: readonly T[]; value: T; onChange: (v: T) => void; label: string; labelOf: (v: T) => string }) {
  return (
    <div className="grid gap-1 rounded-[12px] bg-navy-100/60 p-1" style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }} role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button
          key={o}
          type="button"
          role="radio"
          aria-checked={value === o}
          onClick={() => onChange(o)}
          className={`min-h-11 rounded-[9px] px-2 text-sm font-semibold transition ${value === o ? 'bg-white text-navy-900 shadow-sm' : 'text-ink-600 hover:text-navy-900'}`}
        >
          {labelOf(o)}
        </button>
      ))}
    </div>
  )
}

export const selectClass = `${inputClass} h-12 py-0`
