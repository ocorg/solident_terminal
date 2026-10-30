'use client'

import { useEffect, useState } from 'react'
import { pingProject } from './actions'

type Lang = 'fr' | 'ar' | 'en'

const T = {
  fr: {
    eyebrow: 'Association Solident',
    title: 'Projet en veille',
    body: 'La plateforme est en pause faute d’activité. Rien n’est perdu : tout est conservé et peut être réactivé à tout moment.',
    askTitle: 'Besoin d’y accéder ?',
    askBody: 'Envoyez un ping au responsable du projet. Les champs sont facultatifs, mais ils permettent de vous répondre.',
    name: 'Votre nom',
    contact: 'E-mail ou téléphone',
    message: 'Message',
    messagePh: 'Ex. je fais partie de l’équipe logistique et j’ai besoin de l’inventaire',
    ping: 'Ping le projet',
    sending: 'Envoi…',
    sentTitle: 'Demande d’accès envoyée',
    sentBody: 'En attente d’approbation. Le responsable du projet a été prévenu.',
    tooMany: 'Une demande a déjà été envoyée récemment. Merci de patienter.',
    error: 'L’envoi a échoué. Réessayez dans un instant.',
    optional: 'facultatif',
  },
  ar: {
    eyebrow: 'جمعية سوليدنت',
    title: 'المشروع في وضع السبات',
    body: 'المنصة متوقفة مؤقتًا بسبب عدم النشاط. لم يضع شيء: كل البيانات محفوظة ويمكن إعادة تفعيلها في أي وقت.',
    askTitle: 'تحتاج إلى الوصول؟',
    askBody: 'أرسل تنبيهًا إلى المسؤول عن المشروع. الحقول اختيارية، لكنها تساعد على الرد عليك.',
    name: 'اسمك',
    contact: 'البريد الإلكتروني أو الهاتف',
    message: 'رسالة',
    messagePh: 'مثال: أنا من فريق اللوجستيك وأحتاج إلى الجرد',
    ping: 'تنبيه المشروع',
    sending: 'جارٍ الإرسال…',
    sentTitle: 'تم إرسال طلب الوصول',
    sentBody: 'في انتظار الموافقة. تم إخطار المسؤول عن المشروع.',
    tooMany: 'تم إرسال طلب مؤخرًا. يرجى الانتظار.',
    error: 'تعذر الإرسال. حاول مرة أخرى بعد قليل.',
    optional: 'اختياري',
  },
  en: {
    eyebrow: 'Solident Association',
    title: 'Project hibernating',
    body: 'The platform is paused due to inactivity. Nothing is lost: everything is kept and can be reactivated at any time.',
    askTitle: 'Need access?',
    askBody: 'Send a ping to the project owner. The fields are optional, but they let us reply to you.',
    name: 'Your name',
    contact: 'E-mail or phone',
    message: 'Message',
    messagePh: 'E.g. I’m on the logistics team and need the inventory',
    ping: 'Ping project',
    sending: 'Sending…',
    sentTitle: 'Project access requested',
    sentBody: 'Waiting for approval. The project owner has been notified.',
    tooMany: 'A request was sent recently. Please wait.',
    error: 'Sending failed. Please try again in a moment.',
    optional: 'optional',
  },
} as const

const field =
  'w-full rounded-[10px] border border-white/15 bg-white/10 px-4 py-3 text-white placeholder:text-white/45 outline-none transition focus:border-gold-500 focus:bg-white/15'

