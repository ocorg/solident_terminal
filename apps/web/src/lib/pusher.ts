import 'server-only'
import Pusher from 'pusher'
import type { RealtimeEvents } from './realtime'

// Pusher Channels, EU cluster (docs/SPEC.md §3, §6). Server side only: holds the secret.
let client: Pusher | undefined
function pusher() {
  const { PUSHER_APP_ID, PUSHER_SECRET, NEXT_PUBLIC_PUSHER_KEY, NEXT_PUBLIC_PUSHER_CLUSTER } = process.env
  if (!PUSHER_APP_ID || !PUSHER_SECRET || !NEXT_PUBLIC_PUSHER_KEY || !NEXT_PUBLIC_PUSHER_CLUSTER) {
    throw new Error('Pusher env vars are not set')
  }
  client ??= new Pusher({
    appId: PUSHER_APP_ID,
    key: NEXT_PUBLIC_PUSHER_KEY,
    secret: PUSHER_SECRET,
    cluster: NEXT_PUBLIC_PUSHER_CLUSTER,
    useTLS: true,
  })
  return client
}

/** Broadcast a typed event. Call it after the DB transaction commits, never inside it. */
export async function broadcast<E extends keyof RealtimeEvents>(channel: string, event: E, payload: RealtimeEvents[E]) {
  await pusher().trigger(channel, event, payload)
}
