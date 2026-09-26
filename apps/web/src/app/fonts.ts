import { IBM_Plex_Sans_Arabic, Montserrat, Poppins } from 'next/font/google'

export const poppins = Poppins({ variable: '--font-poppins', subsets: ['latin'], weight: ['600', '700'] })
export const montserrat = Montserrat({ variable: '--font-montserrat', subsets: ['latin'], weight: ['400', '500', '600'] })
// Not preloaded: the browser only downloads it on /ar pages, where the CSS actually uses it.
export const plexArabic = IBM_Plex_Sans_Arabic({
  variable: '--font-plex-arabic',
  subsets: ['arabic'],
  weight: ['400', '700'],
  preload: false,
})

export const fontVariables = `${poppins.variable} ${montserrat.variable} ${plexArabic.variable}`
