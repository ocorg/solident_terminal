import { createAdminClient } from '@/lib/supabase/admin'

export type DigestActionType =
  | 'task_assigned'
  | 'task_comment'
  | 'task_updated'
  | 'event_invited'
  | 'proposal_approved'
  | 'proposal_rejected'
  | 'added_to_project'
  | 'added_to_cellule'
  | 'proposal_submitted'

export async function queueDigest(
  recipientId: string,
  recipientEmail: string,
  recipientName: string,
  actionType: DigestActionType,
  payload: Record<string, string>
) {
  const admin = createAdminClient()

  // FIX: Shift the base time by -60 minutes to align Morocco Local with UTC
  // Then add the 1 minute (60,000ms) for your grouping delay.
  // This ensures the DB stores a time that is "due" exactly 1 minute from now in your local time.
  const now = Date.now();
  const adjustedBase = now + (60 * 60 * 1000); 
  const sendAfter = new Date(adjustedBase + 60 * 1000).toISOString();

  // Check if there's already a pending digest for this recipient
  const { data: existing } = await admin
    .from('email_digest_queue')
    .select('id')
    .eq('recipient_id', recipientId)
    .gt('send_after', new Date(adjustedBase).toISOString())
    .limit(1)

  if (existing && existing.length > 0) {
    // Reset the timer on all pending items for this recipient
    await admin
      .from('email_digest_queue')
      .update({ send_after: sendAfter })
      .eq('recipient_id', recipientId)
      .gt('send_after', new Date(adjustedBase).toISOString())
  }

  // Always insert the new action
  await admin.from('email_digest_queue').insert({
    recipient_id:     recipientId,
    recipient_email:  recipientEmail,
    recipient_name:   recipientName,
    action_type:      actionType,
    payload,
    send_after:       sendAfter,
  })
}