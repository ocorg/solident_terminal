// Association identity used across the site (docs/SPEC.md §1). Public information.
export const org = {
  nameFr: 'Association Solident – Bridge de Solidarité des Médecins Dentistes',
  nameAr: 'جمعية جسر التضامن لأطباء الأسنان',
  email: 'solidentassociation@gmail.com',
  bank: 'Attijariwafa Bank',
  accountHolder: 'Association Solident',
  rib: '007 640 0006029000304812 15',
  socials: [
    { label: 'Instagram', handle: '@assoc_solident', href: 'https://www.instagram.com/assoc_solident' },
    { label: 'Facebook', handle: '@assoc_solident', href: 'https://www.facebook.com/assoc_solident' },
    { label: 'TikTok', handle: '@assoc_solident', href: 'https://www.tiktok.com/@assoc_solident' },
    { label: 'Instagram Solifun', handle: '@solifun_', href: 'https://www.instagram.com/solifun_' },
  ],
}

/** RIB without spaces, for copying into banking apps. */
export const ribCompact = org.rib.replace(/\s/g, '')
