/**
 * Official Solident logo (public/brand/logo.webp, transparent background).
 * - plain: on light backgrounds (cream header, white cards)
 * - badge: inside a white circle, for dark backgrounds (navy bars, footer); the logo was designed on white
 */
export function Logo({ size = 40, variant = 'plain', className = '' }: { size?: number; variant?: 'plain' | 'badge'; className?: string }) {
  const img = (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/brand/logo-128.webp" srcSet="/brand/logo-64.webp 64w, /brand/logo-128.webp 128w, /brand/logo.webp 256w" sizes={`${size}px`} alt="Association Solident" width={size} height={size} className="block object-contain" style={{ width: size, height: size }} />
  )
  if (variant === 'plain') return <span className={`inline-flex shrink-0 ${className}`}>{img}</span>
  const pad = Math.max(2, Math.round(size * 0.12))
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-white shadow-card ${className}`} style={{ width: size + pad * 2, height: size + pad * 2 }}>
      {img}
    </span>
  )
}
