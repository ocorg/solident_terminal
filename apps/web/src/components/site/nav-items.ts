// Public site map (docs/SPEC.md §4). Slugs stay French in every language.
export const navItems = [
  { href: '/qui-sommes-nous', key: 'about' },
  { href: '/programmes', key: 'programmes' },
  { href: '/actions', key: 'actions' },
  { href: '/evenements', key: 'events' },
  { href: '/solifun', key: 'solifun' },
  { href: '/partenaires', key: 'partners' },
  { href: '/contact', key: 'contact' },
] as const

export const supportItems = [
  { href: '/soutenir/don', key: 'donate' },
  { href: '/soutenir/sponsoring', key: 'sponsoring' },
  { href: '/soutenir/benevolat', key: 'volunteer' },
] as const

/** Sections that already have their real page (excluded from the "coming soon" catch-all). */
export const builtSections = new Set(['soutenir/don', 'soutenir/sponsoring', 'contact', 'qui-sommes-nous'])

/** Sections still shown as a placeholder page, with their Nav translation key. */
export const sectionKeys: Record<string, string> = Object.fromEntries(
  [...navItems, ...supportItems].map((i) => [i.href.slice(1), i.key]).filter(([path]) => !builtSections.has(path)),
)
