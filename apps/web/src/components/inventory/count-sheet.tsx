'use client'

import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { Spinner } from '@/components/spinner'
import { addCountLine, deleteCountDraft, removeCountLine, saveCountLines, validateCount, type CountChange } from '@/lib/inventory/actions'
import { formatQty, normalizeQty } from '@/lib/inventory/labels'
import type { CountDTO } from '@/lib/inventory/queries'
import { ItemPicker, type PickerItem } from './item-picker'
import { IconCheck, IconCount, IconPlus, IconTrash } from '@/components/ui/icons'
import { ActionBar, Btn, Choice, FormSection, ItemThumb, QtyStepper, selectClass, Sheet, Tag, useConfirm } from '@/components/ui'

// Field rule: never lose typed counts. Every keystroke goes to localStorage first, then to the
// server (debounced). Without network the draft stays on the phone and is sent when it returns.

type LineState = { countedQty: string; note: string }
type Stored = { lines: Record<string, LineState>; notes?: string; pending: string[]; notesPending?: boolean; savedAt?: string }
type SyncState = { kind: 'idle' | 'saving' | 'offline' | 'error'; savedAt?: string; message?: string }

const storageKey = (id: string) => `solident:inventaire:${id}`
function readStore(id: string): Stored | null {
  try {
    const raw = localStorage.getItem(storageKey(id))
    return raw ? (JSON.parse(raw) as Stored) : null
  } catch {
    return null
  }
}
function writeStore(id: string, s: Stored) {
  try {
    localStorage.setItem(storageKey(id), JSON.stringify(s))
  } catch {
    /* storage full or blocked: the server sync still runs */
  }
}
function clearStore(id: string) {
  try {
    localStorage.removeItem(storageKey(id))
  } catch {}
}

const time = (iso: string) => new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
const n = (s: string | null | undefined) => (s == null || s === '' ? null : Number(normalizeQty(s) ?? NaN))

