import type { Metadata } from 'next'
import { getTranslations, setRequestLocale } from 'next-intl/server'
import { prisma } from '@solident/db'
import { InquiryForm } from '@/components/site/inquiry-form'
import { PageHeader, SectionTitle } from '@/components/site/page-header'
import { PersonCard } from '@/components/site/person-card'
import { localized } from '@/lib/localized'
import { org } from '@/lib/org'

export const revalidate = 3600

export async function generateMetadata({ params }: PageProps<'/[locale]/contact'>): Promise<Metadata> {
  const { locale } = await params
  const t = await getTranslations({ locale, namespace: 'Contact' })
  return { title: t('title'), description: t('intro') }
}

export default async function ContactPage({ params }: PageProps<'/[locale]/contact'>) {
  const { locale } = await params
  setRequestLocale(locale)
  const t = await getTranslations('Contact')
  const contacts = await prisma.teamMember.findMany({ where: { isPublicContact: true }, orderBy: { order: 'asc' } })

  return (
    <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
      <PageHeader title={t('title')} intro={t('intro')} />
      <div className="grid gap-10 lg:grid-cols-5">
        <section className="card p-6 md:p-8 lg:col-span-3" aria-labelledby="contact-form">
          <h2 id="contact-form" className="mb-6 font-heading text-2xl font-bold text-navy-700">
            {t('formTitle')}
          </h2>
          <InquiryForm kind="contact" />
        </section>
        <aside className="space-y-8 lg:col-span-2">
          <section>
            <SectionTitle>{t('emailTitle')}</SectionTitle>
            <a href={`mailto:${org.email}`} className="break-all text-lg font-semibold text-navy-700 hover:underline">
              {org.email}
            </a>
          </section>
          <section>
            <SectionTitle>{t('socialTitle')}</SectionTitle>
            <ul className="space-y-2">
              {org.socials.map((s) => (
                <li key={s.href}>
                  <a href={s.href} target="_blank" rel="noreferrer" className="flex justify-between gap-4 rounded-[10px] bg-white px-4 py-3 shadow-card transition hover:bg-navy-100">
                    <span className="font-semibold text-navy-700">{s.label}</span>
                    <span dir="ltr" className="text-ink-600">
                      {s.handle}
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
          {contacts.length > 0 && (
            <section>
              <SectionTitle>{t('boardTitle')}</SectionTitle>
              <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
                {contacts.map((c) => (
                  <PersonCard key={c.id} name={c.fullName} role={localized(c, 'role', locale)} photoUrl={c.photoUrl} phone={c.phone} />
                ))}
              </ul>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
