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

/** Every section that exists as a (placeholder) page, with its Nav translation key. */
export const sectionKeys: Record<string, string> = Object.fromEntries(
  [...navItems, ...supportItems].map((i) => [i.href.slice(1), i.key]),
)
