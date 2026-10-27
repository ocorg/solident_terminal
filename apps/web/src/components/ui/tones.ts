// Status colours shared by every screen (tags, left accents, tinted zones).
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
