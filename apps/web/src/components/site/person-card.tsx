/** Board member card; shows initials until a photo is uploaded (placeholder decision 26 Sep). */
export function PersonCard({ name, role, photoUrl, phone }: { name: string; role: string; photoUrl?: string | null; phone?: string | null }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('')
  return (
    <li className="card card-hover flex flex-col items-center p-5 text-center">
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={photoUrl} alt={name} className="mb-3 size-24 rounded-full object-cover" />
      ) : (
        <div aria-hidden className="mb-3 flex size-24 items-center justify-center rounded-full bg-navy-100 font-heading text-2xl font-bold text-navy-700">
          {initials}
        </div>
      )}
      <p className="font-heading font-bold text-navy-900">{name}</p>
      <p className="text-sm text-ink-600">{role}</p>
      {phone && (
        <a href={`tel:${phone}`} dir="ltr" className="mt-2 text-sm font-semibold text-navy-700 hover:underline">
          {phone.replace(/^\+212(\d{3})(\d{6})$/, '+212 $1-$2')}
        </a>
      )}
    </li>
  )
}