export function CountSheet({
  count,
  me,
  canValidate,
  canRemoveLines,
  items,
  members,
}: {
  count: CountDTO
  me: { id: string }
  canValidate: boolean
  canRemoveLines: boolean
  items: PickerItem[]
  members: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [lines, setLines] = useState<Record<string, LineState>>(() =>
    Object.fromEntries(count.lines.map((l) => [l.id, { countedQty: l.countedQty ?? '', note: l.note ?? '' }])),
  )
  const [notes, setNotes] = useState(count.notes ?? '')
  const [sync, setSync] = useState<SyncState>({ kind: 'idle' })
  const pending = useRef(new Set<string>())
  const notesPending = useRef(false)
  const linesRef = useRef(lines)
  const notesRef = useRef(notes)
  const [dirty, setDirty] = useState(false)
  const flushRef = useRef<() => Promise<boolean>>(async () => true)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const retry = useRef(0)
  const inFlight = useRef(false)

  const persistLocal = useCallback(() => {
    writeStore(count.id, { lines: linesRef.current, notes: notesRef.current, pending: [...pending.current], notesPending: notesPending.current })
  }, [count.id])

  const flush = useCallback(async (): Promise<boolean> => {
    if (inFlight.current) return false
    if (!pending.current.size && !notesPending.current) return true
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setSync({ kind: 'offline' })
      return false
    }
    inFlight.current = true
    setSync((s) => ({ ...s, kind: 'saving' }))
    const ids = [...pending.current]
    const sent = Object.fromEntries(ids.map((id) => [id, linesRef.current[id]!]))
    const sentNotes = notesPending.current ? notesRef.current : undefined
    try {
      const res = await saveCountLines({
        countId: count.id,
        lines: ids.filter((id) => sent[id]).map((id) => ({ id, countedQty: sent[id]!.countedQty.trim() === '' ? null : sent[id]!.countedQty, note: sent[id]!.note })),
        ...(sentNotes !== undefined && { notes: sentNotes }),
      })
      if (res.status === 'error') {
        // Refused by the server (validated meanwhile, invalid number…): keep the local copy, stop retrying.
        setSync({ kind: 'error', message: res.message })
        toast.error(res.message)
        return false
      }
      // Only clear what did not change while the request was in flight.
      for (const id of ids) if (linesRef.current[id]?.countedQty === sent[id]?.countedQty && linesRef.current[id]?.note === sent[id]?.note) pending.current.delete(id)
      if (sentNotes !== undefined && notesRef.current === sentNotes) notesPending.current = false
      retry.current = 0
      if (!pending.current.size && !notesPending.current) {
        clearStore(count.id)
        setDirty(false)
      } else persistLocal()
      setSync({ kind: 'idle', savedAt: res.data.savedAt })
      return !pending.current.size && !notesPending.current
    } catch {
      // Network failure: retry with backoff (5 s, 10 s, 20 s, max 60 s).
      const delay = Math.min(60_000, 5_000 * 2 ** retry.current++)
      setSync({ kind: 'offline' })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => void flushRef.current(), delay)
      return false
    } finally {
      inFlight.current = false
    }
  }, [count.id, persistLocal])
  useEffect(() => {
    flushRef.current = flush
  }, [flush])

  const schedule = useCallback(() => {
    persistLocal()
    if (timer.current) clearTimeout(timer.current)
    timer.current = setTimeout(() => void flush(), 1200)
  }, [flush, persistLocal])

  // On load: anything left on this phone (typed offline, page reloaded) wins over the server copy.
  useEffect(() => {
    const stored = readStore(count.id)
    if (stored?.pending.length || stored?.notesPending) {
      const known = new Set(count.lines.map((l) => l.id))
      const ids = stored.pending.filter((id) => known.has(id))
      const next = { ...linesRef.current }
      for (const id of ids) if (stored.lines[id]) next[id] = stored.lines[id]!
      linesRef.current = next
      setLines(next)
      if (stored.notesPending && stored.notes !== undefined) {
        setNotes(stored.notes)
        notesRef.current = stored.notes
        notesPending.current = true
      }
      for (const id of ids) pending.current.add(id)
      if (ids.length || stored.notesPending) {
        setDirty(true)
        toast.info('Saisies non envoyées retrouvées sur cet appareil : envoi en cours.')
        void flush()
      }
    }
    const online = () => void flush()
    const hide = () => document.visibilityState === 'hidden' && void flush()
    window.addEventListener('online', online)
    document.addEventListener('visibilitychange', hide)
    return () => {
      window.removeEventListener('online', online)
      document.removeEventListener('visibilitychange', hide)
      if (timer.current) clearTimeout(timer.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once per count
  }, [count.id])

  // Warn before leaving with unsent counts.
  useEffect(() => {
    const before = (e: BeforeUnloadEvent) => {
      if (pending.current.size || notesPending.current) e.preventDefault()
    }
    window.addEventListener('beforeunload', before)
    return () => window.removeEventListener('beforeunload', before)
  }, [])

  function setLine(id: string, patch: Partial<LineState>) {
    // Ref first (synchronously), so the local copy saved by schedule() is always the latest.
    const prev: LineState = linesRef.current[id] ?? { countedQty: '', note: '' }
    const next = { ...linesRef.current, [id]: { ...prev, ...patch } }
    linesRef.current = next
    setLines(next)
    pending.current.add(id)
    setDirty(true)
    schedule()
  }

  // ───── filters ─────
  const [filter, setFilter] = useState<'tout' | 'moi' | 'restant'>('tout')
  const [q, setQ] = useState('')
  const fold = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase()
  const groups = useMemo(() => {
    const map = new Map<string, { holder: { id: string; name: string }; lines: CountDTO['lines'] }>()
    for (const l of count.lines) {
      if (filter === 'moi' && l.holder.id !== me.id) continue
      if (filter === 'restant' && (lines[l.id]?.countedQty ?? '') !== '') continue
      if (q && !fold(l.item.name).includes(fold(q))) continue
      const g = map.get(l.holder.id) ?? { holder: l.holder, lines: [] }
      g.lines.push(l)
      map.set(l.holder.id, g)
    }
    return [...map.values()]
  }, [count.lines, filter, q, lines, me.id])

  const done = count.lines.filter((l) => (lines[l.id]?.countedQty ?? '') !== '').length
  const invalid = count.lines.filter((l) => {
    const v = lines[l.id]?.countedQty ?? ''
    return v !== '' && normalizeQty(v) === null
  }).length
  const unsaved = dirty

  return (
    <div className="space-y-4 pb-28">
      <div className="card space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <Tag tone="gold">Brouillon</Tag>
          <span className="text-ink-600">
            {done} / {count.lines.length} lignes comptées
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-navy-100" aria-hidden>
          <div className="h-full bg-navy-700 transition-[width]" style={{ width: `${count.lines.length ? (done / count.lines.length) * 100 : 0}%` }} />
        </div>
        <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un article…" className={`${inputClass} h-11 py-0`} aria-label="Rechercher un article" />
          <Choice
            options={['tout', 'moi', 'restant'] as const}
            value={filter}
            onChange={setFilter}
            label="Afficher"
            labelOf={(k) => ({ tout: 'Tout', moi: 'Mon matériel', restant: 'À compter' })[k]}
          />
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.holder.id} className="space-y-2">
          <h2 className="sticky top-0 z-10 -mx-4 bg-cream-50/95 px-4 py-2 font-heading text-lg font-bold text-navy-900 backdrop-blur-sm sm:mx-0 sm:px-0">
            {g.holder.name}
            {g.holder.id === me.id && <span className="text-sm font-normal text-ink-600"> (moi)</span>}
          </h2>
          <ul className="space-y-2">
            {g.lines.map((l) => {
              const st = lines[l.id] ?? { countedQty: '', note: '' }
              const counted = n(st.countedQty)
              const bad = st.countedQty !== '' && normalizeQty(st.countedQty) === null
              const gap = counted !== null && !Number.isNaN(counted) ? Math.round((counted - Number(l.snapshotQty)) * 100) / 100 : null
              return (
                <li key={l.id} className={`card space-y-3 border-s-4 p-3 ${bad ? 'border-danger' : gap === null ? 'border-navy-100' : gap === 0 ? 'border-success' : gap < 0 ? 'border-gold-500' : 'border-navy-700'}`}>
                  <div className="flex items-center gap-3">
                    <ItemThumb url={l.item.photoUrl} name={l.item.name} category={l.item.category} size={44} />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold leading-tight text-navy-900">{l.item.name}</p>
                      <p className="text-sm text-ink-600">
                        Attendu : <span className="font-semibold tabular-nums">{formatQty(l.snapshotQty)}</span> {l.item.unit}
                        {gap !== null && gap !== 0 && (
                          <span className={`ms-2 font-semibold ${gap < 0 ? 'text-gold-700' : 'text-navy-700'}`}>
                            ({gap > 0 ? '+' : '−'}
                            {formatQty(Math.abs(gap))})
                          </span>
                        )}
                      </p>
                    </div>
                    {canRemoveLines && <RemoveLine id={l.id} name={l.item.name} onRemoved={() => router.refresh()} />}
                  </div>
                  <div className="flex items-center gap-2">
                    <QtyStepper value={st.countedQty} onChange={(v) => setLine(l.id, { countedQty: v })} label={`Quantité comptée, ${l.item.name}`} className="flex-1" />
                    <button
                      type="button"
                      onClick={() => setLine(l.id, { countedQty: l.snapshotQty })}
                      className="flex min-h-12 shrink-0 items-center gap-1.5 rounded-[10px] bg-success/10 px-3 text-sm font-semibold text-success transition hover:bg-success hover:text-white active:scale-95"
                      title="Le compte correspond à l’attendu"
                    >
                      <IconCheck className="size-4" /> OK
                    </button>
                  </div>
                  {bad && <p className="text-sm font-semibold text-danger">Nombre invalide (ex. 3 ou 2,5).</p>}
                  {gap !== null && gap !== 0 && (
                    <input
                      value={st.note}
                      onChange={(e) => setLine(l.id, { note: e.target.value })}
                      maxLength={300}
                      placeholder="Explication de l’écart (facultatif)"
                      className={`${inputClass} h-11 py-0 text-sm`}
                      aria-label={`Note, ${l.item.name}`}
                    />
                  )}
                </li>
              )
            })}
          </ul>
        </section>
      ))}
      {!groups.length && <p className="card p-6 text-center text-sm text-ink-600">Aucune ligne à afficher.</p>}

      <AddLine countId={count.id} items={items} members={members} me={me} onAdded={() => router.refresh()} />

      <div className="card space-y-2 p-4">
        <label htmlFor="count-notes" className="block text-sm font-semibold">
          Notes générales
        </label>
        <textarea
          id="count-notes"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value)
            notesRef.current = e.target.value
            notesPending.current = true
            setDirty(true)
            schedule()
          }}
          rows={2}
          maxLength={1000}
          className={inputClass}
          placeholder="Ex. comptage fait au local après la caravane"
        />
      </div>

      <DeleteDraft countId={count.id} visible={canRemoveLines} projectId={count.project?.id ?? null} />

      {/* Sticky save bar */}
      <div className="fixed inset-x-0 bottom-0 z-20 border-t border-navy-100 bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_24px_rgba(18,58,79,0.08)] backdrop-blur-sm print:hidden">
        <div className="mx-auto flex max-w-6xl items-center gap-3">
          <p className="min-w-0 flex-1 text-sm" role="status" aria-live="polite">
            {sync.kind === 'saving' && (
              <span className="flex items-center gap-2 text-ink-600">
                <Spinner /> Enregistrement…
              </span>
            )}
            {sync.kind === 'offline' && <span className="font-semibold text-gold-700">Hors ligne : saisies gardées sur cet appareil, envoi automatique au retour du réseau.</span>}
            {sync.kind === 'error' && <span className="font-semibold text-danger">{sync.message}</span>}
            {sync.kind === 'idle' && (unsaved ? <span className="text-ink-600">Modifications en attente…</span> : <span className="text-success">{sync.savedAt ? `Enregistré à ${time(sync.savedAt)}` : 'Tout est enregistré'}</span>)}
          </p>
          <Btn variant="quiet" onClick={() => void flush()} disabled={sync.kind === 'saving'} className="hidden shrink-0 sm:inline-flex">
            Enregistrer maintenant
          </Btn>
          {canValidate && <ValidateButton count={count} lines={lines} invalid={invalid} flush={flush} />}
        </div>
      </div>
    </div>
  )
}

