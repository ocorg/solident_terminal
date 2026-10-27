'use client'

// Unsaved-data protection, shared by the page guard (components/unsaved-guard.tsx) and the
// inventory panels (components/inventory/ui.tsx Sheet).
//
// A page has unsaved data when:
// - a field of a <form> differs from its value when the person first focused it
//   (forms marked data-no-guard are skipped: search filters, login);
// - an element says so itself with data-guard-dirty="true" (inline editors that are not forms);
// - a component registered a dirty source (open panels with typed data).

const sources = new Map<string, boolean>()
const baseline = new WeakMap<Element, string>()

export function setDirtySource(id: string, dirty: boolean) {
  if (dirty) sources.set(id, true)
  else sources.delete(id)
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
const SKIP_TYPES = new Set(['hidden', 'submit', 'button', 'reset', 'image', 'search'])

export function guardedField(el: EventTarget | null): Field | null {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement)) return null
  if (el instanceof HTMLInputElement && SKIP_TYPES.has(el.type)) return null
  if (el.closest('[data-no-guard]')) return null
  if (!el.closest('form')) return null
  return el
}

const valueOf = (f: Field) =>
  f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio')
    ? String(f.checked)
    : f instanceof HTMLSelectElement && f.multiple
      ? [...f.selectedOptions].map((o) => o.value).join('\u0000')
      : f.value

/** Remember a field's value the first time it gets focus (before the person changes it). */
export function rememberBaseline(f: Field) {
  if (!baseline.has(f)) baseline.set(f, valueOf(f))
}

/** Original value from the page's HTML (catches typing that happened before the scripts loaded). */
const initialOf = (f: Field) =>
  f instanceof HTMLInputElement && (f.type === 'checkbox' || f.type === 'radio')
    ? String(f.defaultChecked)
    : f instanceof HTMLSelectElement
      ? [...f.options].filter((o) => o.defaultSelected).map((o) => o.value).join('\u0000') || (f.multiple ? '' : (f.options[0]?.value ?? ''))
      : f.defaultValue

/** On page load: record every field already on the page with its original HTML value. */
export function rememberPageBaseline() {
  for (const el of document.querySelectorAll('input, textarea, select')) {
    const f = guardedField(el)
    if (f && !baseline.has(f)) baseline.set(f, initialOf(f))
  }
}

/** After a submit, the current values become the new reference. */
export function resetBaseline(form: HTMLFormElement) {
  for (const el of form.elements) if (guardedField(el)) baseline.set(el, valueOf(el as Field))
}

export function hasUnsavedData(): boolean {
  if (sources.size) return true
  if (document.querySelector('[data-guard-dirty="true"]')) return true
  for (const form of document.querySelectorAll('form')) {
    if (form.closest('[data-no-guard]')) continue
    for (const el of form.elements) {
      const f = guardedField(el)
      if (f && baseline.has(f) && baseline.get(f) !== valueOf(f)) return true
    }
  }
  return false
}
