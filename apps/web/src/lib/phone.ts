/**
 * Normalizes Moroccan and international numbers to E.164 so duplicates are caught
 * ("06 12 34 56 78", "0612345678", "+212 612-345678" and "00212612345678" are the same person).
 * Returns null when the number is not plausible.
 */
export function normalizePhone(raw: string): string | null {
  let p = raw.replace(/[\s().-]/g, '')
  if (p.startsWith('00')) p = `+${p.slice(2)}`
  if (/^0[5-7]\d{8}$/.test(p)) p = `+212${p.slice(1)}` // Moroccan national format
  if (/^\+2120\d{9}$/.test(p)) p = `+212${p.slice(5)}` // "+212 06…" typo
  return /^\+\d{8,15}$/.test(p) ? p : null
}
