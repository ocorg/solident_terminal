import { Hibernation } from './hibernation'

// Fully static: served from Vercel's cache, no function runs when someone opens it.
export const dynamic = 'force-static'

export default function SleepPage() {
  return <Hibernation />
}
