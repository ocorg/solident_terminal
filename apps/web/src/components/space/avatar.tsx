import { initials } from '@/lib/space-labels'

export function Avatar({ name, image, size = 'md' }: { name: string; image?: string | null; size?: 'sm' | 'md' | 'lg' }) {
  const cls = { sm: 'size-7 text-xs', md: 'size-9 text-sm', lg: 'size-20 text-2xl' }[size]
  return image ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={image} alt={name} title={name} className={`${cls} shrink-0 rounded-full object-cover ring-2 ring-white`} />
  ) : (
    <span title={name} className={`${cls} flex shrink-0 items-center justify-center rounded-full bg-navy-100 font-semibold text-navy-700 ring-2 ring-white`}>
      {initials(name)}
    </span>
  )
}

export function AvatarStack({ people, max = 4 }: { people: { id: string; name: string; image: string | null }[]; max?: number }) {
  return (
    <span className="flex -space-x-2 rtl:space-x-reverse">
      {people.slice(0, max).map((p) => (
        <Avatar key={p.id} name={p.name} image={p.image} size="sm" />
      ))}
      {people.length > max && <span className="flex size-7 items-center justify-center rounded-full bg-navy-700 text-xs font-semibold text-white ring-2 ring-white">+{people.length - max}</span>}
    </span>
  )
}
