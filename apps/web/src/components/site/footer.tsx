import NextLink from 'next/link'
import { getTranslations } from 'next-intl/server'
import { Link } from '@/i18n/navigation'
import { navItems, supportItems } from './nav-items'

const socials = [
  { label: 'Instagram', href: 'https://www.instagram.com/assoc_solident' },
  { label: 'Facebook', href: 'https://www.facebook.com/assoc_solident' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@assoc_solident' },
  { label: 'Solifun', href: 'https://www.instagram.com/solifun_' },
]

export async function SiteFooter() {
  const t = await getTranslations('Footer')
  const nav = await getTranslations('Nav')

  return (
    <footer className="bg-navy-900 text-white/85">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <p className="font-heading text-2xl font-bold text-white">
            Solident<span className="text-gold-500">.</span>
          </p>
          <p className="mt-3 max-w-sm text-sm">{t('tagline')}</p>
        </div>

        <nav aria-label={nav('menu')}>
          <ul className="space-y-2 text-sm">
            {[...navItems, ...supportItems].map((i) => (
              <li key={i.href}>
                <Link href={i.href} className="hover:text-gold-500">
                  {nav(i.key)}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="space-y-6 text-sm">
          <div>
            <p className="mb-2 font-semibold text-white">{t('contact')}</p>
            <a href="mailto:solidentassociation@gmail.com" className="break-all hover:text-gold-500">
              solidentassociation@gmail.com
            </a>
          </div>
          <div>
            <p className="mb-2 font-semibold text-white">{t('follow')}</p>
            <ul className="flex flex-wrap gap-x-4 gap-y-1">
              {socials.map((s) => (
                <li key={s.label}>
                  <a href={s.href} target="_blank" rel="noreferrer" className="hover:text-gold-500">
                    {s.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>
          {/* Back-office is French only and lives outside /[locale] */}
          <NextLink href="/connexion" className="inline-block rounded-[10px] border border-white/25 px-3 py-1.5 hover:bg-white/10">
            {nav('members')}
          </NextLink>
        </div>
      </div>
      <p className="border-t border-white/10 py-4 text-center text-xs text-white/60">
        © {new Date().getFullYear()} {t('rights')}
      </p>
    </footer>
  )
}