function RemoveLine({ id, name, onRemoved }: { id: string; name: string; onRemoved: () => void }) {
  const { ask, dialog } = useConfirm()
  const [busy, setBusy] = useState(false)
  async function remove() {
    if (!(await ask({ title: `Retirer « ${name} » de l’inventaire ?`, body: 'La ligne ne sera pas comptée. Le stock ne change pas.', confirm: 'Retirer la ligne', danger: true }))) return
    setBusy(true)
    const res = await removeCountLine({ lineId: id })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Ligne retirée')
    onRemoved()
  }
  return (
    <>
      <Btn variant="quiet" size="sm" busy={busy} icon={<IconTrash className="size-4" />} onClick={remove} aria-label={`Retirer ${name}`} className="shrink-0 px-2 hover:text-danger" />
      {dialog}
    </>
  )
}

function AddLine({ countId, items, members, me, onAdded }: { countId: string; items: PickerItem[]; members: { id: string; name: string }[]; me: { id: string }; onAdded: () => void }) {
  const [open, setOpen] = useState(false)
  const [itemId, setItemId] = useState<string | null>(null)
  const [holderId, setHolderId] = useState(me.id)
  const [busy, setBusy] = useState(false)
  async function add() {
    if (!itemId) return
    setBusy(true)
    const res = await addCountLine({ countId, itemId, holderId })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Ligne ajoutée')
    setOpen(false)
    setItemId(null)
    onAdded()
  }
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-3 rounded-[12px] border border-dashed border-navy-700/30 px-4 py-3 text-start font-semibold text-navy-700 transition hover:border-navy-700 hover:bg-navy-100/40"
      >
        <span className="flex size-9 items-center justify-center rounded-[8px] bg-navy-100">
          <IconPlus className="size-4" />
        </span>
        <span>
          Ajouter une ligne
          <span className="block text-xs font-normal text-ink-600">Un article trouvé qui n’est pas dans la liste</span>
        </span>
      </button>
      <Sheet
        open={open}
        onClose={() => {
          setOpen(false)
          setItemId(null)
        }}
        dirty={!!itemId}
        title="Ajouter une ligne"
        subtitle="Un article trouvé pendant le comptage."
        icon={<IconPlus />}
        footer={
          <ActionBar
            primary={
              <Btn variant="primary" size="lg" icon={<IconPlus />} busy={busy} disabled={!itemId} onClick={add}>
                Ajouter la ligne
              </Btn>
            }
            cancel={
              <Btn
                variant="quiet"
                onClick={() => {
                  setOpen(false)
                  setItemId(null)
                }}
              >
                Annuler
              </Btn>
            }
          />
        }
      >
        <div className="space-y-5">
          <FormSection title="Article">
            <ItemPicker items={items} value={itemId} onChange={setItemId} />
          </FormSection>
          <FormSection title="Détenu par" htmlFor="add-holder">
            <select id="add-holder" value={holderId} onChange={(e) => setHolderId(e.target.value)} className={selectClass}>
              {members.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name}
                </option>
              ))}
            </select>
          </FormSection>
          <p className="text-sm text-ink-600">Le système affichera la quantité attendue d’après l’historique (souvent 0 pour un article non listé ; l’écart sera un surplus).</p>
        </div>
      </Sheet>
    </>
  )
}

