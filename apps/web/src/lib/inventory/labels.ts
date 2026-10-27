// Inventory vocabulary and number formatting (shared by server and client code).
import type { InventoryCategory, InventoryCountStatus, InventoryLineOutcome, InventoryMovementType, InventorySource } from '@solident/db'

export const categoryLabel: Record<InventoryCategory, string> = { consommable: 'Consommable', instrument: 'Instrument', equipement: 'Équipement' }
export const categoryPlural: Record<InventoryCategory, string> = { consommable: 'Consommables', instrument: 'Instruments', equipement: 'Équipements' }
export const CATEGORIES = Object.keys(categoryLabel) as InventoryCategory[]

export const movementLabel: Record<InventoryMovementType, string> = {
  entree: 'Entrée',
  consommation: 'Consommation',
  perte: 'Perte',
  transfert: 'Transfert',
  ajustement: 'Ajustement',
}
export const MOVEMENT_TYPES = Object.keys(movementLabel) as InventoryMovementType[]

export const sourceLabel: Record<InventorySource, string> = { don: 'Don', achat: 'Achat', emprunt: 'Emprunt' }
export const SOURCES = Object.keys(sourceLabel) as InventorySource[]

export const countStatusLabel: Record<InventoryCountStatus, string> = { brouillon: 'Brouillon', valide: 'Validé' }
export const outcomeLabel: Record<InventoryLineOutcome, string> = { ok: 'Conforme', consommation: 'Consommé', perte: 'Manquant', ajustement: 'Surplus' }

/**
 * Status accents: a coloured left border or an uppercase tag on a low-opacity background
 * (no pills, no emoji). Colours from the design tokens (success / danger / gold / navy).
 */
export const tagTone = {
  navy: 'bg-navy-100 text-navy-900',
  gold: 'bg-gold-100 text-gold-700',
  success: 'bg-success/10 text-success',
  danger: 'bg-danger/10 text-danger',
  muted: 'bg-cream-100 text-ink-600',
} as const
export type Tone = keyof typeof tagTone

export const movementTone: Record<InventoryMovementType, Tone> = {
  entree: 'success',
  consommation: 'navy',
  perte: 'danger',
  transfert: 'gold',
  ajustement: 'muted',
}
export const outcomeTone: Record<InventoryLineOutcome, Tone> = { ok: 'muted', consommation: 'navy', perte: 'danger', ajustement: 'gold' }

/** "12", "2,5", "≈ 3,5" (French decimal comma). Quantities travel as strings (exact decimals). */
export function formatQty(qty: string | number, estimate = false) {
  const n = typeof qty === 'number' ? qty : Number(qty)
  const s = n.toLocaleString('fr-FR', { maximumFractionDigits: 2 })
  return estimate ? `≈ ${s}` : s
}

/** Accepts "2", "2.5", "2,5"; returns a normalized "2.5" or null when invalid (max 2 decimals). */
export function normalizeQty(input: string): string | null {
  const s = input.trim().replace(',', '.')
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(s)) return null
  return s.replace(/^0+(?=\d)/, '')
}
