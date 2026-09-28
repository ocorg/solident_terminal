import type { MetadataRoute } from 'next'

// Installable app (PWA): one "Solident" app for everyone, opening on the public site
// (the proxy picks the visitor's language); members reach /espace from the header or the shortcut.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Solident',
    short_name: 'Solident',
    description: 'Association Solident : soins bucco-dentaires gratuits et prévention au Maroc. Site, espace membres et administration.',
    lang: 'fr',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#FBF8F2',
    theme_color: '#1E5470',
    categories: ['health', 'medical', 'social'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    shortcuts: [
      { name: 'Espace membres', url: '/espace', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
      { name: 'Nos actions', url: '/fr/actions', icons: [{ src: '/icons/icon-192.png', sizes: '192x192' }] },
    ],
  }
}
