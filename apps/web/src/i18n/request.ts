import { hasLocale } from 'next-intl'
import { getRequestConfig } from 'next-intl/server'
import { routing } from './routing'

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale
  // Missing keys in ar/en fall back to French (spec §7: French is the reference language).
  const fr = (await import('../../messages/fr.json')).default
  const own = locale === 'fr' ? fr : (await import(`../../messages/${locale}.json`)).default
  return { locale, messages: deepMerge(fr, own) }
})

type Msgs = { [k: string]: string | Msgs }
function deepMerge(base: Msgs, over: Msgs): Msgs {
  const out: Msgs = { ...base }
  for (const [k, v] of Object.entries(over)) {
    out[k] = typeof v === 'object' && typeof base[k] === 'object' ? deepMerge(base[k] as Msgs, v) : v
  }
  return out
}
