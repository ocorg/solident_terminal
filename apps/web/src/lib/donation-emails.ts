import 'server-only'
import { emailBrand } from '@/lib/mail'
import { siteUrl } from './site-url'

const esc = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const dh = (n: number, locale: string) =>
  new Intl.NumberFormat(locale === 'ar' ? 'ar-MA' : locale === 'en' ? 'en-GB' : 'fr-MA').format(n) + (locale === 'ar' ? ' درهم' : ' DH')

const copy = {
  fr: {
    subject: 'Merci pour votre don à Solident',
    hello: (n: string) => (n ? `Bonjour ${n},` : 'Bonjour,'),
    body: (amount: string, campaign: string) =>
      `Nous avons bien reçu votre déclaration de don de <strong>${amount}</strong> pour « ${campaign} ». Notre trésorière le vérifie sur le relevé bancaire, puis il apparaîtra dans la barre de progression.`,
    thanks: 'Merci de faire partie de la chaîne de solidarité.',
    cta: 'Voir la campagne',
  },
  ar: {
    subject: 'شكراً على تبرعك لجمعية سوليدنت',
    hello: (n: string) => (n ? `مرحباً ${n}،` : 'مرحباً،'),
    body: (amount: string, campaign: string) =>
      `توصلنا بتصريحك بتبرع قدره <strong>${amount}</strong> لفائدة « ${campaign} ». ستتحقق أمينة المال منه في الكشف البنكي، ثم سيظهر في شريط التقدم.`,
    thanks: 'شكراً لكونك جزءاً من سلسلة التضامن.',
    cta: 'عرض الحملة',
  },
  en: {
    subject: 'Thank you for your gift to Solident',
    hello: (n: string) => (n ? `Hello ${n},` : 'Hello,'),
    body: (amount: string, campaign: string) =>
      `We have received your declaration of a <strong>${amount}</strong> gift to “${campaign}”. Our treasurer will check it on the bank statement, then it will appear on the progress bar.`,
    thanks: 'Thank you for being part of the solidarity chain.',
    cta: 'See the campaign',
  },
} as const

export function donationThanksEmail(locale: string, name: string, amountDh: number, campaign: string) {
  const c = copy[(locale in copy ? locale : 'fr') as keyof typeof copy]
  const dir = locale === 'ar' ? 'rtl' : 'ltr'
  const url = `${siteUrl()}/${locale}/soutenir/don`
  const amount = dh(amountDh, locale)
  const html = `<!doctype html>
<html lang="${locale}" dir="${dir}"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 8px 24px rgba(18,58,79,.08)">
    <div style="background:#1E5470;padding:20px 28px;color:#ffffff;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:20px">${emailBrand()}</div>
    <div style="padding:28px;line-height:1.6">
      <p style="margin:0 0 12px">${esc(c.hello(name))}</p>
      <p style="margin:0 0 12px;color:#4A5A66">${c.body(esc(amount), esc(campaign))}</p>
      <p style="margin:0 0 24px;color:#4A5A66">${c.thanks}</p>
      <a href="${url}" style="display:inline-block;background:#F4B223;color:#123A4F;text-decoration:none;font-weight:600;padding:12px 24px;border-radius:10px">${c.cta}</a>
    </div>
  </div>
</body></html>`
  const text = `${c.hello(name)}\n\n${c.body(amount, campaign).replace(/<[^>]+>/g, '')}\n\n${c.thanks}\n${url}`
  return { subject: c.subject, html, text }
}

export function donationAlertEmail(d: { donorName: string | null; amountDh: number; campaign: string; email: string | null; phone: string | null; hasProof: boolean }) {
  const who = d.donorName || 'Donateur anonyme'
  const url = `${siteUrl()}/admin/dons`
  const subject = `Nouveau don déclaré : ${dh(d.amountDh, 'fr')} – ${who}`
  const lines = [
    `Montant : ${dh(d.amountDh, 'fr')}`,
    `Campagne : ${d.campaign}`,
    `Donateur : ${who}`,
    d.email && `E-mail : ${d.email}`,
    d.phone && `Téléphone : ${d.phone}`,
    `Justificatif : ${d.hasProof ? 'oui' : 'non'}`,
  ].filter(Boolean) as string[]
  const html = `<!doctype html>
<html lang="fr"><body style="margin:0;background:#FBF8F2;font-family:Montserrat,Arial,sans-serif;color:#123A4F;padding:32px 16px">
  <div style="max-width:480px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px;box-shadow:0 8px 24px rgba(18,58,79,.08);line-height:1.7">
    <p style="margin:0 0 12px;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:18px;color:#1E5470">Nouveau don à vérifier</p>
    ${lines.map((l) => `<div>${esc(l)}</div>`).join('')}
    <a href="${url}" style="display:inline-block;margin-top:20px;background:#1E5470;color:#ffffff;text-decoration:none;font-weight:600;padding:12px 20px;border-radius:10px">Vérifier dans /admin/dons</a>
  </div>
</body></html>`
  return { subject, html, text: `${lines.join('\n')}\n\nVérifier : ${url}` }
}
