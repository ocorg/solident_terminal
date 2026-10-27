'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { toast } from 'sonner'
import { inputClass } from '@/components/form-fields'
import { copyNeeds, removeNeed, setNeed } from '@/lib/inventory/actions'
import { formatQty } from '@/lib/inventory/labels'
import { IconCheck, IconCopy, IconEdit, IconPlus, IconTrash } from '@/components/ui/icons'
import { ItemPicker, type PickerItem } from './item-picker'
import { ActionBar, Btn, FormSection, QtyStepper, selectClass, Sheet, SheetFooter, Tag, useChanged, useConfirm, useSheetClose, useSheetDirty } from '@/components/ui'

export type NeedRow = { id: string; itemId: string; itemName: string; unit: string; qtyNeeded: string; collected: string; stock: string; note: string | null }

/** Couvert = enough in total stock; Partiel = some; Manquant = none. */
function status(n: NeedRow) {
  const need = Number(n.qtyNeeded)
  const stock = Number(n.stock)
  if (stock >= need) return { label: 'Couvert', tone: 'success' as const, bar: 'bg-success' }
  if (stock > 0) return { label: 'Partiel', tone: 'gold' as const, bar: 'bg-gold-500' }
  return { label: 'Manquant', tone: 'danger' as const, bar: 'bg-danger' }
}

