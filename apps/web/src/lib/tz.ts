// Admin date inputs are typed in Moroccan local time. Morocco is UTC+1 most of the year and UTC+0
// during Ramadan, so the offset is computed per date from the IANA zone rather than hard-coded.
export const TZ = 'Africa/Casablanca'

function offsetMs(date: Date, tz: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  )
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second)
  return asUtc - date.getTime()
}

/** "2026-11-27T09:00" (Casablanca wall clock) → UTC Date. */
export function localInputToDate(value: string, tz = TZ) {
  const guess = new Date(`${value}:00Z`)
  return new Date(guess.getTime() - offsetMs(guess, tz))
}

/** UTC Date → "2026-11-27T09:00" for a datetime-local input showing Casablanca time. */
export function dateToLocalInput(date: Date, tz = TZ) {
  const shifted = new Date(date.getTime() + offsetMs(date, tz))
  return shifted.toISOString().slice(0, 16)
}