export function Hibernation() {
  const [lang, setLang] = useState<Lang>('fr')
  const [f, setF] = useState({ name: '', contact: '', message: '', website: '' })
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | 'tooMany' | 'error'>('idle')
  const t = T[lang]

  // Language: the visitor's browser language on first visit, then their own choice.
  // Read after load on purpose: the page is static HTML (same for everyone), only the browser knows these.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    let saved: string | null = null
    try {
      saved = localStorage.getItem('solident:veille:lang')
      if (sessionStorage.getItem('solident:veille:sent')) setState('sent')
    } catch {}
    const nav = navigator.language.slice(0, 2)
    const pick = (saved ?? nav) as Lang
    if (pick === 'ar' || pick === 'en') setLang(pick)
  }, [])
  /* eslint-enable react-hooks/set-state-in-effect */
  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
    document.title = `${T[lang].title} | ${T[lang].eyebrow}`
  }, [lang])

  function choose(l: Lang) {
    setLang(l)
    try {
      localStorage.setItem('solident:veille:lang', l)
    } catch {}
  }

  async function ping(e: React.FormEvent) {
    e.preventDefault()
    setState('sending')
    try {
      const res = await pingProject({ ...f, lang })
      if (res.status === 'error') return setState(res.message === 'tooMany' ? 'tooMany' : 'error')
      setState('sent')
      try {
        sessionStorage.setItem('solident:veille:sent', '1')
      } catch {}
    } catch {
      setState('error')
    }
  }

  return (
    <main className="veille relative flex min-h-dvh flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Night sky */}
      <svg className="pointer-events-none absolute inset-0 size-full" aria-hidden focusable="false">
        {STARS.map(([x, y, r, d], i) => (
          <circle key={i} cx={`${x}%`} cy={`${y}%`} r={r} fill="#fff" className="veille-star" style={{ animationDelay: `${d}s` }} />
        ))}
      </svg>
      <div aria-hidden className="pointer-events-none absolute -end-40 -top-40 size-[36rem] rounded-full bg-[radial-gradient(closest-side,rgba(244,178,35,0.16),transparent)]" />
      <div aria-hidden className="pointer-events-none absolute -bottom-48 -start-40 size-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(47,164,216,0.12),transparent)]" />

      {/* Language switch */}
      <nav aria-label="Langue" className="absolute end-4 top-4 flex gap-1 rounded-[10px] bg-white/10 p-1 text-sm font-semibold">
        {(['fr', 'ar', 'en'] as const).map((l) => (
          <button key={l} type="button" onClick={() => choose(l)} aria-pressed={lang === l} className={`min-h-9 rounded-[8px] px-3 transition ${lang === l ? 'bg-white text-navy-900' : 'text-white/75 hover:text-white'}`}>
            {l === 'ar' ? 'ع' : l.toUpperCase()}
          </button>
        ))}
      </nav>

      <div className="relative z-10 flex w-full max-w-xl flex-col items-center text-center">
        <SleepingLogo />
        <p className="mt-6 text-sm font-semibold uppercase tracking-[0.18em] text-gold-500">{t.eyebrow}</p>
        <h1 className="mt-2 font-heading text-4xl font-bold sm:text-5xl">
          {t.title}
          <span className="brand-dot" aria-hidden />
        </h1>
        <p className="mt-4 max-w-md text-lg text-white/80">{t.body}</p>

        <section className="mt-10 w-full rounded-[16px] border border-white/10 bg-white/[0.06] p-5 text-start backdrop-blur-sm sm:p-6">
          {state === 'sent' ? (
            <div className="flex items-start gap-4" role="status">
              <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gold-500 text-navy-900">
                <svg viewBox="0 0 24 24" className="size-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                  <path d="M5 12.5l4.5 4.5L19 7.5" />
                </svg>
              </span>
              <div>
                <p className="font-heading text-lg font-bold">{t.sentTitle}</p>
                <p className="mt-1 text-white/75">{t.sentBody}</p>
              </div>
            </div>
          ) : (
            <form onSubmit={ping} className="space-y-3">
              <div>
                <p className="font-heading text-lg font-bold">{t.askTitle}</p>
                <p className="text-sm text-white/70">{t.askBody}</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <input aria-label={`${t.name} (${t.optional})`} placeholder={t.name} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} maxLength={80} autoComplete="name" className={field} />
                <input aria-label={`${t.contact} (${t.optional})`} placeholder={t.contact} value={f.contact} onChange={(e) => setF({ ...f, contact: e.target.value })} maxLength={120} autoComplete="email" dir="ltr" className={`${field} text-start`} />
              </div>
              <textarea aria-label={`${t.message} (${t.optional})`} placeholder={t.messagePh} value={f.message} onChange={(e) => setF({ ...f, message: e.target.value })} maxLength={1000} rows={2} className={field} />
              {/* Honeypot (hidden from people) */}
              <input tabIndex={-1} autoComplete="off" aria-hidden value={f.website} onChange={(e) => setF({ ...f, website: e.target.value })} className="absolute -left-[9999px] size-px opacity-0" name="website" />
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-gold-500" role="status" aria-live="polite">
                  {state === 'tooMany' ? t.tooMany : state === 'error' ? t.error : ''}
                </p>
                <button
                  type="submit"
                  disabled={state === 'sending'}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-[10px] bg-gold-500 px-6 font-semibold text-navy-900 shadow-sm transition hover:brightness-95 active:scale-[0.98] disabled:opacity-70"
                >
                  {state === 'sending' ? (
                    <span aria-hidden className="inline-block size-4 animate-spin rounded-full border-2 border-current border-e-transparent" />
                  ) : (
                    <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                      <path d="M12 3a6 6 0 016 6c0 6 2.5 7.5 2.5 7.5h-17S6 15 6 9a6 6 0 016-6zM10 20a2 2 0 004 0" />
                    </svg>
                  )}
                  {state === 'sending' ? t.sending : t.ping}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </main>
  )
}

