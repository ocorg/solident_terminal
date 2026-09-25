// Shared by server (lib/pusher.ts) and browser (lib/use-realtime.ts): channel names and event payloads.

export const channels = {
  campaign: (id: string) => `campaign-${id}`,
  event: (id: string) => `event-${id}`,
  test: 'admin-test',
}

export type RealtimeEvents = {
  /** Donation bar: sent after a donation is confirmed or rejected. */
  'total-updated': { raisedDh: number; donorsCount: number; goalDh: number }
  /** Event page: sent after a registration is saved or cancelled. */
  'places-updated': { placesLeft: number | null; registrationOpen: boolean }
  /** /admin/outils/temps-reel */
  ping: { sentAt: number; by: string }
}