function DeleteDraft({ countId, visible, projectId }: { countId: string; visible: boolean; projectId: string | null }) {
  const router = useRouter()
  const { ask, dialog } = useConfirm()
  const [busy, setBusy] = useState(false)
  if (!visible) return null
  async function remove() {
    if (!(await ask({ title: 'Supprimer ce brouillon ?', body: 'Toutes les quantités saisies dans cet inventaire seront perdues. Le stock ne change pas.', confirm: 'Supprimer le brouillon', danger: true }))) return
    setBusy(true)
    const res = await deleteCountDraft({ countId })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    clearStore(countId)
    toast.success('Brouillon supprimé')
    router.push(projectId ? `/espace/projets/${projectId}/inventaire` : '/espace/inventaire?onglet=inventaires')
  }
  return (
    <div className="flex justify-center border-t border-navy-100 pt-4">
      <Btn variant="dangerQuiet" size="sm" busy={busy} icon={<IconTrash className="size-4" />} onClick={remove}>
        Supprimer ce brouillon
      </Btn>
      {dialog}
    </div>
  )
}

function ValidateButton({ count, lines, invalid, flush }: { count: CountDTO; lines: Record<string, LineState>; invalid: number; flush: () => Promise<boolean> }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [overrides, setOverrides] = useState<Record<string, 'consommation' | 'perte'>>({})
  const [changes, setChanges] = useState<CountChange[] | null>(null)

  // Preview from what was shown; the server recomputes from the ledger and warns if it differs.
  const gaps = count.lines
    .map((l) => {
      const c = n(lines[l.id]?.countedQty)
      if (c === null || Number.isNaN(c)) return null
      const gap = Math.round((c - Number(l.snapshotQty)) * 100) / 100
      if (gap === 0) return null
      const def: 'consommation' | 'perte' | 'ajustement' = gap > 0 ? 'ajustement' : l.item.category === 'consommable' ? 'consommation' : 'perte'
      return { l, gap, def }
    })
    .filter((x) => x !== null)
  const uncounted = count.lines.filter((l) => (lines[l.id]?.countedQty ?? '') === '').length

  async function openReview() {
    if (invalid) return void toast.error('Corrigez les quantités invalides avant de valider.')
    setBusy(true)
    const synced = await flush()
    setBusy(false)
    if (!synced) return void toast.error('Les dernières saisies ne sont pas encore envoyées (réseau ?). Réessayez dans un instant.')
    setChanges(null)
    setOpen(true)
  }

  async function confirm(acceptChanges: boolean) {
    setBusy(true)
    const res = await validateCount({ countId: count.id, acceptChanges, outcomes: overrides })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    if (!res.data.validated) {
      setChanges(res.data.changes)
      return
    }
    clearStore(count.id)
    toast.success('Inventaire validé : les mouvements ont été enregistrés.')
    setOpen(false)
    router.refresh()
  }

  return (
    <>
      <Btn variant="primary" size="lg" icon={<IconCheck />} busy={busy && !open} onClick={openReview} className="shrink-0">
        Valider
      </Btn>
      <Sheet
        open={open}
        onClose={() => !busy && setOpen(false)}
        dirty={Object.keys(overrides).length > 0}
        title="Valider l’inventaire"
        subtitle="Vérifiez les écarts avant de figer l’inventaire."
        icon={<IconCount />}
        footer={
          <ActionBar
            primary={
              <Btn variant="primary" size="lg" icon={<IconCheck />} busy={busy} onClick={() => confirm(!!changes)}>
                {changes ? 'Valider quand même' : 'Valider l’inventaire'}
              </Btn>
            }
            cancel={
              <Btn variant="quiet" disabled={busy} onClick={() => setOpen(false)}>
                Retour au comptage
              </Btn>
            }
          />
        }
      >
        <div className="space-y-4 text-sm">
          {changes && (
            <div className="space-y-2 rounded-[10px] border-s-4 border-danger bg-danger/10 p-3">
              <p className="font-semibold text-danger">Le stock a changé depuis le début du comptage</p>
              <p>Des mouvements ont été enregistrés entre-temps. Les écarts seront calculés avec les quantités actuelles :</p>
              <ul className="list-disc ps-5">
                {changes.map((c) => (
                  <li key={c.lineId}>
                    {c.itemName} ({c.holderName}) : {formatQty(c.snapshotQty)} → <strong>{formatQty(c.currentQty)}</strong>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p>
            Une fois validé, l’inventaire est figé (lecture seule) et les écarts deviennent des mouvements de stock.
            {uncounted > 0 && <strong> {uncounted} ligne(s) non comptée(s) seront ignorées.</strong>}
          </p>
          {gaps.length ? (
            <ul className="divide-y divide-navy-100 rounded-[10px] border border-navy-100">
              {gaps.map(({ l, gap, def }) => {
                const value = overrides[l.id] ?? def
                return (
                  <li key={l.id} className="flex flex-wrap items-center gap-2 px-3 py-2">
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold">{l.item.name}</span>
                      <span className="text-ink-600">
                        {l.holder.name} · {gap > 0 ? '+' : '−'}
                        {formatQty(Math.abs(gap))} {l.item.unit}
                      </span>
                    </span>
                    {def === 'ajustement' ? (
                      <Tag tone="gold">Surplus</Tag>
                    ) : (
                      <select
                        value={value}
                        onChange={(e) => setOverrides({ ...overrides, [l.id]: e.target.value as 'consommation' | 'perte' })}
                        className="h-10 rounded-[8px] border border-navy-100 bg-white px-2"
                        aria-label={`Type d’écart, ${l.item.name}`}
                      >
                        <option value="consommation">Consommé</option>
                        <option value="perte">Manquant (perte)</option>
                      </select>
                    )}
                  </li>
                )
              })}
            </ul>
          ) : (
            <p className="rounded-[10px] bg-success/10 p-3 font-semibold text-success">Aucun écart : tout est conforme.</p>
          )}
        </div>
      </Sheet>
    </>
  )
}
