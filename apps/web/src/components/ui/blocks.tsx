// Page-level building blocks (no client state: usable in server pages).
import Link from 'next/link'
import { tagTone, type Tone } from './tones'

/** Page title area: small gold eyebrow, title with the brand dot, one-line purpose, actions on the end side. */
export function PageHeader({ eyebrow, title, description, actions, back }: { eyebrow?: string; title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; back?: { href: string; label: string } }) {
  return (
    <div className="space-y-3">
      {back && (
        <Link href={back.href} className="inline-flex items-center gap-1 text-sm font-semibold text-navy-700 hover:underline">
          <span aria-hidden className="flip-rtl">
            ←
          </span>{' '}
          {back.label}
        </Link>
      )}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0 max-w-3xl">
          {eyebrow && <p className="text-sm font-semibold uppercase tracking-wide text-gold-700">{eyebrow}</p>}
          <h1 className="font-heading text-3xl font-bold text-navy-900">
            {title}
            <span className="brand-dot" aria-hidden />
          </h1>
          {description && <p className="mt-1 text-ink-600">{description}</p>}
        </div>
        {actions && <div className="flex w-full flex-wrap gap-2 sm:w-auto [&>*]:flex-1 sm:[&>*]:flex-none">{actions}</div>}
      </div>
    </div>
  )
}

/** Empty list: an icon, what it means, and the next step (instead of a bare sentence in a box). */
export function EmptyState({ icon, title, children, action }: { icon?: React.ReactNode; title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[12px] border border-dashed border-navy-700/20 bg-white/60 px-6 py-10 text-center">
      {icon && <span className="flex size-12 items-center justify-center rounded-full bg-navy-100 text-navy-700">{icon}</span>}
      <div className="max-w-md space-y-1">
        <p className="font-heading font-bold text-navy-900">{title}</p>
        {children && <div className="text-sm text-ink-600">{children}</div>}
      </div>
      {action}
    </div>
  )
}

const accent: Record<Tone, string> = {
  navy: 'border-navy-700',
  gold: 'border-gold-500',
  success: 'border-success',
  danger: 'border-danger',
  muted: 'border-transparent',
}

/**
 * Key number. `tone` colours the left edge (use it only when the number needs attention), so the
 * eye goes straight to what matters; neutral tiles stay quiet.
 */
export function StatTile({ label, value, hint, tone = 'muted', icon, href }: { label: string; value: React.ReactNode; hint?: React.ReactNode; tone?: Tone; icon?: React.ReactNode; href?: string }) {
  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-ink-600">{label}</p>
        {icon && <span className={`flex size-9 shrink-0 items-center justify-center rounded-[10px] ${tone === 'muted' ? 'bg-navy-100 text-navy-700' : tagTone[tone]}`}>{icon}</span>}
      </div>
      <p className={`font-heading text-3xl font-bold ${tone === 'danger' ? 'text-danger' : tone === 'gold' ? 'text-gold-700' : 'text-navy-900'}`}>{value}</p>
      {hint && <p className="text-xs text-ink-600">{hint}</p>}
    </>
  )
  const cls = `card flex flex-col gap-1 border-s-4 p-4 ${accent[tone]}`
  return href ? (
    <Link href={href} className={`${cls} card-hover`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  )
}

/** Filters as a segmented control of links (replaces the rows of pills). */
export function SegmentedLinks({ items, label }: { items: { href: string; label: React.ReactNode; active: boolean; count?: number }[]; label: string }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <ul className="inline-flex min-w-max gap-1 rounded-[12px] bg-navy-100/60 p-1">
        {items.map((i) => (
          <li key={i.href}>
            <Link
              href={i.href}
              aria-current={i.active ? 'page' : undefined}
              className={`flex min-h-10 items-center gap-1.5 rounded-[9px] px-3 text-sm font-semibold transition ${i.active ? 'bg-white text-navy-900 shadow-sm' : 'text-ink-600 hover:text-navy-900'}`}
            >
              {i.label}
              {i.count !== undefined && <span className={`rounded-[6px] px-1.5 text-xs tabular-nums ${i.active ? 'bg-navy-100 text-navy-700' : 'bg-white/70'}`}>{i.count}</span>}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** Task priority: a small coloured bar + word (no emoji). */
export function PriorityMark({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-600">
      <span aria-hidden className={`h-3 w-1 rounded-full ${color}`} />
      {label}
    </span>
  )
}

/** Status tag usable in server pages (same look as the client Tag). */
export function StatusTag({ tone, children, className = '' }: { tone: Tone; children: React.ReactNode; className?: string }) {
  return <span className={`inline-block whitespace-nowrap rounded-[4px] px-1.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${tagTone[tone]} ${className}`}>{children}</span>
}
