'use client'

import PusherJs from 'pusher-js'
import { useEffect, useRef } from 'react'
import type { RealtimeEvents } from './realtime'

// One WebSocket connection per browser tab, opened on first use.
let client: PusherJs | undefined
function pusher() {
  client ??= new PusherJs(process.env.NEXT_PUBLIC_PUSHER_KEY!, { cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER! })
  return client
}

/** Subscribe to one event on a public channel while the component is mounted. */
export function useRealtime<E extends keyof RealtimeEvents>(
  channel: string,
  event: E,
  onEvent: (payload: RealtimeEvents[E]) => void,
) {
  const handler = useRef(onEvent)
  useEffect(() => {
    handler.current = onEvent
  })

  useEffect(() => {
    const ch = pusher().subscribe(channel)
    const listener = (payload: RealtimeEvents[E]) => handler.current(payload)
    ch.bind(event, listener)
    return () => {
      ch.unbind(event, listener)
      pusher().unsubscribe(channel)
    }
  }, [channel, event])
}
