import { SmileDivider } from '@/components/motion/brush-ring'

export function PageHeader({ title, intro }: { title: string; intro?: string }) {
  return (
    <header className="mb-10 max-w-3xl">
      <h1 className="font-heading text-4xl font-bold text-navy-900 md:text-5xl">
        {title}
        <span className="brand-dot" aria-hidden />
      </h1>
      <SmileDivider className="my-5 h-6 w-32" />
      {intro && <p className="text-lg text-ink-600">{intro}</p>}
    </header>
  )
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-4 font-heading text-2xl font-bold text-navy-700">{children}</h2>
}
