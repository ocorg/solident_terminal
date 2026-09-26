// Association identity used across the site (docs/SPEC.md §1). Public information.
export const org = {
  nameFr: 'Association Solident – Bridge de Solidarité des Médecins Dentistes',
  nameAr: 'جمعية جسر التضامن لأطباء الأسنان',
  email: 'solidentassociation@gmail.com',
  bank: 'Attijariwafa Bank',
  accountHolder: 'Association Solident',
  rib: '007 640 0006029000304812 15',
}

/** RIB without spaces, for copying into banking apps. */
export const ribCompact = org.rib.replace(/\s/g, '')
