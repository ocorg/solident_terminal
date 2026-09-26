import { ImageResponse } from 'next/og'

// Default share image (WhatsApp, Facebook, LinkedIn…) for every public page without its own cover.
export const alt = 'Association Solident'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

// Latin text only: the built-in OG font has no Arabic glyphs.
const tagline: Record<string, string> = {
  fr: 'Le sourire, un droit pour tous',
  ar: 'Le sourire, un droit pour tous',
  en: 'A smile is everyone’s right',
}

export default async function OpengraphImage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 80, background: '#123A4F', color: '#FFFFFF', position: 'relative' }}>
        <div style={{ position: 'absolute', right: -120, top: -120, width: 460, height: 460, borderRadius: 120, background: '#1E5470', transform: 'rotate(12deg)' }} />
        <div style={{ position: 'absolute', right: 140, bottom: -160, width: 320, height: 320, borderRadius: 100, background: '#F4B223', transform: 'rotate(-12deg)' }} />
        <div style={{ display: 'flex', fontSize: 120, fontWeight: 700, letterSpacing: -2 }}>
          Solident<span style={{ color: '#F4B223' }}>.</span>
        </div>
        <div style={{ display: 'flex', marginTop: 12, fontSize: 44, color: '#FBF8F2' }}>{tagline[locale] ?? tagline.fr}</div>
        <div style={{ display: 'flex', alignItems: 'center', marginTop: 48, fontSize: 28, color: '#E3EDF2' }}>
          <div style={{ width: 80, height: 4, background: '#FBF8F2', marginRight: 16 }} />
          <div style={{ width: 14, height: 14, borderRadius: 7, background: '#F4B223', marginRight: 24 }} />
          Bridge de Solidarité des Médecins Dentistes · Maroc
        </div>
      </div>
    ),
    size,
  )
}