/** Logo asleep: it breathes slowly inside a turning gold brushstroke, with drifting "z"s. */
function SleepingLogo() {
  return (
    <div className="relative size-48 sm:size-56" aria-hidden>
      <svg viewBox="0 0 400 400" className="veille-ring absolute inset-0 size-full">
        <path d="M318 96 C 372 150, 380 250, 322 316 C 262 384, 146 392, 84 330 C 26 272, 24 166, 84 100 C 128 52, 196 36, 252 52" fill="none" stroke="#F4B223" strokeWidth="12" strokeLinecap="round" />
        <path d="M300 84 C 356 128, 372 214, 336 282 C 296 356, 196 392, 118 356" fill="none" stroke="#F4B223" strokeOpacity="0.55" strokeWidth="7" strokeLinecap="round" />
      </svg>
      <div className="veille-breathe absolute inset-[17%] flex items-center justify-center rounded-full bg-white shadow-[0_24px_60px_rgba(0,0,0,0.35)]">
        {/* eslint-disable-next-line @next/next/no-img-element -- static brand file */}
        <img src="/brand/logo-128.webp" alt="" width={112} height={112} className="size-[72%] object-contain" />
      </div>
      <svg viewBox="0 0 120 120" className="absolute -end-6 -top-8 size-28 overflow-visible">
        {[0, 1, 2].map((i) => (
          <text key={i} x={20 + i * 22} y={100 - i * 26} className="veille-z font-heading" style={{ animationDelay: `${i * 1.1}s`, fontSize: 18 + i * 8 }} fill="#F4B223" fontWeight={700}>
            z
          </text>
        ))}
      </svg>
    </div>
  )
}

// [x %, y %, radius, twinkle delay]
const STARS: [number, number, number, number][] = [
  [6, 12, 1.2, 0], [14, 34, 0.8, 1.4], [22, 8, 1, 2.2], [31, 22, 0.7, 0.6], [38, 6, 1.3, 3.1], [47, 16, 0.8, 1.9],
  [58, 9, 1, 0.3], [66, 26, 0.7, 2.7], [74, 12, 1.2, 1.1], [83, 30, 0.9, 3.6], [91, 10, 1.1, 0.9], [96, 42, 0.8, 2.4],
  [4, 58, 0.9, 1.7], [11, 82, 1.2, 0.4], [19, 66, 0.7, 3.3], [27, 92, 1, 2], [36, 74, 0.8, 1.2], [63, 88, 1.1, 2.9],
  [71, 70, 0.7, 0.7], [79, 94, 1, 1.6], [88, 76, 1.3, 3.8], [94, 62, 0.8, 2.1], [52, 96, 0.9, 1.3], [44, 84, 0.7, 3.4],
]