export function NeedsSection({ projectId, needs, canManage, items, copySources }: { projectId: string; needs: NeedRow[]; canManage: boolean; items: PickerItem[]; copySources: { id: string; name: string }[] }) {
  const [editing, setEditing] = useState<NeedRow | 'new' | null>(null)
  const counts = { couvert: 0, partiel: 0, manquant: 0 }
  for (const n of needs) counts[status(n).label.toLowerCase() as keyof typeof counts]++

  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-heading text-xl font-bold text-navy-900">Besoins</h2>
          <p className="text-sm text-ink-600">Ce qu’il faut pour l’activité, comparé au stock de l’association.</p>
        </div>
        {canManage && (
          <div className="flex flex-wrap gap-2">
            {copySources.length > 0 && <CopyNeeds projectId={projectId} sources={copySources} />}
            <Btn variant="primary" icon={<IconPlus />} onClick={() => setEditing('new')}>
              Ajouter un besoin
            </Btn>
          </div>
        )}
      </div>

      {needs.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              ['Couverts', counts.couvert, 'border-success text-success'],
              ['Partiels', counts.partiel, 'border-gold-500 text-gold-700'],
              ['Manquants', counts.manquant, 'border-danger text-danger'],
            ] as const
          ).map(([label, v, cls]) => (
            <div key={label} className={`rounded-[12px] border-s-4 bg-white px-3 py-2 shadow-card ${cls}`}>
              <p className="font-heading text-2xl font-bold">{v}</p>
              <p className="text-xs font-semibold text-ink-600">{label}</p>
            </div>
          ))}
        </div>
      )}

      {needs.length ? (
        <ul className="card divide-y divide-navy-100 p-0">
          {needs.map((n) => {
            const s = status(n)
            const pct = Math.min(100, Math.round((Number(n.stock) / Math.max(Number(n.qtyNeeded), 0.01)) * 100))
            return (
              <li key={n.id} className="px-4 py-3">
                <div className="flex items-start gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-semibold text-navy-900">{n.itemName}</p>
                      <Tag tone={s.tone}>{s.label}</Tag>
                    </div>
                    <div className="mt-2 flex items-center gap-3">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-navy-100" aria-hidden>
                        <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${pct}%` }} />
                      </div>
                      <p className="shrink-0 text-sm tabular-nums">
                        <span className="font-bold text-navy-900">{formatQty(n.stock)}</span>
                        <span className="text-ink-600">
                          {' '}
                          / {formatQty(n.qtyNeeded)} {n.unit}
                        </span>
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-ink-600">
                      Collecté pour ce projet : {formatQty(n.collected)} {n.unit}
                      {n.note && ` · ${n.note}`}
                    </p>
                  </div>
                  {canManage && (
                    <Btn variant="quiet" size="sm" icon={<IconEdit className="size-4" />} onClick={() => setEditing(n)} aria-label={`Modifier ${n.itemName}`}>
                      <span className="hidden sm:inline">Modifier</span>
                    </Btn>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="card p-5 text-sm text-ink-600">
          Pas encore de liste de besoins.{canManage && copySources.length > 0 && ' Vous pouvez reprendre celle d’une caravane précédente.'}
        </p>
      )}

      <Sheet
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing === 'new' ? 'Ajouter un besoin' : 'Modifier le besoin'}
        subtitle={editing && editing !== 'new' ? editing.itemName : 'Un article et la quantité nécessaire.'}
        icon={editing === 'new' ? <IconPlus /> : <IconEdit />}
      >
        {editing && <NeedForm projectId={projectId} need={editing === 'new' ? null : editing} items={items} onDone={() => setEditing(null)} />}
      </Sheet>
    </section>
  )
}

function NeedForm({ projectId, need, items, onDone }: { projectId: string; need: NeedRow | null; items: PickerItem[]; onDone: () => void }) {
  const router = useRouter()
  const close = useSheetClose()
  const { ask, dialog } = useConfirm()
  const [itemId, setItemId] = useState<string | null>(need?.itemId ?? null)
  const [qty, setQty] = useState(need?.qtyNeeded ?? '')
  const [note, setNote] = useState(need?.note ?? '')
  const [busy, setBusy] = useState<string | null>(null)
  useSheetDirty(useChanged({ itemId, qty, note }))

  async function save() {
    if (!itemId) return
    setBusy('save')
    const res = await setNeed({ projectId, itemId, qtyNeeded: qty, note })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Besoin enregistré')
    router.refresh()
    onDone()
  }
  async function remove() {
    if (!need) return
    if (!(await ask({ title: `Retirer « ${need.itemName} » des besoins ?`, body: 'Seule la ligne de besoin est retirée ; le stock ne change pas.', confirm: 'Retirer', danger: true }))) return
    setBusy('remove')
    const res = await removeNeed({ id: need.id })
    setBusy(null)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success('Besoin retiré')
    router.refresh()
    onDone()
  }
  return (
    <div className="space-y-5">
      {!need && (
        <FormSection title="Article">
          <ItemPicker items={items} value={itemId} onChange={setItemId} />
        </FormSection>
      )}
      <FormSection title="Quantité nécessaire" htmlFor="need-qty">
        <QtyStepper id="need-qty" value={qty} onChange={setQty} label="Quantité nécessaire" />
      </FormSection>
      <FormSection title="Note" hint="Facultatif" htmlFor="need-note">
        <input id="need-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} className={`${inputClass} h-12`} placeholder="Ex. taille M de préférence" />
      </FormSection>
      {dialog}
      <SheetFooter>
        <ActionBar
          primary={
            <Btn variant="primary" size="lg" icon={<IconCheck />} busy={busy === 'save'} disabled={!!busy || !itemId || !qty} onClick={save}>
              Enregistrer
            </Btn>
          }
          cancel={
            <Btn variant="quiet" onClick={close}>
              Annuler
            </Btn>
          }
          danger={
            need ? (
              <Btn variant="dangerQuiet" icon={<IconTrash className="size-4" />} busy={busy === 'remove'} disabled={!!busy} onClick={remove}>
                Retirer
              </Btn>
            ) : undefined
          }
        />
      </SheetFooter>
    </div>
  )
}

function CopyNeeds({ projectId, sources }: { projectId: string; sources: { id: string; name: string }[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [from, setFrom] = useState(sources[0]?.id ?? '')
  const [busy, setBusy] = useState(false)
  async function copy() {
    setBusy(true)
    const res = await copyNeeds({ fromProjectId: from, toProjectId: projectId })
    setBusy(false)
    if (res.status === 'error') return void toast.error(res.message)
    toast.success(`${res.data.added} besoin(s) copié(s)${res.data.skipped ? `, ${res.data.skipped} déjà présent(s)` : ''}`)
    setOpen(false)
    router.refresh()
  }
  return (
    <>
      <Btn variant="secondary" icon={<IconCopy className="size-4" />} onClick={() => setOpen(true)}>
        Reprendre une liste
      </Btn>
      <Sheet
        open={open}
        onClose={() => setOpen(false)}
        title="Reprendre une liste de besoins"
        subtitle="Copier les besoins d’une activité précédente."
        icon={<IconCopy />}
        footer={
          <ActionBar
            primary={
              <Btn variant="primary" size="lg" icon={<IconCopy className="size-4" />} busy={busy} disabled={!from} onClick={copy}>
                Copier la liste
              </Btn>
            }
            cancel={
              <Btn variant="quiet" onClick={() => setOpen(false)}>
                Annuler
              </Btn>
            }
          />
        }
      >
        <FormSection title="Liste à reprendre" htmlFor="copy-from" hint="Les articles déjà présents sont gardés tels quels ; les autres sont ajoutés avec les mêmes quantités.">
          <select id="copy-from" value={from} onChange={(e) => setFrom(e.target.value)} className={selectClass}>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </FormSection>
      </Sheet>
    </>
  )
}
