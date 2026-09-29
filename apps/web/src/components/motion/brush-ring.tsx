/**
 * The logo's gold brushstroke circle, drawn on screen (stroke animation, decorative).
 * Two overlapping arcs with slightly different radii give the hand-painted feel of the logo.
 */
export function BrushRing({ className, strokeWidth = 14 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 400 400" className={className} aria-hidden focusable="false">
      <path
        className="draw-in"
        style={{ ['--len' as string]: 1100 }}
        d="M318 96 C 372 150, 380 250, 322 316 C 262 384, 146 392, 84 330 C 26 272, 24 166, 84 100 C 128 52, 196 36, 252 52"
        fill="none"
        stroke="#F4B223"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
      />
      <path
        className="draw-in"
        style={{ ['--len' as string]: 900, animationDelay: '0.5s' }}
        d="M300 84 C 356 128, 372 214, 336 282 C 296 356, 196 392, 118 356"
        fill="none"
        stroke="#F4B223"
        strokeOpacity="0.55"
        strokeWidth={strokeWidth * 0.45}
        strokeLinecap="round"
      />
    </svg>
  )
}

/** A hand-drawn "smile" curve (the brand's "Le sourire" motif), drawn when the page loads. */
export function SmileDivider({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 240 36" className={className} aria-hidden focusable="false">
      <path className="draw-in" style={{ ['--len' as string]: 260 }} d="M8 8 C 60 36, 180 36, 232 8" fill="none" stroke="#F4B223" strokeWidth="7" strokeLinecap="round" />
    </svg>
  )
}

/** Circular progress ring (share of a whole), animated from empty on first paint. */
export function ProgressRing({ value, size = 88, label }: { value: number; size?: number; label: string }) {
  const r = 38
  const c = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(1, value))
  return (
    <svg viewBox="0 0 88 88" width={size} height={size} role="img" aria-label={label}>
      <circle cx="44" cy="44" r={r} fill="none" stroke="#E3EDF2" strokeWidth="8" />
      <circle
        className="ring-in"
        style={{ ['--from' as string]: c * pct }}
        cx="44"
        cy="44"
        r={r}
        fill="none"
        stroke="#F4B223"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray={`${c * pct} ${c}`}
        transform="rotate(-90 44 44)"
      />
    </svg>
  )
}
